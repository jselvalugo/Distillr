import { query } from "./db";

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

export async function deleteTenant(id: string): Promise<void> {
  await query("DELETE FROM tenants WHERE id = $1", [id]);
}
