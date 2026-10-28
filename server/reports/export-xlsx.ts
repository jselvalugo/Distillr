import ExcelJS from "exceljs";
import type { CellFormat, CellValue, ReportDocument, ReportSection } from "../../shared/report-types";
import { formatCell, isNumericFormat } from "./format";
import { COMPLIANCE_DISCLAIMER, COMPLIANCE_DISCLAIMER_SHORT } from "../../shared/compliance-disclaimer";

const NUMBER_FORMATS: Partial<Record<CellFormat, string>> = {
  integer: "#,##0",
  number: "#,##0.00",
  number4: "#,##0.0000",
  currency: '"$"#,##0.00',
  percent: '0.0"%"',
  proof: '0.0"°"',
};

const INK = "FF0F0F10";
const SOFT = "FF5C5C63";
const MUTED = "FF9A9AA2";
const HEAD_FILL = "FFF3F3F5";
const ZEBRA = "FFFBFBFC";
const RULE = "FFDCDCE0";

function brandArgb(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  return m ? `FF${m[1].toUpperCase()}` : "FF0F1B42";
}

function cellValue(value: CellValue | undefined, format?: CellFormat): ExcelJS.CellValue {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  if (format === "date" || format === "month") {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  }
  if (isNumericFormat(format) && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function sheetName(base: string, used: Set<string>): string {
  let name = base.replace(/[\\/?*[\]:]/g, "").slice(0, 28) || "Sheet";
  let i = 2;
  let candidate = name;
  while (used.has(candidate.toLowerCase())) candidate = `${name.slice(0, 25)} ${i++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function addTitleBlock(ws: ExcelJS.Worksheet, doc: ReportDocument, title: string, subtitle: string | undefined, brand: string, cols: number) {
  const span = Math.max(cols, 4);
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: INK } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = [doc.organization.name, doc.organization.dspNumber ? `DSP ${doc.organization.dspNumber}` : null, doc.period?.label ?? "Point-in-time snapshot"]
    .filter(Boolean)
    .join("  ·  ");
  s.font = { name: "Calibri", size: 10, color: { argb: SOFT } };

  if (subtitle) {
    ws.mergeCells(3, 1, 3, span);
    const d = ws.getCell(3, 1);
    d.value = subtitle;
    d.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
    d.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(3).height = 24;
  }
  for (let c = 1; c <= span; c++) {
    ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: brand } } };
  }
  return 6; // first free row
}

function addTable(ws: ExcelJS.Worksheet, section: ReportSection, startRow: number, brand: string): number {
  let row = startRow;
  const { columns, rows, totals } = section;

  // Header
  const header = ws.getRow(row);
  columns.forEach((col, i) => {
    const c = header.getCell(i + 1);
    c.value = col.label;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: SOFT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    c.alignment = { horizontal: col.align ?? (isNumericFormat(col.format) ? "right" : "left"), vertical: "middle", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: RULE } } };
  });
  header.height = 20;
  row++;

  if (!rows.length) {
    const c = ws.getCell(row, 1);
    c.value = section.emptyHint ?? "No data for this period.";
    c.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
    return row + 2;
  }

  rows.forEach((r, ri) => {
    const xr = ws.getRow(row);
    columns.forEach((col, i) => {
      const c = xr.getCell(i + 1);
      c.value = cellValue(r[col.key], col.format);
      const fmt = NUMBER_FORMATS[col.format ?? "text"];
      if (fmt && typeof c.value === "number") c.numFmt = fmt;
      if (col.format === "date") c.numFmt = "mmm d, yyyy";
      if (col.format === "month") c.numFmt = "mmmm yyyy";
      c.font = { name: "Calibri", size: 10, bold: i === 0, color: { argb: i === 0 ? INK : SOFT } };
      c.alignment = { horizontal: col.align ?? (isNumericFormat(col.format) ? "right" : "left"), vertical: "top", wrapText: col.format === "list" };
      if (ri % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    row++;
  });

  if (totals) {
    const tr = ws.getRow(row);
    columns.forEach((col, i) => {
      const c = tr.getCell(i + 1);
      const v = totals[col.key];
      c.value = v == null ? null : cellValue(v, col.format);
      const fmt = NUMBER_FORMATS[col.format ?? "text"];
      if (fmt && typeof c.value === "number") c.numFmt = fmt;
      c.font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
      c.alignment = { horizontal: col.align ?? (isNumericFormat(col.format) ? "right" : "left") };
      c.border = { top: { style: "thin", color: { argb: INK } }, bottom: { style: "double", color: { argb: brand } } };
    });
    row++;
  }
  return row + 1;
}

function addFacts(ws: ExcelJS.Worksheet, section: ReportSection, startRow: number): number {
  let row = startRow;
  let currentGroup: string | undefined;
  for (const f of section.facts ?? []) {
    if (f.group && f.group !== currentGroup) {
      currentGroup = f.group;
      if (row > startRow) row++;
      const g = ws.getCell(row, 1);
      g.value = f.group.toUpperCase();
      g.font = { name: "Calibri", size: 8, bold: true, color: { argb: MUTED } };
      row++;
    }
    const label = ws.getCell(row, 1);
    label.value = `${f.sign ? `${f.sign}  ` : ""}${f.label}`;
    label.font = { name: "Calibri", size: 10, bold: !!f.emphasis, color: { argb: f.emphasis ? INK : SOFT } };
    const val = ws.getCell(row, 3);
    val.value = cellValue(f.value, f.format);
    const fmt = NUMBER_FORMATS[f.format ?? "text"];
    if (fmt && typeof val.value === "number") val.numFmt = fmt;
    if (f.format === "date") val.numFmt = "mmm d, yyyy";
    val.font = { name: "Calibri", size: f.emphasis ? 11 : 10, bold: !!f.emphasis, color: { argb: INK } };
    val.alignment = { horizontal: "right" };
    if (f.emphasis && f.sign === "=") {
      for (let c = 1; c <= 3; c++) ws.getCell(row, c).border = { top: { style: "thin", color: { argb: INK } } };
    }
    row++;
  }
  return row + 1;
}

function autoWidths(ws: ExcelJS.Worksheet, section: ReportSection | null) {
  const cols = section?.columns ?? [];
  cols.forEach((col, i) => {
    const samples = [col.label, ...section!.rows.slice(0, 300).map((r) => formatCell(r[col.key], col.format))];
    const longest = Math.max(...samples.map((s) => s.length));
    ws.getColumn(i + 1).width = Math.min(Math.max(10, longest + 2), col.format === "list" ? 48 : 34);
  });
  if (!cols.length) {
    ws.getColumn(1).width = 52;
    ws.getColumn(2).width = 4;
    ws.getColumn(3).width = 20;
  }
}

export async function renderReportXlsx(doc: ReportDocument, options: { brandColor?: string | null } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Distillr";
  wb.created = new Date(doc.generatedAt);
  const brand = brandArgb(options.brandColor);
  const used = new Set<string>();

  // Summary sheet
  const summary = wb.addWorksheet(sheetName("Summary", used), { views: [{ showGridLines: false }] });
  let row = addTitleBlock(summary, doc, doc.title, doc.subtitle, brand, 4);
  const meta: Array<[string, CellValue, CellFormat?]> = [
    ["Organization", doc.organization.name],
    ["DSP permit", doc.organization.dspNumber ?? "Not set"],
    ["EIN", doc.organization.ein ?? "Not set"],
    ["Address", doc.organization.address ?? "Not set"],
    ["Period", doc.period?.label ?? "Point-in-time snapshot"],
    ["Generated", doc.generatedAt.slice(0, 10), "date"],
  ];
  for (const [k, v, f] of meta) {
    summary.getCell(row, 1).value = k;
    summary.getCell(row, 1).font = { name: "Calibri", size: 10, color: { argb: SOFT } };
    summary.getCell(row, 3).value = cellValue(v, f);
    if (f === "date") summary.getCell(row, 3).numFmt = "mmm d, yyyy";
    summary.getCell(row, 3).font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
    summary.getCell(row, 3).alignment = { horizontal: "right" };
    row++;
  }
  row++;
  if (doc.kpis.length) {
    summary.getCell(row, 1).value = "Key figures";
    summary.getCell(row, 1).font = { name: "Calibri", size: 11, bold: true };
    row++;
    for (const k of doc.kpis) {
      summary.getCell(row, 1).value = k.sub ? `${k.label} (${k.sub})` : k.label;
      summary.getCell(row, 1).font = { name: "Calibri", size: 10, color: { argb: SOFT } };
      const v = summary.getCell(row, 3);
      v.value = cellValue(k.value, k.format);
      const fmt = NUMBER_FORMATS[k.format ?? "text"];
      if (fmt && typeof v.value === "number") v.numFmt = fmt;
      v.font = { name: "Calibri", size: 11, bold: true };
      v.alignment = { horizontal: "right" };
      row++;
    }
    row++;
  }
  if (doc.warnings.length) {
    summary.getCell(row, 1).value = "Setup notes";
    summary.getCell(row, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF8C5A08" } };
    row++;
    for (const w of doc.warnings) {
      summary.mergeCells(row, 1, row, 4);
      summary.getCell(row, 1).value = `• ${w}`;
      summary.getCell(row, 1).font = { name: "Calibri", size: 9, color: { argb: "FF8C5A08" } };
      summary.getCell(row, 1).alignment = { wrapText: true };
      row++;
    }
    row++;
  }
  summary.getCell(row, 1).value = "How this report is calculated";
  summary.getCell(row, 1).font = { name: "Calibri", size: 11, bold: true };
  row++;
  for (const m of doc.methodology) {
    summary.mergeCells(row, 1, row, 4);
    summary.getCell(row, 1).value = `• ${m}`;
    summary.getCell(row, 1).font = { name: "Calibri", size: 9, color: { argb: SOFT } };
    summary.getCell(row, 1).alignment = { wrapText: true, vertical: "top" };
    summary.getRow(row).height = Math.max(15, Math.ceil(m.length / 95) * 13);
    row++;
  }
  row++;
  summary.mergeCells(row, 1, row, 4);
  summary.getCell(row, 1).value = COMPLIANCE_DISCLAIMER;
  summary.getCell(row, 1).font = { name: "Calibri", size: 9, italic: true, color: { argb: SOFT } };
  summary.getCell(row, 1).alignment = { wrapText: true, vertical: "top" };
  summary.getRow(row).height = 40;
  autoWidths(summary, null);
  summary.getColumn(4).width = 30;

  // One sheet per section
  for (const section of doc.sections) {
    const ws = wb.addWorksheet(sheetName(section.tag ? `${section.tag}. ${section.title}` : section.title, used), {
      views: [{ showGridLines: false, state: section.columns.length ? "frozen" : undefined, ySplit: section.columns.length ? 6 : 0 }],
    });
    let r = addTitleBlock(ws, doc, section.title, section.description, brand, Math.max(section.columns.length, 3));
    if (section.facts?.length) r = addFacts(ws, section, r);
    if (section.columns.length) r = addTable(ws, section, r, brand);
    for (const note of section.notes ?? []) {
      ws.mergeCells(r, 1, r, Math.max(section.columns.length, 3));
      ws.getCell(r, 1).value = note;
      ws.getCell(r, 1).font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
      ws.getCell(r, 1).alignment = { wrapText: true };
      r++;
    }
    autoWidths(ws, section.columns.length ? section : null);
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.headerFooter.oddFooter = `&L${doc.organization.name} · ${doc.title}&CPrepared with Distillr · ${COMPLIANCE_DISCLAIMER_SHORT}&RPage &P of &N`;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
