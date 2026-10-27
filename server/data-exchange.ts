/**
 * Full data export / import template / bulk import.
 *
 * One branded workbook: an Information cover sheet plus one sheet per table.
 * Every sheet has the same shape so the importer can read what the exporter
 * writes:
 *
 *   row 1   title band      "Distillr · <Table>"
 *   row 2   subtitle        org · date · record count (or template note)
 *   row 3   (blank)
 *   row 4   header          readable labels, e.g. "Batch Code" (← batch_code)
 *   row 5   hints           "# …" guidance per column, ignored on import
 *   row 6+  data
 *
 * Everything is scoped to the current tenant: exports only read the
 * organization's rows, and imports stamp the organization's tenant_id.
 */
import ExcelJS from "exceljs";
import { query, pool } from "./db";
import { getCurrentTenantId, runWithTenant } from "./tenant-context";
import { DISTILLR_MARK_PNG_BASE64 } from "./reports/brand-mark";

// Order matters: reference data first so later sheets can refer to it on import.
export const EXPORTABLE_TABLES: Record<string, string> = {
  products: "products",
  storage_locations: "storage_locations",
  batches: "distilling_batch_records",
  barrels: "barrels",
  barrel_events: "barrel_events",
  production_records: "distilling_production_records",
  inventory_records: "distilling_inventory_records",
  inventory_items: "inventory_items",
  inventory_lots: "inventory_lots",
  inventory_movements: "inventory_movements",
  compliance: "compliance",
  clients: "clients",
  properties: "properties",
  sales_orders: "sales_orders",
  staff: "staff",
  ttb_reports: "ttb_reports",
  audit_logs: "audit_logs",
  permits: "permits",
  cola_registrations: "cola_registrations",
  label_records: "label_records",
  state_excise_returns: "state_excise_returns",
  equipment: "distillery_equipment",
  calculator_presets: "calculator_presets",
};

export const TAB_LABELS: Record<string, string> = {
  products: "Products",
  storage_locations: "Storage Locations",
  batches: "Production Batches",
  barrels: "Barrels",
  barrel_events: "Barrel Events",
  production_records: "Production Records",
  inventory_records: "Inventory Records",
  inventory_items: "Inventory Items",
  inventory_lots: "Inventory Lots",
  inventory_movements: "Inventory Movements",
  compliance: "Compliance",
  clients: "Clients",
  properties: "Properties",
  sales_orders: "Sales Orders",
  staff: "Staff",
  ttb_reports: "TTB Reports",
  audit_logs: "Audit Log",
  permits: "Permits",
  cola_registrations: "COLA Registrations",
  label_records: "Label Records",
  state_excise_returns: "State Excise Returns",
  equipment: "Distillery Equipment",
  calculator_presets: "Calculator Presets",
};

/** Sheet tab → table name (import). Also accepts the older label for excise returns. */
export const LABEL_TO_TABLE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TAB_LABELS).map(([k, label]) => [label, EXPORTABLE_TABLES[k]])),
  "FL Excise Returns": "state_excise_returns",
};

export const IMPORT_BLOCKED = new Set(["audit_logs"]);

/** ID prefixes the app uses, so imported rows look like app-created ones. */
const ID_PREFIX: Record<string, string> = {
  products: "PRD", storage_locations: "LOC",
  distilling_batch_records: "DBATCH", barrels: "BARREL", barrel_events: "BEVT",
  distilling_production_records: "DPROD", distilling_inventory_records: "DINV",
  inventory_items: "INV", inventory_lots: "LOT", inventory_movements: "MOVE", compliance: "COMP",
  clients: "PARTNER", properties: "FAC", sales_orders: "SO", staff: "TEAM", ttb_reports: "TTP",
  permits: "PRMT", cola_registrations: "COLA", label_records: "LBL", state_excise_returns: "SER",
  distillery_equipment: "EQ", calculator_presets: "PRESET",
};
function newId(tableName: string): string {
  return `${ID_PREFIX[tableName] ?? "REC"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Columns that are the system's, never the customer's. */
const HIDDEN_COLS = new Set(["tenant_id"]);

/** Every exportable table holds one workspace's data; exporting any of them unfiltered is a bug. */
const TENANT_SCOPED_REQUIRED = new Set(Object.values(EXPORTABLE_TABLES));
const SYSTEM_COLS = new Set(["created_at", "updated_at"]);

const ACRONYMS: Record<string, string> = {
  id: "ID", ttb: "TTB", abv: "ABV", dsp: "DSP", ein: "EIN", cola: "COLA", url: "URL", fl: "FL",
  sku: "SKU", upc: "UPC", po: "PO", pg: "PG", pdf: "PDF", api: "API", ip: "IP", json: "JSON", ml: "mL", rn: "RN",
};

/** batch_code → "Batch Code"; proof_gallons → "Proof Gallons"; dsp_number → "DSP Number". */
export function labelFor(col: string): string {
  return col
    .split("_")
    .filter(Boolean)
    .map((w) => ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "Batch Code" → batch_code (inverse of labelFor; also accepts raw column names). */
export function columnFor(label: string): string {
  return String(label).trim().replace(/\s+/g, "_").toLowerCase();
}

export function columnHint(col: string): string {
  if (col === "id") return "# leave blank for new records; keep the ID to update an existing one";
  if (col === "spirit_type") return "# whiskey | brandy | rum | gin | vodka | neutral | agave | liqueur | other";
  if (col === "spirit_class") return "# class designation, e.g. Straight Bourbon Whiskey";
  if (col === "sizes") return '# JSON list, e.g. ["750ml","1000ml"]';
  if (col === "variants") return '# JSON list of styles, e.g. ["Original","Cask Strength"]';
  if (col === "recipe" || col === "ingredients") return '# JSON, e.g. [{"name":"Corn","quantity":900,"unit":"lb"}]';
  if (col === "combine_barrel_aging") return "# TRUE if barreled and aged in one step";
  if (col === "bonded") return "# TRUE or FALSE";
  if (col === "variant") return "# one of the product's variants";
  if (col === "product_name") return "# must match a name on the Products sheet";
  if (col === "warehouse_zone") return "# a name from the Storage Locations sheet";
  if (col === "stage") return "# planning | mash_fermentation | distillation | barreling | aging | bottling | closed";
  if (col === "status") return "# status value as shown in the app";
  if (col === "event_type") return "# gauge | temperature | dump | fill | sample | topoff";
  if (col === "tax_class") return "# craft_tier1 | craft_tier2 | standard";
  if (col === "movement_type") return "# receipt | usage | adjustment | transfer | loss";
  if (col === "type" || col === "zone") return "# value as shown in the app";
  if (col.endsWith("_at") || col.endsWith("_date") || col === "event_at" || col === "performed_at") return "# date — YYYY-MM-DD";
  if (col.endsWith("_month")) return "# YYYY-MM";
  if (col.endsWith("_id")) return "# ID of the related record";
  if (col === "metadata" || col.endsWith("_made") || col.endsWith("_items") || col === "parameters" || col === "payload" || col.endsWith("_counts"))
    return '# JSON, e.g. {"750ml":10,"1000ml":5}';
  if (col.includes("proof") || col.includes("abv") || col.includes("gallons") || col.includes("volume") || col.includes("capacity") || col.includes("amount") || col.includes("price") || col.includes("cost"))
    return "# number (decimal point, no commas)";
  if (col.includes("cases") || col.includes("bottles") || col.includes("count") || col.includes("qty") || col.includes("quantity")) return "# whole number";
  if (col.startsWith("is_") || col.startsWith("has_")) return "# TRUE or FALSE";
  return "";
}

type ColumnMeta = { name: string; dataType: string };

async function tableColumns(tableName: string): Promise<ColumnMeta[]> {
  const rows = await query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tableName],
  );
  return rows.map((r: any) => ({ name: String(r.column_name), dataType: String(r.data_type) }));
}

function tenantClause(cols: ColumnMeta[], tenantId: string, params: unknown[]): string {
  if (!cols.some((c) => c.name === "tenant_id")) return "";
  params.push(tenantId);
  return `WHERE tenant_id = $${params.length}`;
}

export async function fetchTableRows(tableName: string, _cols?: ColumnMeta[]): Promise<Record<string, unknown>[]> {
  const tenantId = getCurrentTenantId();
  // Always decide the tenant filter from the table's real columns — callers pass
  // a display list with tenant_id hidden, which must never drop the filter.
  const cols = await tableColumns(tableName);
  const params: unknown[] = [];
  const where = tenantClause(cols, tenantId, params);
  if (!where && TENANT_SCOPED_REQUIRED.has(tableName)) {
    throw new Error(`Refusing to export ${tableName} without a workspace filter`);
  }
  const order = cols.some((c) => c.name === "created_at") ? "ORDER BY created_at ASC NULLS LAST" : "";
  return query(`SELECT * FROM ${tableName} ${where} ${order}`, params) as Promise<Record<string, unknown>[]>;
}

export async function countTableRows(tableName: string): Promise<number> {
  const cols = await tableColumns(tableName);
  const tenantId = getCurrentTenantId();
  const params: unknown[] = [];
  const where = tenantClause(cols, tenantId, params);
  const rows = await query(`SELECT COUNT(*)::int AS n FROM ${tableName} ${where}`, params);
  return Number((rows[0] as any)?.n ?? 0);
}

// ─── Workbook styling ───────────────────────────────────────────────────────

const INDIGO = "FF4F46E5";
const INDIGO_SOFT = "FFEEF2FF";
const NIGHT = "FF0B0D12";
const INK = "FF0F172A";
const SOFT = "FF64748B";
const MUTED = "FF94A3B8";
const RULE = "FFE2E8F0";
const ZEBRA = "FFF8FAFC";
const WHITE = "FFFFFFFF";

const HEADER_ROW = 4;
const HINT_ROW = 5;
const FIRST_DATA_ROW = 6;

function cellOut(v: unknown, dataType: string): ExcelJS.CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (/^(numeric|integer|bigint|double|real|smallint|decimal)/.test(dataType)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  return String(v);
}

function titleBand(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, title: string, subtitle: string, width: number) {
  const span = Math.max(width, 6);
  ws.mergeCells(1, 1, 1, span);
  ws.mergeCells(2, 1, 2, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NIGHT } };
  t.alignment = { vertical: "middle", indent: 4 };
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: "Calibri", size: 10, color: { argb: "FFC7D2FE" } };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NIGHT } };
  s.alignment = { vertical: "middle", indent: 4 };
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 8;
  const imageId = wb.addImage({ base64: DISTILLR_MARK_PNG_BASE64, extension: "png" });
  ws.addImage(imageId, { tl: { col: 0.08, row: 0.22 }, ext: { width: 26, height: 26 } });
}

function styleHeader(ws: ExcelJS.Worksheet, cols: string[]) {
  const row = ws.getRow(HEADER_ROW);
  row.height = 22;
  cols.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = labelFor(c);
    cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = { right: { style: "thin", color: { argb: "FF6366F1" } } };
  });
  const hint = ws.getRow(HINT_ROW);
  hint.height = 16;
  cols.forEach((c, i) => {
    const cell = hint.getCell(i + 1);
    const h = columnHint(c);
    cell.value = i === 0 && !h ? "#" : h;
    cell.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO_SOFT } };
    cell.alignment = { vertical: "middle", indent: 1 };
  });
  ws.views = [{ state: "frozen", ySplit: HINT_ROW, xSplit: 0 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}` };
  ws.headerFooter = { oddFooter: "&L&8Prepared with Distillr&R&8Page &P of &N" };
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: cols.length } };
}

function fitColumns(ws: ExcelJS.Worksheet, cols: ColumnMeta[], rows: Record<string, unknown>[]) {
  cols.forEach((c, i) => {
    const label = labelFor(c.name).length;
    const hint = Math.min(columnHint(c.name).length, 36);
    let longest = Math.max(label, hint, 8);
    for (const r of rows.slice(0, 200)) {
      const v = r[c.name];
      const len = v == null ? 0 : v instanceof Date ? 10 : String(typeof v === "object" ? JSON.stringify(v) : v).length;
      if (len > longest) longest = len;
    }
    const col = ws.getColumn(i + 1);
    col.width = Math.min(Math.max(longest + 3, 10), 48);
    if (/^(timestamp|date)/.test(c.dataType)) col.numFmt = "yyyy-mm-dd";
    else if (/^(numeric|double|real|decimal)/.test(c.dataType)) col.numFmt = "#,##0.00##";
    else if (/^(integer|bigint|smallint)/.test(c.dataType)) col.numFmt = "#,##0";
  });
}

function writeRows(ws: ExcelJS.Worksheet, cols: ColumnMeta[], rows: Record<string, unknown>[]) {
  rows.forEach((r, idx) => {
    const row = ws.getRow(FIRST_DATA_ROW + idx);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = cellOut(r[c.name], c.dataType);
      cell.font = { name: "Calibri", size: 10, color: { argb: INK } };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = { bottom: { style: "hair", color: { argb: RULE } } };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    row.height = 17;
  });
}

function infoSheet(
  wb: ExcelJS.Workbook,
  opts: { org: string; date: string; template: boolean; sheets: { label: string; count: number }[] },
) {
  const ws = wb.addWorksheet("Information", { properties: { tabColor: { argb: INDIGO } } });
  ws.columns = [{ width: 4 }, { width: 34 }, { width: 18 }, { width: 70 }];
  titleBand(ws, wb, opts.template ? "Distillr · Import Template" : "Distillr · Full Data Export", `${opts.org} · ${opts.date}`, 4);

  let r = 5;
  const h = (text: string) => {
    const c = ws.getCell(r, 2);
    c.value = text;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: INDIGO } };
    ws.getRow(r).height = 22;
    r++;
  };
  const p = (text: string, muted = false) => {
    ws.mergeCells(r, 2, r, 4);
    const c = ws.getCell(r, 2);
    c.value = text;
    c.font = { name: "Calibri", size: 10, color: { argb: muted ? SOFT : INK } };
    c.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = text.length > 95 ? 30 : 16;
    r++;
  };

  h(opts.template ? "How to use this template" : "About this file");
  if (opts.template) {
    p("Fill in one row per record under the blue header on each sheet. The grey hint row explains the format each column expects — leave it in place; the importer ignores it.");
    p("Leave ID blank for new records. Keep an existing ID to update that record instead of creating a new one.");
    p("Keep the sheet names as they are: the importer matches each sheet to a table by name. Sheets you don't need can stay empty.");
    p("Dates are YYYY-MM-DD. Numbers use a decimal point, no thousands separators. JSON columns take a JSON object as text.");
    p("The Audit Log sheet is read-only and is skipped on import.");
  } else {
    p(`Every record in ${opts.org}'s workspace, one sheet per table, as of ${opts.date}. Column headers are readable names; hover a column's hint row for the expected format.`);
    p("This file doubles as an import file: edit rows (keeping their IDs) or add new rows with a blank ID, then upload it under Settings → Data Management → Import.");
    p("The Audit Log sheet is read-only and is skipped on import.");
  }
  r++;
  h("Sheets in this workbook");
  const head = ws.getRow(r);
  [["Sheet", 2], [opts.template ? "" : "Records", 3], ["What it holds", 4]].forEach(([label, col]) => {
    const c = head.getCell(col as number);
    c.value = label as string;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: SOFT } };
    c.border = { bottom: { style: "thin", color: { argb: RULE } } };
  });
  r++;
  const DESCRIPTIONS: Record<string, string> = {
    "Products": "Your catalog: every product with its spirit class, proof, sizes, variants and recipe. Fill this first.",
    "Storage Locations": "Rickhouses, racks, tanks and rooms barrels can be stored in.",
    "Production Batches": "Each batch from mash to bottle, with stage, proof gallons and case counts.",
    "Barrels": "Cooperage on hand: fill date, size, location, current proof and contents.",
    "Barrel Events": "Gauges, samples, top-offs and dumps logged against barrels.",
    "Production Records": "Weekly distilling output: gallons, proof gallons, product.",
    "Inventory Records": "Weekly stock positions by product and size.",
    "Inventory Items": "Raw materials, packaging and finished-goods SKUs.",
    "Inventory Lots": "Lots received for each inventory item.",
    "Inventory Movements": "Receipts, usage, adjustments and transfers.",
    "Compliance": "Compliance tasks and filings with due dates and status.",
    "Clients": "Distributors, retailers and other trading partners.",
    "Properties": "Facilities, bonded premises and locations.",
    "Sales Orders": "Orders with line items, channel and fulfilment status.",
    "Staff": "Team members and roles.",
    "TTB Reports": "Generated monthly operations and excise reports.",
    "Audit Log": "System activity log (read-only).",
    "Permits": "Federal and state permits with expiry dates.",
    "COLA Registrations": "Label approvals on file.",
    "Label Records": "Label versions and print counts.",
    "State Excise Returns": "State excise filings and amounts.",
    "Distillery Equipment": "Stills, tanks and equipment placed on the floor plan.",
    "Calculator Presets": "Saved proofing and blending presets.",
  };
  for (const s of opts.sheets) {
    const row = ws.getRow(r);
    row.getCell(2).value = s.label;
    row.getCell(2).font = { name: "Calibri", size: 10, color: { argb: INK } };
    if (!opts.template) {
      row.getCell(3).value = s.count;
      row.getCell(3).numFmt = "#,##0";
      row.getCell(3).font = { name: "Calibri", size: 10, color: { argb: INK } };
      row.getCell(3).alignment = { horizontal: "left" };
    }
    row.getCell(4).value = DESCRIPTIONS[s.label] ?? "";
    row.getCell(4).font = { name: "Calibri", size: 10, color: { argb: SOFT } };
    row.height = 16;
    r++;
  }
  r++;
  p("Prepared with Distillr · distillrsoftware.com", true);
  ws.views = [{ showGridLines: false }];
}

export async function buildWorkbook(opts: { org: string; template: boolean }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Distillr";
  wb.created = new Date();
  const date = new Date().toISOString().slice(0, 10);

  const sheets: { label: string; count: number; cols: ColumnMeta[]; rows: Record<string, unknown>[] }[] = [];
  for (const [key, tableName] of Object.entries(EXPORTABLE_TABLES)) {
    const cols = (await tableColumns(tableName)).filter((c) => !HIDDEN_COLS.has(c.name));
    const rows = opts.template ? [] : await fetchTableRows(tableName, cols);
    sheets.push({ label: TAB_LABELS[key] ?? key, count: rows.length, cols, rows });
  }

  infoSheet(wb, { org: opts.org, date, template: opts.template, sheets });

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.label, { properties: { tabColor: { argb: s.rows.length ? INDIGO : "FFC7D2FE" } } });
    const names = s.cols.map((c) => c.name);
    titleBand(
      ws, wb,
      `Distillr · ${s.label}`,
      opts.template ? `${opts.org} · import template · fill rows below the hint row` : `${opts.org} · exported ${date} · ${s.count.toLocaleString()} record${s.count === 1 ? "" : "s"}`,
      names.length,
    );
    styleHeader(ws, names);
    fitColumns(ws, s.cols, s.rows);
    writeRows(ws, s.cols, s.rows);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function csvForTable(cols: ColumnMeta[], rows: Record<string, unknown>[]): string {
  const names = cols.map((c) => c.name);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [names.map(labelFor).join(","), ...rows.map((r) => names.map((n) => esc(r[n])).join(","))].join("\n") + "\n";
}

export async function exportTableColumns(tableName: string): Promise<ColumnMeta[]> {
  return (await tableColumns(tableName)).filter((c) => !HIDDEN_COLS.has(c.name));
}

// ─── Import ─────────────────────────────────────────────────────────────────

export type ImportResult = { sheet: string; table: string; inserted: number; updated: number; skipped: number; errors: string[] };

function cellIn(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return v.result ?? null;
    if ("text" in v) return v.text;
    if ("hyperlink" in v) return (v as any).text ?? (v as any).hyperlink;
    return String(v);
  }
  return v;
}

/** Finds the header row: the first row where most non-empty cells map to real columns. */
function findHeaderRow(ws: ExcelJS.Worksheet, validCols: Set<string>): number | null {
  const limit = Math.min(ws.rowCount, 12);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    let total = 0, hits = 0;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cellIn(cell.value);
      if (v == null || String(v).trim() === "") return;
      total++;
      if (validCols.has(columnFor(String(v)))) hits++;
    });
    if (total >= 1 && hits / total >= 0.6 && hits >= Math.min(2, validCols.size)) return r;
  }
  return null;
}

/**
 * Removes drawings (logos, images, shapes) from an .xlsx so exceljs can parse
 * files saved by apps whose drawing anchors it doesn't understand. Cell data
 * is untouched.
 */
async function stripDrawings(buffer: Buffer): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  for (const name of names) {
    if (/^xl\/(drawings|media)\//.test(name)) zip.remove(name);
  }
  for (const name of names) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<drawing\b[^>]*\/>/g, "").replace(/<legacyDrawing\b[^>]*\/>/g, ""));
    }
    if (/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<Relationship\b[^>]*Type="[^"]*\/drawing"[^>]*\/>/g, ""));
    }
    if (name === "[Content_Types].xml") {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<Override\b[^>]*PartName="\/xl\/drawings\/[^"]*"[^>]*\/>/g, ""));
    }
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function importWorkbook(buffer: Buffer): Promise<ImportResult[]> {
  const tenantId = getCurrentTenantId();
  let wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await stripDrawings(buffer)) as any);
  }
  // The zip/stream parsing above can drop the AsyncLocalStorage context, so re-enter it.
  return runWithTenant(tenantId, () => importSheets(wb, tenantId));
}

/**
 * IDs are unique across every workspace. When a file carries IDs that already
 * belong to another workspace (a shared sample, or a copy of someone else's
 * export), those rows get fresh IDs here, and every cell elsewhere in the file
 * that pointed at the old ID is rewritten to the new one.
 */
async function planIdRemap(wb: ExcelJS.Workbook, tenantId: string): Promise<Map<string, string>> {
  const remap = new Map<string, string>();
  for (const ws of wb.worksheets) {
    const tableName = LABEL_TO_TABLE[ws.name];
    if (!tableName) continue;
    const meta = await tableColumns(tableName);
    const validCols = new Set(meta.map((c) => c.name));
    if (!validCols.has("id") || !validCols.has("tenant_id")) continue;
    const headerRow = findHeaderRow(ws, validCols);
    if (!headerRow) continue;
    let idCol = 0;
    ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, idx) => {
      if (columnFor(String(cellIn(cell.value) ?? "")) === "id") idCol = idx;
    });
    if (!idCol) continue;
    const ids: string[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const v = cellIn(ws.getRow(r).getCell(idCol).value);
      if (v != null && String(v).trim() && !String(v).trim().startsWith("#")) ids.push(String(v).trim());
    }
    if (!ids.length) continue;
    const taken = await query<{ id: string }>(
      `SELECT id FROM ${tableName} WHERE id = ANY($1::text[]) AND tenant_id <> $2`,
      [ids, tenantId],
    );
    for (const { id } of taken) {
      if (!remap.has(id)) remap.set(id, newId(tableName));
    }
  }
  return remap;
}

async function importSheets(wb: ExcelJS.Workbook, tenantId: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const remap = await planIdRemap(wb, tenantId);

  for (const ws of wb.worksheets) {
    const sheetName = ws.name;
    if (sheetName === "Information") continue;
    const tableName = LABEL_TO_TABLE[sheetName];
    if (!tableName) {
      results.push({ sheet: sheetName, table: "—", inserted: 0, updated: 0, skipped: 0, errors: [`Unknown sheet "${sheetName}" — skipped`] });
      continue;
    }
    const key = Object.keys(EXPORTABLE_TABLES).find((k) => EXPORTABLE_TABLES[k] === tableName)!;
    if (IMPORT_BLOCKED.has(key)) {
      results.push({ sheet: sheetName, table: tableName, inserted: 0, updated: 0, skipped: 0, errors: ["Read-only table — skipped"] });
      continue;
    }

    const meta = await tableColumns(tableName);
    const validCols = new Set(meta.map((c) => c.name));
    const hasTenant = validCols.has("tenant_id");
    const hasId = validCols.has("id");
    const hasCreated = validCols.has("created_at");
    const hasUpdated = validCols.has("updated_at");

    const headerRow = findHeaderRow(ws, validCols);
    if (!headerRow) {
      results.push({ sheet: sheetName, table: tableName, inserted: 0, updated: 0, skipped: 0, errors: ws.rowCount > 0 ? ["Could not find the column header row — skipped"] : [] });
      continue;
    }
    const colByIndex: Record<number, string> = {};
    ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, idx) => {
      const v = cellIn(cell.value);
      if (v == null) return;
      const name = columnFor(String(v));
      if (validCols.has(name) && !HIDDEN_COLS.has(name) && !SYSTEM_COLS.has(name)) colByIndex[idx] = name;
    });

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const record: Record<string, unknown> = {};
      let any = false;
      let isHint = false;
      row.eachCell({ includeEmpty: false }, (cell, idx) => {
        const name = colByIndex[idx];
        const v = cellIn(cell.value);
        if (typeof v === "string" && v.trim().startsWith("#")) isHint = true;
        if (!name) return;
        if (v === null || (typeof v === "string" && v.trim() === "")) return;
        const clean = typeof v === "string" ? v.trim() : v;
        record[name] = typeof clean === "string" && remap.has(clean) ? remap.get(clean)! : clean;
        any = true;
      });
      if (!any) continue;
      if (isHint && Object.values(record).every((v) => typeof v === "string" && v.startsWith("#"))) continue;

      try {
        const id = hasId ? record["id"] : undefined;
        delete record["id"];
        const cols = Object.keys(record);
        const vals = Object.values(record);
        if (!cols.length) { skipped++; continue; }

        if (hasId && id !== undefined && id !== null && String(id).trim() !== "") {
          const allCols = ["id", ...cols, ...(hasTenant ? ["tenant_id"] : [])];
          const allVals = [String(id).trim(), ...vals, ...(hasTenant ? [tenantId] : [])];
          const placeholders = allVals.map((_, i) => `$${i + 1}`);
          const stampCols = [...(hasCreated ? ["created_at"] : []), ...(hasUpdated ? ["updated_at"] : [])];
          const setClauses = [...cols.map((c, i) => `${c} = $${i + 2}`), ...(hasUpdated ? ["updated_at = NOW()"] : [])].join(", ");
          const guard = hasTenant ? `WHERE ${tableName}.tenant_id = $${allVals.length}` : "";
          const result = await pool.query(
            `INSERT INTO ${tableName} (${[...allCols, ...stampCols].join(", ")})
             VALUES (${[...placeholders, ...stampCols.map(() => "NOW()")].join(", ")})
             ON CONFLICT (id) DO UPDATE SET ${setClauses} ${guard}
             RETURNING (xmax = 0) AS is_insert`,
            allVals,
          );
          if (result.rowCount === 0) { errors.push(`Row ${r}: ID ${id} belongs to another workspace — skipped`); skipped++; }
          else if (result.rows[0]?.is_insert) inserted++;
          else updated++;
        } else {
          const allCols = [...(hasId ? ["id"] : []), ...cols, ...(hasTenant ? ["tenant_id"] : [])];
          const allVals = [...(hasId ? [newId(tableName)] : []), ...vals, ...(hasTenant ? [tenantId] : [])];
          const placeholders = allVals.map((_, i) => `$${i + 1}`);
          const stampCols = [...(hasCreated ? ["created_at"] : []), ...(hasUpdated ? ["updated_at"] : [])];
          await query(
            `INSERT INTO ${tableName} (${[...allCols, ...stampCols].join(", ")}) VALUES (${[...placeholders, ...stampCols.map(() => "NOW()")].join(", ")})`,
            allVals,
          );
          inserted++;
        }
      } catch (rowErr) {
        errors.push(`Row ${r}: ${rowErr instanceof Error ? rowErr.message : "row error"}`);
        skipped++;
      }
    }
    results.push({ sheet: sheetName, table: tableName, inserted, updated, skipped, errors: errors.slice(0, 5) });
  }
  return results;
}
