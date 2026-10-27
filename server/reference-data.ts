/**
 * Reference data: the per-workspace lists other records pick from.
 *
 *  - products           the distillery's catalog (drives every product picker)
 *  - storage_locations  racks, tanks and rooms (drives the location picker)
 *
 * Spirit types and class designations are regulatory and live in
 * shared/spirits.ts instead.
 *
 * This module also owns the one-time migration that replaced the original
 * customer's product-specific fields with generic ones:
 *  - production records: molasses / sugar / per-product yeast packets → ingredients[]
 *  - batch records:      a product-specific fruit field → variant
 */
import type { Express, NextFunction, Request, Response } from "express";
import { query } from "./db";
import { getCurrentTenantId } from "./tenant-context";
import {
  productInputSchema,
  storageLocationInputSchema,
  type Product,
  type ProductInput,
  type StorageLocation,
  type StorageLocationInput,
} from "../shared/reference";
import { spiritTypeForClass } from "../shared/spirits";

// ─── Schema ─────────────────────────────────────────────────────────────────

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

export async function migrateReferenceData(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      spirit_type TEXT,
      spirit_class TEXT,
      bottling_proof DOUBLE PRECISION,
      sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
      sku TEXT,
      tax_class TEXT,
      labels_per_bottle INTEGER,
      variants JSONB NOT NULL DEFAULT '[]'::jsonb,
      combine_barrel_aging BOOLEAN NOT NULL DEFAULT FALSE,
      recipe JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_name_key ON products (tenant_id, lower(name));

    CREATE TABLE IF NOT EXISTS storage_locations (
      tenant_id TEXT NOT NULL DEFAULT 'default',
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT,
      property_id TEXT,
      bonded BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS storage_locations_tenant_name_key ON storage_locations (tenant_id, lower(name));

    CREATE TABLE IF NOT EXISTS reference_backfills (
      tenant_id TEXT PRIMARY KEY,
      done_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS home_state TEXT;
    ALTER TABLE distilling_batch_records ADD COLUMN IF NOT EXISTS variant TEXT;
    ALTER TABLE distilling_production_records ADD COLUMN IF NOT EXISTS ingredients JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  // Inventory: rum-only raw-material categories → generic ones.
  await query(`
    UPDATE inventory_items SET category = 'Fermentables' WHERE category IN ('Molasses', 'Cane Sugar');
  `);
  const cfgRows = await query<{ tenant_id: string; inventory_loss_rates: string | null }>(
    `SELECT tenant_id, inventory_loss_rates FROM platform_config WHERE inventory_loss_rates LIKE '%Molasses%' OR inventory_loss_rates LIKE '%Cane Sugar%'`,
  );
  for (const row of cfgRows) {
    try {
      const rates = JSON.parse(row.inventory_loss_rates ?? "{}") as Record<string, number>;
      const ferm = rates["Fermentables"] ?? rates["Molasses"] ?? rates["Cane Sugar"];
      delete rates["Molasses"];
      delete rates["Cane Sugar"];
      if (ferm !== undefined) rates["Fermentables"] = ferm;
      if (rates["Botanicals & Flavorings"] === undefined) rates["Botanicals & Flavorings"] = 3;
      await query(`UPDATE platform_config SET inventory_loss_rates = $1 WHERE tenant_id = $2`, [JSON.stringify(rates), row.tenant_id]);
    } catch {
      /* leave unparseable config alone */
    }
  }

  // Batch: product-specific fruit → generic variant.
  if (await columnExists("distilling_batch_records", "pitorro_fruit")) {
    await query(`
      UPDATE distilling_batch_records SET variant = pitorro_fruit
       WHERE variant IS NULL AND pitorro_fruit IS NOT NULL AND pitorro_fruit <> '';
      ALTER TABLE distilling_batch_records DROP COLUMN pitorro_fruit;
    `);
  }

  // Production record: fixed ingredient columns → ingredients[].
  if (await columnExists("distilling_production_records", "gallons_molasses")) {
    await query(`
      UPDATE distilling_production_records r SET ingredients = COALESCE((
        SELECT jsonb_agg(item) FROM (
          SELECT jsonb_build_object('name', 'Molasses', 'quantity', r.gallons_molasses, 'unit', 'gal') AS item WHERE COALESCE(r.gallons_molasses, 0) > 0
          UNION ALL
          SELECT jsonb_build_object('name', 'Sugar', 'quantity', r.lbs_sugar, 'unit', 'lb') WHERE COALESCE(r.lbs_sugar, 0) > 0
          UNION ALL
          SELECT jsonb_build_object('name', 'Yeast', 'quantity', COALESCE(r.libertalia_yeast_packets, 0) + COALESCE(r.riskey_yeast_packets, 0), 'unit', 'packets')
           WHERE COALESCE(r.libertalia_yeast_packets, 0) + COALESCE(r.riskey_yeast_packets, 0) > 0
        ) s
      ), '[]'::jsonb)
      WHERE r.ingredients IS NULL OR r.ingredients = '[]'::jsonb;

      ALTER TABLE distilling_production_records
        DROP COLUMN IF EXISTS gallons_molasses,
        DROP COLUMN IF EXISTS lbs_sugar,
        DROP COLUMN IF EXISTS libertalia_yeast_packets,
        DROP COLUMN IF EXISTS riskey_yeast_packets;
    `);
  }
}

// ─── Mapping ────────────────────────────────────────────────────────────────

function jsonArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const txt = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v));

function mapProduct(r: Record<string, unknown>): Product {
  return {
    id: String(r.id),
    name: String(r.name),
    spiritType: txt(r.spirit_type),
    spiritClass: txt(r.spirit_class),
    bottlingProof: num(r.bottling_proof),
    sizes: jsonArray<string>(r.sizes),
    sku: txt(r.sku),
    taxClass: txt(r.tax_class),
    labelsPerBottle: num(r.labels_per_bottle) as number | null,
    variants: jsonArray<string>(r.variants),
    combineBarrelAging: r.combine_barrel_aging === true || r.combine_barrel_aging === "true",
    recipe: jsonArray(r.recipe),
    status: r.status === "retired" ? "retired" : "active",
    notes: txt(r.notes),
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapLocation(r: Record<string, unknown>): StorageLocation {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: txt(r.kind),
    propertyId: txt(r.property_id),
    bonded: r.bonded !== false && r.bonded !== "false",
    status: r.status === "retired" ? "retired" : "active",
    notes: txt(r.notes),
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const cleanList = (xs: string[] | undefined) =>
  Array.from(new Set((xs ?? []).map((s) => String(s).trim()).filter(Boolean)));

// ─── Backfill ───────────────────────────────────────────────────────────────

/**
 * First time a workspace opens its catalog, build it from the names already
 * used in its records so existing data keeps working. Runs once per tenant.
 */
export async function ensureBackfilled(tenantId: string): Promise<void> {
  const done = await query(`SELECT 1 FROM reference_backfills WHERE tenant_id = $1`, [tenantId]);
  if (done.length) return;
  await syncCatalog(tenantId);
  await query(`INSERT INTO reference_backfills (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [tenantId]);
}

/**
 * Adds any product name or storage location used in this workspace's records
 * that isn't in its catalog yet (e.g. after an import). Never changes or
 * removes existing catalog entries.
 */
export async function syncCatalog(tenantId: string): Promise<void> {
  const names = await query<{ name: string }>(
    `SELECT DISTINCT trim(product_name) AS name FROM (
        SELECT product_name FROM distilling_batch_records WHERE tenant_id = $1
        UNION ALL SELECT product_name FROM barrels WHERE tenant_id = $1
        UNION ALL SELECT product_name FROM distilling_inventory_records WHERE tenant_id = $1
        UNION ALL SELECT product_name FROM label_records WHERE tenant_id = $1
        UNION ALL SELECT product_name FROM cola_registrations WHERE tenant_id = $1
      ) s WHERE product_name IS NOT NULL AND trim(product_name) <> ''
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.tenant_id = $1 AND lower(p.name) = lower(trim(s.product_name)))`,
    [tenantId],
  );

  // Labels-per-bottle used to live in platform config keyed by (part of) a product name.
  let labelCounts: Record<string, number> = {};
  try {
    const cfg = await query<{ product_label_counts: string | null }>(
      `SELECT product_label_counts FROM platform_config WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    const raw = cfg[0]?.product_label_counts;
    if (raw) labelCounts = typeof raw === "string" ? JSON.parse(raw) : (raw as any);
  } catch {
    labelCounts = {};
  }

  const now = new Date().toISOString();
  const maxOrder = await query<{ m: number }>(`SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM products WHERE tenant_id = $1`, [tenantId]);
  let order = Number(maxOrder[0]?.m ?? -1) + 1;
  for (const { name } of names) {
    const stats = await query<Record<string, any>>(
      `SELECT
         mode() WITHIN GROUP (ORDER BY spirit_type) FILTER (WHERE spirit_type IS NOT NULL) AS spirit_type,
         mode() WITHIN GROUP (ORDER BY spirit_class) FILTER (WHERE spirit_class IS NOT NULL) AS spirit_class,
         mode() WITHIN GROUP (ORDER BY tax_class) FILTER (WHERE tax_class IS NOT NULL) AS tax_class,
         (array_agg(bottling_proof ORDER BY updated_at DESC) FILTER (WHERE bottling_proof > 0))[1] AS bottling_proof,
         bool_or(COALESCE(cases_750ml, 0) > 0) AS s750,
         bool_or(COALESCE(cases_1000ml, 0) > 0) AS s1000,
         bool_or(COALESCE(cases_1750ml, 0) > 0) AS s1750,
         array_remove(array_agg(DISTINCT variant), NULL) AS variants
       FROM distilling_batch_records WHERE tenant_id = $1 AND trim(product_name) = $2`,
      [tenantId, name],
    );
    const s = stats[0] ?? {};
    if (!s.spirit_class) {
      // Products known only from a label or COLA: take the class designation from there.
      const cls = await query<{ c: string | null }>(
        `SELECT mode() WITHIN GROUP (ORDER BY class_type) AS c FROM (
           SELECT class_type FROM label_records WHERE tenant_id = $1 AND trim(product_name) = $2 AND class_type IS NOT NULL
           UNION ALL SELECT class_type FROM cola_registrations WHERE tenant_id = $1 AND trim(product_name) = $2 AND class_type IS NOT NULL
         ) x`,
        [tenantId, name],
      );
      s.spirit_class = cls[0]?.c ?? null;
    }
    if (!s.spirit_type && s.spirit_class) s.spirit_type = spiritTypeForClass(s.spirit_class);
    const variants: string[] = cleanList(s.variants ?? []);
    const sizes = [s.s750 && "750ml", s.s1000 && "1000ml", s.s1750 && "1750ml"].filter(Boolean) as string[];
    const labelKey = Object.keys(labelCounts).find((k) => name.toLowerCase().includes(k.toLowerCase()));
    await query(
      `INSERT INTO products (tenant_id, id, name, spirit_type, spirit_class, bottling_proof, sizes, tax_class,
         labels_per_bottle, variants, combine_barrel_aging, status, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13,$13)
       ON CONFLICT DO NOTHING`,
      [
        tenantId, newId("PRD"), name, s.spirit_type ?? null, s.spirit_class ?? null, s.bottling_proof ?? null,
        JSON.stringify(sizes.length ? sizes : ["750ml"]), s.tax_class ?? null,
        labelKey ? Number(labelCounts[labelKey]) || null : null,
        JSON.stringify(variants),
        // Products whose batches recorded a variant at barreling were barreled and aged in one step.
        variants.length > 0,
        order++, now,
      ],
    );
  }

  const locs = await query<{ name: string }>(
    `SELECT DISTINCT trim(warehouse_zone) AS name FROM barrels
      WHERE tenant_id = $1 AND warehouse_zone IS NOT NULL AND trim(warehouse_zone) <> ''
        AND NOT EXISTS (SELECT 1 FROM storage_locations l WHERE l.tenant_id = $1 AND lower(l.name) = lower(trim(barrels.warehouse_zone)))`,
    [tenantId],
  );
  const maxLoc = await query<{ m: number }>(`SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM storage_locations WHERE tenant_id = $1`, [tenantId]);
  order = Number(maxLoc[0]?.m ?? -1) + 1;
  for (const { name } of locs) {
    await query(
      `INSERT INTO storage_locations (tenant_id, id, name, kind, bonded, status, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,NULL,TRUE,'active',$4,$5,$5) ON CONFLICT DO NOTHING`,
      [tenantId, newId("LOC"), name, order++, now],
    );
  }
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function listProducts(includeRetired: boolean): Promise<Product[]> {
  const tenantId = getCurrentTenantId();
  await ensureBackfilled(tenantId);
  const rows = await query(
    `SELECT * FROM products WHERE tenant_id = $1 ${includeRetired ? "" : "AND status = 'active'"}
      ORDER BY status = 'retired', sort_order, lower(name)`,
    [tenantId],
  );
  return rows.map(mapProduct);
}

async function getProduct(id: string): Promise<Product | null> {
  const rows = await query(`SELECT * FROM products WHERE id = $1 AND tenant_id = $2`, [id, getCurrentTenantId()]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

function productParams(p: ProductInput) {
  return [
    p.name.trim(),
    p.spiritType ?? null,
    p.spiritClass ?? null,
    p.bottlingProof ?? null,
    JSON.stringify(cleanList(p.sizes)),
    p.sku ?? null,
    p.taxClass ?? null,
    p.labelsPerBottle ?? null,
    JSON.stringify(cleanList(p.variants)),
    !!p.combineBarrelAging,
    JSON.stringify((p.recipe ?? []).filter((i) => i.name?.trim())),
    p.status ?? "active",
    p.notes ?? null,
    p.sortOrder ?? 0,
  ];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const tenantId = getCurrentTenantId();
  const now = new Date().toISOString();
  const rows = await query(
    `INSERT INTO products (tenant_id, id, name, spirit_type, spirit_class, bottling_proof, sizes, sku, tax_class,
       labels_per_bottle, variants, combine_barrel_aging, recipe, status, notes, sort_order, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING *`,
    [tenantId, newId("PRD"), ...productParams(input), now],
  );
  return mapProduct(rows[0]);
}

/** Product-name columns that follow a product rename. */
const PRODUCT_NAME_COLUMNS = ["distilling_batch_records", "barrels", "distilling_inventory_records", "label_records", "cola_registrations"];

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const existing = await getProduct(id);
  if (!existing) throw Object.assign(new Error("Product not found"), { status: 404 });
  const next = { ...existing, ...input, name: (input.name ?? existing.name).trim() } as ProductInput;
  const tenantId = getCurrentTenantId();
  const rows = await query(
    `UPDATE products SET name=$1, spirit_type=$2, spirit_class=$3, bottling_proof=$4, sizes=$5, sku=$6, tax_class=$7,
       labels_per_bottle=$8, variants=$9, combine_barrel_aging=$10, recipe=$11, status=$12, notes=$13, sort_order=$14,
       updated_at=$15
     WHERE id=$16 AND tenant_id=$17 RETURNING *`,
    [...productParams(next), new Date().toISOString(), id, tenantId],
  );
  if (next.name !== existing.name) {
    for (const table of PRODUCT_NAME_COLUMNS) {
      await query(`UPDATE ${table} SET product_name = $1 WHERE tenant_id = $2 AND trim(product_name) = $3`, [next.name, tenantId, existing.name]);
    }
  }
  return mapProduct(rows[0]);
}

export async function productUsage(name: string): Promise<number> {
  const tenantId = getCurrentTenantId();
  let total = 0;
  for (const table of PRODUCT_NAME_COLUMNS) {
    const r = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table} WHERE tenant_id = $1 AND trim(product_name) = $2`, [tenantId, name]);
    total += Number(r[0]?.n ?? 0);
  }
  return total;
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await getProduct(id);
  if (!existing) throw Object.assign(new Error("Product not found"), { status: 404 });
  const used = await productUsage(existing.name);
  if (used > 0) {
    throw Object.assign(new Error(`${existing.name} is used by ${used} record${used === 1 ? "" : "s"}. Retire it instead so history stays intact.`), { status: 409 });
  }
  await query(`DELETE FROM products WHERE id = $1 AND tenant_id = $2`, [id, getCurrentTenantId()]);
}

// ─── Storage locations ──────────────────────────────────────────────────────

export async function listLocations(includeRetired: boolean): Promise<StorageLocation[]> {
  const tenantId = getCurrentTenantId();
  await ensureBackfilled(tenantId);
  const rows = await query(
    `SELECT * FROM storage_locations WHERE tenant_id = $1 ${includeRetired ? "" : "AND status = 'active'"}
      ORDER BY status = 'retired', sort_order, lower(name)`,
    [tenantId],
  );
  return rows.map(mapLocation);
}

export async function createLocation(input: StorageLocationInput): Promise<StorageLocation> {
  const now = new Date().toISOString();
  const rows = await query(
    `INSERT INTO storage_locations (tenant_id, id, name, kind, property_id, bonded, status, notes, sort_order, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
    [getCurrentTenantId(), newId("LOC"), input.name.trim(), input.kind ?? null, input.propertyId ?? null,
     input.bonded ?? true, input.status ?? "active", input.notes ?? null, input.sortOrder ?? 0, now],
  );
  return mapLocation(rows[0]);
}

export async function updateLocation(id: string, input: Partial<StorageLocationInput>): Promise<StorageLocation> {
  const tenantId = getCurrentTenantId();
  const cur = await query(`SELECT * FROM storage_locations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!cur[0]) throw Object.assign(new Error("Location not found"), { status: 404 });
  const existing = mapLocation(cur[0]);
  const next = { ...existing, ...input, name: (input.name ?? existing.name).trim() };
  const rows = await query(
    `UPDATE storage_locations SET name=$1, kind=$2, property_id=$3, bonded=$4, status=$5, notes=$6, sort_order=$7, updated_at=$8
      WHERE id=$9 AND tenant_id=$10 RETURNING *`,
    [next.name, next.kind ?? null, next.propertyId ?? null, next.bonded, next.status, next.notes ?? null, next.sortOrder ?? 0,
     new Date().toISOString(), id, tenantId],
  );
  if (next.name !== existing.name) {
    await query(`UPDATE barrels SET warehouse_zone = $1 WHERE tenant_id = $2 AND trim(warehouse_zone) = $3`, [next.name, tenantId, existing.name]);
  }
  return mapLocation(rows[0]);
}

export async function deleteLocation(id: string): Promise<void> {
  const tenantId = getCurrentTenantId();
  const cur = await query<{ name: string }>(`SELECT name FROM storage_locations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!cur[0]) throw Object.assign(new Error("Location not found"), { status: 404 });
  const used = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM barrels WHERE tenant_id = $1 AND trim(warehouse_zone) = $2`, [tenantId, cur[0].name]);
  const n = Number(used[0]?.n ?? 0);
  if (n > 0) throw Object.assign(new Error(`${cur[0].name} holds ${n} barrel${n === 1 ? "" : "s"}. Retire it instead.`), { status: 409 });
  await query(`DELETE FROM storage_locations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

function signedIn(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) return res.status(401).json({ error: "Authentication required" });
  next();
}
function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) return res.status(401).json({ error: "Authentication required" });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

function fail(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string; code?: string; issues?: { message: string }[] };
  if (e?.code === "23505") return res.status(409).json({ error: "That name is already in use." });
  if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message ?? "Invalid input" });
  return res.status(e?.status ?? 500).json({ error: e?.message ?? "Request failed" });
}

export function registerReferenceRoutes(app: Express) {
  app.get("/api/products", signedIn, async (req, res) => {
    try { res.json(await listProducts(req.query.all === "1")); } catch (e) { fail(res, e); }
  });
  // Any signed-in user may add a product from a picker; editing and removal are admin tasks.
  app.post("/api/products", signedIn, async (req, res) => {
    try { res.status(201).json(await createProduct(productInputSchema.parse(req.body))); } catch (e) { fail(res, e); }
  });
  app.patch("/api/products/:id", adminOnly, async (req, res) => {
    try { res.json(await updateProduct(req.params.id, productInputSchema.partial().parse(req.body))); } catch (e) { fail(res, e); }
  });
  app.delete("/api/products/:id", adminOnly, async (req, res) => {
    try { await deleteProduct(req.params.id); res.status(204).end(); } catch (e) { fail(res, e); }
  });

  app.get("/api/storage-locations", signedIn, async (req, res) => {
    try { res.json(await listLocations(req.query.all === "1")); } catch (e) { fail(res, e); }
  });
  app.post("/api/storage-locations", signedIn, async (req, res) => {
    try { res.status(201).json(await createLocation(storageLocationInputSchema.parse(req.body))); } catch (e) { fail(res, e); }
  });
  app.patch("/api/storage-locations/:id", adminOnly, async (req, res) => {
    try { res.json(await updateLocation(req.params.id, storageLocationInputSchema.partial().parse(req.body))); } catch (e) { fail(res, e); }
  });
  app.delete("/api/storage-locations/:id", adminOnly, async (req, res) => {
    try { await deleteLocation(req.params.id); res.status(204).end(); } catch (e) { fail(res, e); }
  });
}
