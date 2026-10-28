import { dropTenantSchema, ensureTenantSchema, platformQuery as query, pool } from "./db";
import { deleteTenantFiles } from "./file-storage";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  userLimit: number;
  licenseExpiresAt: string | null;
  billingEmail: string | null;
  billingAmount: number | null;
  billingCycle: string;
  licenseNotes: string | null;
}

function generateTenantId(): string {
  return `TENANT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    plan: String(row.plan),
    status: String(row.status),
    createdAt: new Date(String(row.created_at)).toISOString(),
    userLimit: row.user_limit != null ? Number(row.user_limit) : 5,
    licenseExpiresAt: row.license_expires_at ? new Date(String(row.license_expires_at)).toISOString() : null,
    billingEmail: row.billing_email ? String(row.billing_email) : null,
    billingAmount: row.billing_amount != null ? Number(row.billing_amount) : null,
    billingCycle: row.billing_cycle ? String(row.billing_cycle) : "monthly",
    licenseNotes: row.license_notes ? String(row.license_notes) : null,
  };
}

export async function getTenants(): Promise<Tenant[]> {
  const rows = await query("SELECT * FROM tenants ORDER BY name ASC");
  return rows.map(mapTenant);
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const rows = await query("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ? mapTenant(rows[0]) : undefined;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  const rows = await query("SELECT * FROM tenants WHERE slug = lower($1) LIMIT 1", [slug]);
  return rows[0] ? mapTenant(rows[0]) : undefined;
}

export async function createTenant(data: {
  name: string;
  slug: string;
  plan?: string;
  userLimit?: number;
}): Promise<Tenant> {
  const id = generateTenantId();
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const plan = data.plan || "standard";
  const userLimit = data.userLimit ?? defaultUserLimit(plan);
  const rows = await query(
    `INSERT INTO tenants (id, name, slug, plan, status, user_limit)
     VALUES ($1, $2, $3, $4, 'active', $5) RETURNING *`,
    [id, data.name, slug, plan, userLimit],
  );
  // Every tenant gets its own private schema for all of its data.
  try {
    await ensureTenantSchema(id);
  } catch (err) {
    await query("DELETE FROM tenants WHERE id = $1", [id]).catch(() => undefined);
    throw err;
  }
  return mapTenant(rows[0]);
}

export function defaultUserLimit(plan: string): number {
  if (plan === "pro") return 15;
  if (plan === "enterprise") return -1;
  return 1; // standard — 1 user only
}

export async function updateTenant(
  id: string,
  data: Partial<Omit<Tenant, "id" | "createdAt">>,
): Promise<Tenant> {
  const existing = await getTenantById(id);
  if (!existing) throw new Error("Tenant not found");
  const next = { ...existing, ...data };
  const rows = await query(
    `UPDATE tenants SET
       name = $2, slug = $3, plan = $4, status = $5,
       user_limit = $6, license_expires_at = $7,
       billing_email = $8, billing_amount = $9,
       billing_cycle = $10, license_notes = $11
     WHERE id = $1 RETURNING *`,
    [
      id, next.name, next.slug, next.plan, next.status,
      next.userLimit, next.licenseExpiresAt ?? null,
      next.billingEmail ?? null, next.billingAmount ?? null,
      next.billingCycle, next.licenseNotes ?? null,
    ],
  );
  return mapTenant(rows[0]);
}

/**
 * Permanently deletes a tenant and everything that belongs to it, in one transaction:
 * every row in every table with a tenant_id column (users, records, files, logs…),
 * plus any signed-in sessions for that tenant. Leaving users behind used to let the
 * startup "repair" step resurrect deleted tenants.
 */
export async function deleteTenant(id: string, deletedBy?: string): Promise<{ deletedRows: number }> {
  if (!id || id === "default") throw new Error("The default tenant can't be deleted");
  const client = await pool.connect();
  try {
    await client.query("BEGIN; SET LOCAL search_path TO public");
    const exists = await client.query("SELECT id, name, slug, schema_name FROM tenants WHERE id = $1", [id]);
    if (!exists.rowCount) throw new Error("Tenant not found");
    const doomed = exists.rows[0];
    const userCount = Number((await client.query("SELECT count(*)::int AS n FROM users WHERE tenant_id = $1", [id])).rows[0].n);

    // 1. The tenant's private schema: all of its data, gone in one statement.
    await dropTenantSchema(client, id);

    // 2. Its rows in shared platform tables (users, tokens, activity log) and any
    //    leftover copies in pre-migration legacy_* tables.
    const tables = await client.query<{ table_name: string }>(
      `SELECT DISTINCT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND c.table_name <> 'tenants'`,
    );
    let deletedRows = 0;
    for (const { table_name } of tables.rows) {
      const ident = '"' + table_name.replace(/"/g, '""') + '"';
      const r = await client.query(`DELETE FROM public.${ident} WHERE tenant_id = $1`, [id]);
      deletedRows += r.rowCount ?? 0;
    }
    // 3. Sign out anyone currently signed in to this tenant.
    await client.query(`DELETE FROM "session" WHERE (sess::jsonb -> 'user' ->> 'tenantId') = $1`, [id]);
    await client.query("DELETE FROM tenants WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO tenant_deletions (tenant_id, tenant_name, tenant_slug, schema_name, deleted_by, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, doomed.name, doomed.slug, doomed.schema_name, deletedBy ?? null, JSON.stringify({ users: userCount, platformRows: deletedRows })],
    );
    await client.query("COMMIT");
    // 4. Its stored files (uploads, TTB exports). After the commit, so a failed delete
    //    never leaves data without its files; a failure here is logged, not fatal.
    await deleteTenantFiles(id).catch((err) => console.error(`[tenant] file cleanup failed for ${id}:`, err));
    return { deletedRows };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
