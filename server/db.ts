import { createHash } from "node:crypto";
import { Pool, type PoolClient, type QueryResult } from "pg";
import { tryGetCurrentTenantId } from "./tenant-context";
import { parse as parsePgConnectionString } from "pg-connection-string";

const localOnlyMode = process.env.LOCAL_ONLY_MODE !== "false";
const allowRemote = process.env.ALLOW_REMOTE === "true";

/**
 * Resolve the Postgres connection string.
 * On Netlify, Netlify Database injects NETLIFY_DB_URL (the right branch for
 * production or a deploy preview). DATABASE_URL is only a fallback for local
 * development or self-hosting.
 */
function resolveConnectionString(): string | undefined {
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get?: (k: string) => string | undefined } } }).Netlify?.env;
  return (
    netlifyEnv?.get?.("NETLIFY_DB_URL") ||
    process.env.NETLIFY_DB_URL ||
    process.env.DATABASE_URL ||
    undefined
  );
}

function isLocalDatabaseHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith("/")) return true;
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") return true;
  if (normalized.startsWith("127.")) return true;
  if (normalized.startsWith("::ffff:127.")) return true;
  return false;
}

function assertLocalDatabaseConfig(connectionString: string | undefined): void {
  if (!localOnlyMode || allowRemote) return;

  if (connectionString) {
    const parsed = parsePgConnectionString(connectionString);
    if (!isLocalDatabaseHost(parsed.host)) {
      throw new Error(
        `LOCAL_ONLY_MODE is enabled; refusing to connect to non-local database host: ${String(parsed.host)}`,
      );
    }
    return;
  }

  const host = process.env.PGHOST || "127.0.0.1";
  if (!isLocalDatabaseHost(host)) {
    throw new Error(
      `LOCAL_ONLY_MODE is enabled; refusing to connect to non-local database host: ${host}`,
    );
  }
}

let realPool: Pool | null = null;

function getPool(): Pool {
  if (realPool) return realPool;
  const connectionString = resolveConnectionString();
  assertLocalDatabaseConfig(connectionString);
  if (connectionString) {
    const parsed = parsePgConnectionString(connectionString);
    const source = process.env.NETLIFY_DB_URL || (globalThis as any).Netlify?.env?.get?.("NETLIFY_DB_URL")
      ? "Netlify Database"
      : "DATABASE_URL";
    console.log(`[db] connecting to ${source} (host ${String(parsed.host)})`);
  }
  realPool = new Pool(
    connectionString
      ? {
          connectionString,
          ssl: isLocalDatabaseHost(parsePgConnectionString(connectionString).host)
            ? false
            : { rejectUnauthorized: false },
        }
      : {
          host: process.env.PGHOST || "127.0.0.1",
          port: Number.parseInt(process.env.PGPORT || "5432", 10),
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE || "postgres",
        },
  );
  return realPool;
}

/**
 * Lazily-created pool. The real pg.Pool is created on first use so the
 * connection string is read at request time (when Netlify has injected it),
 * not at module load.
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const p = getPool();
    const value = Reflect.get(p, prop, p);
    return typeof value === "function" ? value.bind(p) : value;
  },
});

// ─── Tenant routing ─────────────────────────────────────────────────────────
// Every tenant (distillery) has its own Postgres schema holding ALL of its data
// tables. Shared platform tables (tenants, users/logins, sessions, waitlist,
// activity log, password-setup tokens) live in "public".
//
// query() picks the schema from the request's tenant context: inside a tenant
// it runs with search_path = "<tenant schema>", public; outside any tenant it
// runs with search_path = public, where no tenant data tables exist (the old
// shared tables are renamed legacy_* after migration), so a query that forgets
// its tenant fails instead of touching someone else's data.

// Routing never changes a connection's session state: the tenant's search_path is
// set with SET LOCAL inside a transaction, so it ends with that transaction. This is
// safe with direct connections and with transaction-mode poolers (PgBouncer/Neon),
// where session-level SETs could otherwise leak to another request.

/** Schema name for a NEW tenant. Existing tenants are always routed by tenants.schema_name. */
export function schemaForTenant(tenantId: string): string {
  const slug = tenantId.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  const hash = createHash("sha256").update(tenantId).digest("hex").slice(0, 8);
  return `tenant_${slug}_${hash}`;
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

function quoteLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

/** tenantId → its (current, fully migrated) schema name. Per-instance cache. */
const tenantSchemas = new Map<string, string>();

async function schemaOf(tenantId: string): Promise<string> {
  const cached = tenantSchemas.get(tenantId);
  if (cached) return cached;
  let rows = await platformQuery<{ schema_name: string | null; schema_version: number }>(
    `SELECT schema_name, schema_version FROM tenants WHERE id = $1`, [tenantId],
  );
  if (!rows[0]) throw new Error("Unknown tenant");
  if (!rows[0].schema_name || Number(rows[0].schema_version) < TENANT_SCHEMA_VERSION) {
    await ensureTenantSchema(tenantId);
    rows = await platformQuery(`SELECT schema_name, schema_version FROM tenants WHERE id = $1`, [tenantId]);
  }
  const schema = rows[0]!.schema_name!;
  tenantSchemas.set(tenantId, schema);
  return schema;
}

export function forgetTenantSchema(tenantId: string): void {
  tenantSchemas.delete(tenantId);
}

async function pathForCurrentContext(): Promise<string> {
  const tenantId = tryGetCurrentTenantId();
  if (!tenantId) return "public";
  return `${quoteIdent(await schemaOf(tenantId))}, public`;
}

/**
 * Run `fn` inside ONE transaction on a client routed to the current tenant's schema
 * (or public outside any tenant). Commits if `fn` resolves, rolls back if it throws.
 * Callers must not issue BEGIN/COMMIT themselves.
 */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const path = await pathForCurrentContext();
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; SET LOCAL search_path TO ${path}`);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function queryResult(text: string, params?: unknown[]): Promise<QueryResult> {
  return withClient((client) => client.query(text, params));
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await queryResult(text, params);
  return result.rows as T[];
}

/** Platform-level query: always runs against public, regardless of tenant context. */
export async function platformQuery<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN; SET LOCAL search_path TO public");
    const result = await client.query(text, params);
    await client.query("COMMIT");
    return result.rows as T[];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ─── Schema DDL ─────────────────────────────────────────────────────────────

/** Bump when TENANT_DDL changes so existing tenant schemas are re-migrated on next boot. */
export const TENANT_SCHEMA_VERSION = 1;

const PLATFORM_DDL = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, email)
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS tenant_activity_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      user_id TEXT,
      user_email TEXT,
      user_name TEXT,
      ip_address TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_activity_tenant_occurred
      ON tenant_activity_logs(tenant_id, occurred_at DESC);

    -- One-time "set your password" links sent in the tenant welcome email (hash only).
    CREATE TABLE IF NOT EXISTS password_setup_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS password_setup_tokens_user_idx ON password_setup_tokens (tenant_id, user_id);

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      distillery_name TEXT,
      state TEXT,
      message TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

/** Every data table a tenant owns. Run with search_path set to that tenant's schema only. */
const TENANT_DDL = `

    CREATE TABLE IF NOT EXISTS platform_config (
      tenant_id TEXT PRIMARY KEY,
      organization_name TEXT NOT NULL,
      platform_tagline TEXT NOT NULL,
      industry TEXT NOT NULL,
      support_email TEXT NOT NULL,
      support_phone TEXT NOT NULL,
      website TEXT NOT NULL,
      primary_address TEXT NOT NULL,
      time_zone TEXT NOT NULL,
      account_types TEXT[] NOT NULL DEFAULT '{}',
      account_statuses TEXT[] NOT NULL DEFAULT '{}',
      account_industries TEXT[] NOT NULL DEFAULT '{}',
      account_tiers TEXT[] NOT NULL DEFAULT '{}',
      service_categories TEXT[] NOT NULL DEFAULT '{}',
      service_catalog TEXT[] NOT NULL DEFAULT '{}',
      location_types TEXT[] NOT NULL DEFAULT '{}',
      location_statuses TEXT[] NOT NULL DEFAULT '{}',
      requirement_types TEXT[] NOT NULL DEFAULT '{}',
      requirement_statuses TEXT[] NOT NULL DEFAULT '{}',
      requirement_severities TEXT[] NOT NULL DEFAULT '{}'
    );

    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS logo_data_url TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS organization_name_override TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS dsp_number TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS dashboard_color TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS theme TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS ein TEXT;

    CREATE TABLE IF NOT EXISTS clients (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT,
      dba TEXT,
      type TEXT NOT NULL,
      contact TEXT NOT NULL,
      contact_title TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      account_owner TEXT,
      status TEXT NOT NULL,
      website TEXT,
      support_email TEXT,
      support_phone TEXT,
      billing_address TEXT,
      headquarters_address TEXT,
      payment_terms TEXT,
      tax_id TEXT,
      industry_segment TEXT,
      account_tier TEXT,
      onboarding_status TEXT,
      renewal_date TEXT,
      notes TEXT,
      coi_expires_on TEXT,
      service_agreement_expires_on TEXT
    );

    CREATE TABLE IF NOT EXISTS properties (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      client_id TEXT NOT NULL,
      type TEXT,
      status TEXT,
      region TEXT,
      site_contact TEXT,
      site_contact_phone TEXT,
      access_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      address TEXT NOT NULL,
      service TEXT NOT NULL,
      service_category TEXT,
      status TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      crew TEXT[] NOT NULL DEFAULT '{}',
      priority TEXT NOT NULL,
      block_reason TEXT,
      scheduled_date TEXT NOT NULL,
      assigned_user_id TEXT,
      work_order_number TEXT,
      estimated_minutes INTEGER,
      completion_notes TEXT,
      after_photos TEXT[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS staff (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      phone TEXT NOT NULL,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS compliance (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      regulatory_area TEXT,
      jurisdiction TEXT,
      control_reference TEXT,
      status TEXT NOT NULL,
      expires TEXT,
      document_url TEXT,
      owner TEXT,
      severity TEXT,
      required_for TEXT,
      last_reviewed_on TEXT,
      retention_years INTEGER,
      retention_until TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS job_photos (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT,
      doc_type TEXT NOT NULL,
      effective_on TEXT,
      expires_on TEXT,
      status TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS attachment_links (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      attachment_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      linked_by TEXT NOT NULL,
      linked_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS attachment_links_entity_idx ON attachment_links(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS attachments_doc_type_idx ON attachments(doc_type);
    CREATE INDEX IF NOT EXISTS attachments_expires_idx ON attachments(expires_on);

    CREATE TABLE IF NOT EXISTS inventory_items (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit_of_measure TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_lots (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      batch_id TEXT,
      lot_code TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      unit_of_measure TEXT NOT NULL,
      abv DOUBLE PRECISION,
      proof_gallons DOUBLE PRECISION,
      location_id TEXT,
      received_at TEXT,
      expires_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      lot_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      ttb_operation_category TEXT,
      production_stage TEXT,
      tax_classification TEXT,
      from_location_id TEXT,
      to_location_id TEXT,
      reason TEXT,
      performed_by TEXT,
      performed_at TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS barrels (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      serial_number TEXT NOT NULL,
      product_name TEXT,
      fill_date TEXT,
      fill_proof DOUBLE PRECISION,
      fill_proof_gallons DOUBLE PRECISION,
      fill_volume DOUBLE PRECISION,
      current_volume DOUBLE PRECISION,
      current_proof_gallons DOUBLE PRECISION,
      total_aging_days INTEGER,
      dump_date TEXT,
      cases_made INTEGER,
      percent_bottled DOUBLE PRECISION,
      losses_proof_gallons DOUBLE PRECISION,
      status TEXT NOT NULL,
      location_id TEXT,
      warehouse_zone TEXT,
      char_level TEXT,
      origin_batch_id TEXT,
      color_notes TEXT,
      nose_notes TEXT,
      sample_percent_notes TEXT,
      outdoor_temp TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS barrel_events (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      barrel_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_at TEXT NOT NULL,
      volume_change DOUBLE PRECISION,
      proof_at_event DOUBLE PRECISION,
      ttb_operation_category TEXT,
      production_stage TEXT,
      tax_classification TEXT,
      from_location_id TEXT,
      to_location_id TEXT,
      notes TEXT,
      performed_by TEXT,
      outdoor_temp DOUBLE PRECISION,
      wine_gallons DOUBLE PRECISION,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS ttb_reports (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      report_period_start TEXT NOT NULL,
      report_period_end TEXT NOT NULL,
      filing_type TEXT,
      filing_cadence TEXT,
      due_date TEXT,
      excise_tax_due DOUBLE PRECISION,
      status TEXT NOT NULL,
      generated_at TEXT,
      approved_at TEXT,
      approved_by TEXT,
      exported_at TEXT,
      retention_until TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      json_path TEXT,
      csv_path TEXT,
      pdf_path TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_name TEXT,
      actor_role TEXT,
      occurred_at TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    );


    CREATE TABLE IF NOT EXISTS sales_orders (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL,
      order_date TEXT NOT NULL,
      requested_ship_date TEXT,
      fulfilled_date TEXT,
      total_amount DOUBLE PRECISION,
      currency TEXT NOT NULL,
      notes TEXT,
      line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calculator_presets (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      calculation_type TEXT NOT NULL,
      parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS distilling_batch_records (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL,
      batch_date TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      production_record_id TEXT,
      inventory_record_id TEXT,
      sales_order_id TEXT,
      product_name TEXT,
      barrel_id TEXT,
      spirit_type TEXT,
      spirit_class TEXT,
      distillation_proof DOUBLE PRECISION,
      proof_gallons_produced DOUBLE PRECISION,
      still_type TEXT,
      fill_number TEXT,
      fill_proof DOUBLE PRECISION,
      fill_wine_gallons DOUBLE PRECISION,
      fill_proof_gallons DOUBLE PRECISION,
      container_type TEXT,
      bottling_date TEXT,
      bottling_proof DOUBLE PRECISION,
      wine_gallons_bottled DOUBLE PRECISION,
      proof_gallons_processed DOUBLE PRECISION,
      cases_750ml INTEGER,
      cases_1000ml INTEGER,
      cases_1750ml INTEGER,
      total_cases INTEGER,
      lot_number TEXT,
      tax_class TEXT,
      excise_tax_due DOUBLE PRECISION,
      distill_date TEXT,
      fill_date TEXT,
      target_dump_date TEXT,
      amount_received_gallons DOUBLE PRECISION,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS distilling_production_records (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      batch_record_id TEXT,
      mash_date TEXT NOT NULL,
      ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
      yeast_date TEXT,
      distill_date TEXT NOT NULL,
      gallons_distilled DOUBLE PRECISION NOT NULL,
      percentage_distilled DOUBLE PRECISION NOT NULL,
      proof_of_gallons DOUBLE PRECISION NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS distilling_inventory_records (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      title TEXT,
      product_name TEXT,
      product_type TEXT,
      average_abv_percent DOUBLE PRECISION,
      batch_record_id TEXT,
      linked_barrel_id TEXT,
      report_month TEXT NOT NULL,
      cases_made JSONB NOT NULL DEFAULT '{}'::jsonb,
      cases_to_distributors JSONB NOT NULL DEFAULT '{}'::jsonb,
      cases_to_retail JSONB NOT NULL DEFAULT '{}'::jsonb,
      bottles_made JSONB NOT NULL DEFAULT '{}'::jsonb,
      cases_cased JSONB,
      bottles_empty JSONB,
      amount_received_gallons DOUBLE PRECISION,
      amount_lost_gallons DOUBLE PRECISION,
      taxes_owed DOUBLE PRECISION,
      beginning_of_month_cases INTEGER NOT NULL,
      current_month_inventory INTEGER NOT NULL,
      ending_month_inventory INTEGER NOT NULL,
      ending_us_gallons DOUBLE PRECISION NOT NULL,
      ending_proof_gallons DOUBLE PRECISION NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS distilling_batch_records_batch_date_idx
      ON distilling_batch_records(batch_date DESC);
    CREATE INDEX IF NOT EXISTS distilling_production_records_distill_date_idx
      ON distilling_production_records(distill_date DESC);
    CREATE INDEX IF NOT EXISTS distilling_inventory_records_report_month_idx
      ON distilling_inventory_records(report_month DESC);

    CREATE TABLE IF NOT EXISTS permits (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      permit_type TEXT NOT NULL,
      permit_number TEXT NOT NULL,
      issuing_authority TEXT NOT NULL,
      state TEXT,
      issue_date TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      reminder_days_before INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cola_registrations (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      class_type TEXT NOT NULL,
      formula_number TEXT,
      cola_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      applied_at TEXT,
      approved_at TEXT,
      expires_at TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS label_records (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      version TEXT NOT NULL,
      cola_id TEXT,
      net_contents TEXT,
      alcohol_content NUMERIC,
      class_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_at TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS state_excise_returns (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_proof_gallons NUMERIC NOT NULL DEFAULT 0,
      rate_per_proof_gallon NUMERIC NOT NULL DEFAULT 0,
      total_tax NUMERIC NOT NULL DEFAULT 0,
      filed_at TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS distillery_equipment (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      type TEXT NOT NULL DEFAULT 'tank',
      zone TEXT NOT NULL DEFAULT 'other',
      capacity NUMERIC,
      capacity_unit TEXT DEFAULT 'gallons',
      status TEXT NOT NULL DEFAULT 'empty',
      linked_batch_id TEXT,
      linked_barrel_id TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Idempotent column migrations for existing data tables (runs safely on fresh or existing DBs)
    ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS ttb_operation_category TEXT;
    ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS production_stage TEXT;
    ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tax_classification TEXT;

    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS ttb_operation_category TEXT;
    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS production_stage TEXT;
    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS tax_classification TEXT;
    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS outdoor_temp DOUBLE PRECISION;
    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS wine_gallons DOUBLE PRECISION;

    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS product_name TEXT;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS fill_proof_gallons DOUBLE PRECISION;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS current_proof_gallons DOUBLE PRECISION;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS total_aging_days INTEGER;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS dump_date TEXT;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS cases_made INTEGER;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS percent_bottled DOUBLE PRECISION;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS losses_proof_gallons DOUBLE PRECISION;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS color_notes TEXT;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS nose_notes TEXT;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS sample_percent_notes TEXT;
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS outdoor_temp TEXT;

    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS regulatory_area TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS jurisdiction TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS control_reference TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS retention_years INTEGER;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS retention_until TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS created_at TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS updated_at TEXT;
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS notes TEXT;

    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS filing_type TEXT;
    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS filing_cadence TEXT;
    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS due_date TEXT;
    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS excise_tax_due DOUBLE PRECISION;
    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS retention_until TEXT;

    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS product_name TEXT;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS product_type TEXT;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS average_abv_percent DOUBLE PRECISION;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS linked_barrel_id TEXT;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS cases_cased JSONB;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS bottles_empty JSONB;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS amount_received_gallons DOUBLE PRECISION;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS amount_lost_gallons DOUBLE PRECISION;
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS taxes_owed DOUBLE PRECISION;

    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS product_name TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS barrel_id TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS spirit_type TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS spirit_class TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS distillation_proof DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS proof_gallons_produced DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS still_type TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS fill_number TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS fill_proof DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS fill_wine_gallons DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS fill_proof_gallons DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS container_type TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS bottling_date TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS bottling_proof DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS wine_gallons_bottled DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS proof_gallons_processed DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS cases_750ml INTEGER;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS cases_1000ml INTEGER;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS cases_1750ml INTEGER;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS total_cases INTEGER;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS lot_number TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS tax_class TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS excise_tax_due DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS distill_date TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS fill_date TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS target_dump_date TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS amount_received_gallons DOUBLE PRECISION;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS production_month TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS expecting_outcome TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS expecting_date TEXT;

    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS inventory_loss_rates TEXT;
    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS product_label_counts TEXT;

    -- Backfill production_month from distill_date for existing records
    UPDATE distilling_batch_records
      SET production_month = SUBSTRING(distill_date, 1, 7)
      WHERE production_month IS NULL AND distill_date IS NOT NULL AND distill_date != '';

    -- Tenant isolation columns (for migrating existing single-tenant deployments)
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE compliance ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE attachments ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE attachment_links ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE barrels ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE barrel_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE ttb_reports ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE calculator_presets ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE distilling_production_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE distilling_inventory_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE permits ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE cola_registrations ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE label_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE state_excise_returns ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    ALTER TABLE distillery_equipment ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';


    -- Data backfill for existing records
    UPDATE compliance
    SET
      retention_years = COALESCE(retention_years, 3),
      retention_until = COALESCE(retention_until, (NOW() + INTERVAL '3 years')::text),
      created_at = COALESCE(created_at, NOW()::text),
      updated_at = COALESCE(updated_at, NOW()::text)
    WHERE retention_years IS NULL OR retention_until IS NULL OR created_at IS NULL OR updated_at IS NULL;

    UPDATE ttb_reports
    SET
      filing_cadence = COALESCE(filing_cadence, 'Monthly'),
      due_date = COALESCE(due_date, report_period_end),
      retention_until = COALESCE(retention_until, (NOW() + INTERVAL '3 years')::text)
    WHERE filing_cadence IS NULL OR due_date IS NULL OR retention_until IS NULL;

    UPDATE distilling_inventory_records
    SET title = COALESCE(title, CONCAT('Inventory ', report_month))
    WHERE title IS NULL;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'distilling_inventory_records'
          AND column_name = 'product_type'
      ) THEN
        EXECUTE '
          UPDATE distilling_inventory_records
          SET product_name = COALESCE(product_name, product_type)
          WHERE product_name IS NULL
        ';
      END IF;
    END $$;
`;

type Exec = (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;

/**
 * Create or upgrade one tenant's private schema, using `client`, which MUST already be
 * inside a transaction. Idempotent. Serialized per tenant by a row lock on its tenants
 * row (the only lock taken before DDL, so no lock-order deadlocks). Every tenant_id
 * column defaults to, and is CHECK-constrained to, this tenant.
 */
async function ensureTenantSchemaWith(client: PoolClient, tenantId: string): Promise<string> {
  const row = await client.query(
    `SELECT schema_name, schema_version FROM public.tenants WHERE id = $1 FOR UPDATE`, [tenantId],
  );
  if (!row.rows[0]) throw new Error(`Unknown tenant ${tenantId}`);
  const schema: string = row.rows[0].schema_name || schemaForTenant(tenantId);
  if (row.rows[0].schema_name && Number(row.rows[0].schema_version ?? 0) >= TENANT_SCHEMA_VERSION) return schema;

  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
  await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}`);
  await client.query(TENANT_DDL);
  const exec: Exec = (text, params) => client.query(text, params);
  const { migrateReferenceData } = await import("./reference-data");
  await migrateReferenceData(exec);
  const locked = await client.query(
    `SELECT c.relname AS table_name,
            EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.conname = left(c.relname || '_tenant_lock', 60)) AS has_lock
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
     WHERE n.nspname = $1 AND c.relkind = 'r'`,
    [schema],
  );
  for (const { table_name, has_lock } of locked.rows) {
    const tbl = `${quoteIdent(schema)}.${quoteIdent(table_name)}`;
    await client.query(`ALTER TABLE ${tbl} ALTER COLUMN tenant_id SET DEFAULT ${quoteLiteral(tenantId)}`);
    if (!has_lock) {
      const cname = `${table_name}_tenant_lock`.slice(0, 60);
      await client.query(`ALTER TABLE ${tbl} ADD CONSTRAINT ${quoteIdent(cname)} CHECK (tenant_id = ${quoteLiteral(tenantId)})`);
    }
  }
  await client.query(`SET LOCAL search_path TO public`);
  await client.query(`UPDATE public.tenants SET schema_name = $2, schema_version = $3 WHERE id = $1`, [tenantId, schema, TENANT_SCHEMA_VERSION]);
  return schema;
}

/** Create or upgrade one tenant's private schema in its own transaction. */
export async function ensureTenantSchema(tenantId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN; SET LOCAL search_path TO public; SET LOCAL lock_timeout = '30s'");
    await ensureTenantSchemaWith(client, tenantId);
    await client.query("COMMIT");
    tenantSchemas.delete(tenantId);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Drop a tenant's private schema and everything in it (client must be in a transaction). */
export async function dropTenantSchema(client: PoolClient, tenantId: string): Promise<void> {
  const row = await client.query(`SELECT schema_name FROM public.tenants WHERE id = $1`, [tenantId]);
  const schema: string | null = row.rows[0]?.schema_name ?? null;
  if (schema && schema.startsWith("tenant_")) {
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
  }
  tenantSchemas.delete(tenantId);
}

// ─── Boot ───────────────────────────────────────────────────────────────────

/** Bump when PLATFORM_DDL / the bootstrap statements below change. */
const PLATFORM_VERSION = "platform_v2";
const PLATFORM_TABLES = new Set(["users", "tenants", "tenant_activity_logs", "password_setup_tokens", "session", "waitlist", "platform_migrations", "tenant_deletions"]);

/** Platform tables. Version-gated, so a normal cold start runs one SELECT and takes no table locks. */
async function initPlatform(): Promise<void> {
  await platformQuery(`CREATE TABLE IF NOT EXISTS platform_migrations (id TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), details JSONB)`);
  await platformQuery(`ALTER TABLE platform_migrations ADD COLUMN IF NOT EXISTS details JSONB`);
  const done = await platformQuery(`SELECT 1 FROM platform_migrations WHERE id = $1`, [PLATFORM_VERSION]);
  if (done[0]) return;
  // Autocommit, one statement at a time (as before), so locks are held only briefly.
  const query = (text: string, params?: unknown[]) => platformQuery(text, params);
  // Session store table used by connect-pg-simple (express-session).
  await query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
      "sess" JSON NOT NULL,
      "expire" TIMESTAMP(6) NOT NULL
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);

  await query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_limit INTEGER NOT NULL DEFAULT 5,
      license_expires_at TIMESTAMPTZ,
      billing_email TEXT,
      billing_amount NUMERIC(10,2),
      billing_cycle TEXT DEFAULT 'monthly',
      license_notes TEXT
    )
  `);

  // Add licensing columns to existing tenants tables (safe migration)
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_limit INTEGER NOT NULL DEFAULT 5`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email TEXT`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10,2)`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_notes TEXT`);

  await query(`
    INSERT INTO tenants (id, name, slug, plan, status)
    VALUES ('default', 'Default', 'default', 'standard', 'active')
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS schema_name TEXT`);
  await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 0`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS tenants_schema_name_key ON tenants (schema_name)`);
  await query(PLATFORM_DDL);
  // Permanent audit trail of tenant deletions (kept after the tenant is gone).
  await query(`
    CREATE TABLE IF NOT EXISTS tenant_deletions (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      tenant_name TEXT,
      tenant_slug TEXT,
      schema_name TEXT,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_by TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await query(`INSERT INTO platform_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [PLATFORM_VERSION]);
}

async function legacySharedTables(client: { query: (t: string, p?: unknown[]) => Promise<{ rows: any[] }> }): Promise<string[]> {
  const r = await client.query(
    `SELECT DISTINCT c.relname AS table_name
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE 'legacy\\_%'`,
  );
  return r.rows.map((x) => String(x.table_name)).filter((t) => !PLATFORM_TABLES.has(t)).sort();
}

export type SchemaMigrationState = "done" | "pending";

export async function schemaMigrationState(): Promise<SchemaMigrationState> {
  const done = await platformQuery(`SELECT 1 FROM platform_migrations WHERE id = 'schema_per_tenant'`);
  return done[0] ? "done" : "pending";
}

/**
 * One-time move from the old shared tables (public.<table> with a tenant_id column)
 * into each tenant's private schema, in ONE transaction:
 * - writes to the old tables are blocked for the duration (EXCLUSIVE lock; reads OK)
 * - every copied table is row-count-verified per tenant, or the whole thing rolls back
 * - old tables are renamed legacy_<table> and kept as a backup
 * - a report (counts, orphans, columns not carried over) is saved in platform_migrations
 * Meant to run in the background function (15-minute limit), not in a web request.
 */
export async function runSchemaMigration(): Promise<{ ran: boolean; report?: unknown }> {
  await initPlatform();
  const client = await pool.connect();
  try {
    await client.query(
      "BEGIN; SET LOCAL search_path TO public; SET LOCAL lock_timeout = '60s'; SET LOCAL statement_timeout = '10min'; SET LOCAL idle_in_transaction_session_timeout = '2min'",
    );
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('distillr-schema-migration'))`);
    const done = await client.query(`SELECT 1 FROM platform_migrations WHERE id = 'schema_per_tenant'`);
    if (done.rows[0]) {
      await client.query("COMMIT");
      return { ran: false };
    }
    const started = Date.now();
    const legacyTables = await legacySharedTables(client);
    const report: Record<string, any> = { tables: legacyTables.length, tenants: {}, orphans: {}, columnsNotCopied: {} };

    if (legacyTables.length) {
      await client.query(`LOCK TABLE ${legacyTables.map((t) => `public.${quoteIdent(t)}`).join(", ")} IN EXCLUSIVE MODE`);
      // Bring the old shared tables up to the current shape first (same as the previous boot did).
      if (legacyTables.includes("platform_config")) {
        const { migrateReferenceData } = await import("./reference-data");
        await migrateReferenceData((text, params) => client.query(text, params));
      }
    }

    const colsOf = async (schema: string) => {
      const r = await client.query(
        `SELECT c.relname AS t, a.attname AS col FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`,
        [schema],
      );
      const m = new Map<string, Set<string>>();
      for (const { t, col } of r.rows) (m.get(t) ?? m.set(t, new Set()).get(t)!).add(col);
      return m;
    };
    const publicCols = await colsOf("public");

    const tenants = await client.query(`SELECT id FROM tenants ORDER BY id`);
    for (const { id } of tenants.rows) {
      const tenantId = String(id);
      const schema = await ensureTenantSchemaWith(client, tenantId);
      const targetCols = await colsOf(schema);
      const counts: Record<string, number> = {};
      for (const table of legacyTables) {
        const target = targetCols.get(table);
        const source = publicCols.get(table)!;
        if (!target) throw new Error(`Table ${table} has tenant data but no place in the tenant schema`);
        const missing = Array.from(source).filter((c) => !target.has(c));
        if (missing.length) report.columnsNotCopied[table] = missing;
        const cols = Array.from(target).filter((c) => source.has(c)).map(quoteIdent).join(", ");
        const expected = Number((await client.query(`SELECT count(*)::int AS n FROM public.${quoteIdent(table)} WHERE tenant_id = $1`, [tenantId])).rows[0].n);
        if (!expected) continue;
        const ins = await client.query(
          `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table)} (${cols})
           SELECT ${cols} FROM public.${quoteIdent(table)} WHERE tenant_id = $1`,
          [tenantId],
        );
        if (ins.rowCount !== expected) throw new Error(`Copy check failed for ${table} / ${tenantId}: ${ins.rowCount} of ${expected}`);
        counts[table] = expected;
      }
      report.tenants[tenantId] = counts;
    }

    for (const table of legacyTables) {
      const orphans = Number((await client.query(
        `SELECT count(*)::int AS n FROM public.${quoteIdent(table)} WHERE tenant_id NOT IN (SELECT id FROM tenants)`,
      )).rows[0].n);
      if (orphans) report.orphans[table] = orphans;
      await client.query(`ALTER TABLE public.${quoteIdent(table)} RENAME TO ${quoteIdent(`legacy_${table}`.slice(0, 63))}`);
    }
    report.seconds = Math.round((Date.now() - started) / 100) / 10;
    await client.query(`INSERT INTO platform_migrations (id, details) VALUES ('schema_per_tenant', $1)`, [JSON.stringify(report)]);
    await client.query(`DELETE FROM platform_migrations WHERE id = 'schema_per_tenant_error'`);
    await client.query("COMMIT");
    tenantSchemas.clear();
    console.log(`[db] schema-per-tenant migration done: ${JSON.stringify(report)}`);
    return { ran: true, report };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    // Record the failure (outside the rolled-back transaction) so the admin can see it.
    await platformQuery(
      `INSERT INTO platform_migrations (id, details) VALUES ('schema_per_tenant_error', $1)
       ON CONFLICT (id) DO UPDATE SET details = EXCLUDED.details, done_at = NOW()`,
      [JSON.stringify({ error: String(err?.message ?? err) })],
    ).catch(() => undefined);
    console.error("[db] schema-per-tenant migration FAILED (nothing changed):", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Boot: platform tables (version-gated), then tenant schemas.
 * - Fresh database (no old shared tables): marks the migration done and creates schemas.
 * - Old shared tables present: returns "pending" unless `runMigration` is set; on
 *   Netlify the background function performs the move (see netlify/functions).
 */
export async function initDatabase(opts: { runMigration?: boolean } = {}): Promise<SchemaMigrationState> {
  await initPlatform();
  if ((await schemaMigrationState()) === "pending") {
    const legacy = await legacySharedTables({ query: (t, p) => platformQuery(t, p).then((rows) => ({ rows })) });
    if (legacy.length && !opts.runMigration) return "pending";
    await runSchemaMigration();
  }
  const stale = await platformQuery<{ id: string }>(
    `SELECT id FROM tenants WHERE schema_name IS NULL OR schema_version < $1`, [TENANT_SCHEMA_VERSION],
  );
  for (const { id } of stale) await ensureTenantSchema(String(id));
  return "done";
}
