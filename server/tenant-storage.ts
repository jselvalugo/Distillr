import { query } from "./db";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
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
}): Promise<Tenant> {
  const id = generateTenantId();
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const rows = await query(
    `INSERT INTO tenants (id, name, slug, plan, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
    [id, data.name, slug, data.plan || "standard"],
  );
  return mapTenant(rows[0]);
}

export async function updateTenant(
  id: string,
  data: Partial<Omit<Tenant, "id" | "createdAt">>,
): Promise<Tenant> {
  const existing = await getTenantById(id);
  if (!existing) throw new Error("Tenant not found");
  const next = { ...existing, ...data };
  const rows = await query(
    `UPDATE tenants SET name = $2, slug = $3, plan = $4, status = $5 WHERE id = $1 RETURNING *`,
    [id, next.name, next.slug, next.plan, next.status],
  );
  return mapTenant(rows[0]);
}

export async function deleteTenant(id: string): Promise<void> {
  await query("DELETE FROM tenants WHERE id = $1", [id]);
}
