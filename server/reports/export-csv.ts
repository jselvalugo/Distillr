import type { ReportDocument } from "../../shared/report-types";
import { formatCell } from "./format";

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CSV keeps raw numbers (no thousands separators or currency symbols) so the
 * file imports cleanly into spreadsheets and accounting tools; dates stay ISO.
 */
function rawCell(value: unknown, format?: string): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "number") return format === "number4" ? value.toFixed(4) : format === "integer" ? String(Math.round(value)) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function renderReportCsv(doc: ReportDocument): string {
  const lines: string[] = [];
  const push = (cells: string[]) => lines.push(cells.map(csvEscape).join(","));

  push([doc.title]);
  push(["Organization", doc.organization.name]);
  if (doc.organization.dspNumber) push(["DSP permit", doc.organization.dspNumber]);
  push(["Period", doc.period ? `${doc.period.start} to ${doc.period.end}` : "Point-in-time"]);
  push(["Generated", doc.generatedAt]);
  lines.push("");

  if (doc.kpis.length) {
    push(["Key figures"]);
    for (const k of doc.kpis) push([k.label, rawCell(k.value, k.format), k.sub ?? ""]);
    lines.push("");
  }

  for (const s of doc.sections) {
    push([s.tag ? `${s.tag}. ${s.title}` : s.title]);
    for (const f of s.facts ?? []) push([f.label, rawCell(f.value, f.format)]);
    if (s.columns.length) {
      push(s.columns.map((c) => c.label));
      for (const r of s.rows) push(s.columns.map((c) => rawCell(r[c.key], c.format)));
      if (s.totals && s.rows.length) push(s.columns.map((c) => rawCell(s.totals![c.key], c.format)));
      if (!s.rows.length) push([s.emptyHint ?? "No data"]);
    }
    lines.push("");
  }

  push(["How this report is calculated"]);
  for (const m of doc.methodology) push([m]);

  // Prefix BOM so Excel opens UTF-8 (°, —) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export { formatCell };
