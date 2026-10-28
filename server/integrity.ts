import { platformQuery } from "./db";
import { listTenantFileScopes } from "./file-storage";

/**
 * Read-only snapshot of tenant separation, straight from the database catalog.
 * Nothing here writes. Used by the admin panel's "Data check" view.
 */
export async function buildIntegrityReport() {
  const tenants = await platformQuery<{ id: string; name: string; slug: string; status: string; schema_name: string | null; schema_version: number; created_at: string }>(
    `SELECT id, name, slug, status, schema_name, schema_version, created_at FROM tenants ORDER BY created_at`,
  );
  const tenantIds = new Set(tenants.map((t) => t.id));

  const schemas = await platformQuery<{ schema_name: string }>(
    `SELECT nspname AS schema_name FROM pg_namespace WHERE nspname LIKE 'tenant\\_%' ORDER BY 1`,
  );
  const schemaSet = new Set(schemas.map((s) => s.schema_name));

  // Row counts per tenant schema (exact counts; tables are small).
  const tables = await platformQuery<{ schema_name: string; table_name: string }>(
    `SELECT n.nspname AS schema_name, c.relname AS table_name
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname LIKE 'tenant\\_%' AND c.relkind = 'r' ORDER BY 1, 2`,
  );
  const rowsBySchema = new Map<string, { total: number; foreignRows: number; tables: Record<string, number> }>();
  for (const { schema_name, table_name } of tables) {
    const q = `"${schema_name.replace(/"/g, '""')}"."${table_name.replace(/"/g, '""')}"`;
    const owner = tenants.find((t) => t.schema_name === schema_name)?.id ?? null;
    const hasTenantCol = (await platformQuery(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = 'tenant_id'`,
      [schema_name, table_name],
    )).length > 0;
    const [{ n }] = await platformQuery<{ n: number }>(`SELECT count(*)::int AS n FROM ${q}`);
    let foreign = 0;
    if (hasTenantCol && owner) {
      foreign = (await platformQuery<{ n: number }>(`SELECT count(*)::int AS n FROM ${q} WHERE tenant_id <> $1`, [owner]))[0].n;
    }
    const entry = rowsBySchema.get(schema_name) ?? { total: 0, foreignRows: 0, tables: {} };
    entry.total += n;
    entry.foreignRows += foreign;
    if (n) entry.tables[table_name] = n;
    rowsBySchema.set(schema_name, entry);
  }

  const users = await platformQuery<{ tenant_id: string; n: number }>(`SELECT tenant_id, count(*)::int AS n FROM users GROUP BY 1`);
  const usersByTenant = new Map(users.map((u) => [u.tenant_id, u.n]));
  const dupEmails = await platformQuery<{ email: string; n: number }>(
    `SELECT lower(email) AS email, count(*)::int AS n FROM users GROUP BY 1 HAVING count(*) > 1`,
  );

  const sessions = await platformQuery<{ tenant_id: string | null; n: number }>(
    `SELECT (sess::jsonb -> 'user' ->> 'tenantId') AS tenant_id, count(*)::int AS n
     FROM "session" WHERE expire > NOW() GROUP BY 1`,
  );

  const orphanRows = async (table: string) =>
    (await platformQuery<{ tenant_id: string; n: number }>(
      `SELECT tenant_id, count(*)::int AS n FROM ${table} WHERE tenant_id NOT IN (SELECT id FROM tenants) GROUP BY 1`,
    ).catch(() => []));

  const legacyTables = await platformQuery<{ table_name: string }>(
    `SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'legacy\\_%' ORDER BY 1`,
  );
  const legacyOrphans: Record<string, Record<string, number>> = {};
  for (const { table_name } of legacyTables) {
    const hasTenantCol = (await platformQuery(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`, [table_name],
    )).length > 0;
    if (!hasTenantCol) continue;
    for (const { tenant_id, n } of await orphanRows(`public."${table_name}"`)) {
      (legacyOrphans[tenant_id] ??= {})[table_name] = n;
    }
  }

  let fileScopes: string[] | null = null;
  try {
    fileScopes = await listTenantFileScopes();
  } catch {
    fileScopes = null;
  }
  const scopeOf = (id: string) => id.replace(/[^A-Za-z0-9._-]/g, "_");
  const liveScopes = new Set(tenants.map((t) => scopeOf(t.id)));

  const deletions = await platformQuery(
    `SELECT tenant_id, tenant_name, tenant_slug, schema_name, deleted_at, deleted_by, details
     FROM tenant_deletions ORDER BY deleted_at DESC LIMIT 100`,
  ).catch(() => []);

  const tenantRows = tenants.map((t) => {
    const data = t.schema_name ? rowsBySchema.get(t.schema_name) : undefined;
    return {
      id: t.id, name: t.name, slug: t.slug, status: t.status,
      schema: t.schema_name,
      schemaExists: !!t.schema_name && schemaSet.has(t.schema_name),
      users: usersByTenant.get(t.id) ?? 0,
      records: data?.total ?? 0,
      recordsByTable: data?.tables ?? {},
      foreignRows: data?.foreignRows ?? 0,
    };
  });

  const leftovers = {
    schemasWithoutTenant: schemas.map((s) => s.schema_name).filter((n) => !tenants.some((t) => t.schema_name === n)),
    usersWithoutTenant: users.filter((u) => !tenantIds.has(u.tenant_id)).map((u) => ({ tenantId: u.tenant_id, users: u.n })),
    sessionsWithoutTenant: sessions.filter((x) => x.tenant_id && !tenantIds.has(x.tenant_id)).map((x) => ({ tenantId: x.tenant_id, sessions: x.n })),
    setupTokensWithoutTenant: await orphanRows("password_setup_tokens"),
    activityLogWithoutTenant: await orphanRows("tenant_activity_logs"),
    fileFoldersWithoutTenant: fileScopes === null ? null : fileScopes.filter((s) => !liveScopes.has(s)),
    legacyBackupRowsWithoutTenant: legacyOrphans,
  };

  const problems: string[] = [];
  for (const t of tenantRows) {
    if (!t.schemaExists) problems.push(`${t.name}: private data section missing`);
    if (t.foreignRows) problems.push(`${t.name}: ${t.foreignRows} rows belonging to another tenant`);
  }
  if (leftovers.schemasWithoutTenant.length) problems.push(`${leftovers.schemasWithoutTenant.length} data section(s) with no tenant`);
  if (leftovers.usersWithoutTenant.length) problems.push(`users left from deleted tenants`);
  if (leftovers.sessionsWithoutTenant.length) problems.push(`active sign-ins for deleted tenants`);
  if (leftovers.setupTokensWithoutTenant.length) problems.push(`password links for deleted tenants`);
  if (leftovers.fileFoldersWithoutTenant?.length) problems.push(`stored files for deleted tenants`);
  if (dupEmails.length) problems.push(`${dupEmails.length} email(s) used by more than one account`);

  return {
    checkedAt: new Date().toISOString(),
    ok: problems.length === 0,
    problems,
    notes: [
      ...(Object.keys(legacyOrphans).length
        ? ["Rows from tenants deleted before the separation remain only in the read-only legacy_* backup tables (not reachable by any login)."]
        : []),
      ...(fileScopes === null ? ["Stored files could not be listed in this environment."] : []),
    ],
    tenants: tenantRows,
    leftovers,
    duplicateEmails: dupEmails,
    deletions,
  };
}
