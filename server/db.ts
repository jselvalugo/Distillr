import { Pool } from "pg";
import { parse as parsePgConnectionString } from "pg-connection-string";

const connectionString = process.env.DATABASE_URL;
const localOnlyMode = process.env.LOCAL_ONLY_MODE !== "false";
const allowRemote = process.env.ALLOW_REMOTE === "true";

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

function assertLocalDatabaseConfig(): void {
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

assertLocalDatabaseConfig();

export const pool = new Pool(
  connectionString
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.PGHOST || "127.0.0.1",
        port: Number.parseInt(process.env.PGPORT || "5432", 10),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || "postgres",
      },
);

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function initDatabase(): Promise<void> {
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

  // Repair: ensure every tenant_id in users has a matching tenants row
  await query(`
    INSERT INTO tenants (id, name, slug, plan, status)
    SELECT DISTINCT ON (tenant_id)
      tenant_id,
      tenant_id,
      tenant_id,
      'standard',
      'active'
    FROM users
    WHERE tenant_id NOT IN (SELECT id FROM tenants)
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
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
      gallons_molasses DOUBLE PRECISION NOT NULL,
      lbs_sugar DOUBLE PRECISION NOT NULL,
      yeast_date TEXT,
      libertalia_yeast_packets INTEGER NOT NULL,
      riskey_yeast_packets INTEGER NOT NULL,
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

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

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      distillery_name TEXT,
      state TEXT,
      message TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
