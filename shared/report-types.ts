/**
 * Report document model.
 *
 * Every report the app produces — on screen, as a PDF, Excel or CSV — is first
 * built as a ReportDocument. The screen renders it, and the exporters serialize
 * it, so what the customer sees is exactly what they download.
 */

export type ReportKind =
  | "production-operations"
  | "excise-tax"
  | "batch-activity"
  | "production-ledger"
  | "barrel-inventory"
  | "finished-goods"
  | "sales"
  | "state-excise";

export type ReportGroup = "Compliance & Tax" | "Production" | "Inventory & Aging" | "Sales";

/** How a cell value should be displayed. */
export type CellFormat =
  | "text"
  | "integer"
  | "number" // 2 decimals
  | "number4" // 4 decimals (proof gallons on tax forms)
  | "currency"
  | "percent"
  | "proof" // e.g. 120.0°
  | "date"
  | "month"
  | "list"; // string[] joined with ", "

export type CellValue = string | number | boolean | null | string[];

export interface ReportColumn {
  key: string;
  label: string;
  format?: CellFormat;
  align?: "left" | "right" | "center";
  /** Relative width hint for exports (1 = normal). */
  width?: number;
  /** Shown in the glossary / column help. */
  help?: string;
}

export type ReportRow = Record<string, CellValue>;

export interface ReportSection {
  id: string;
  /** Short roman/number tag shown before the title, e.g. "I", "II", "A". */
  tag?: string;
  title: string;
  /** One plain-English sentence on what the section shows and how it's derived. */
  description?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Totals row, keyed by column; omitted keys render blank. */
  totals?: ReportRow;
  /** Key/value facts shown instead of (or above) the table, e.g. a ledger. */
  facts?: Array<{
    label: string;
    value: CellValue;
    format?: CellFormat;
    emphasis?: boolean;
    sign?: "+" | "−" | "=";
    /** Facts with the same group render as one labelled column/card. */
    group?: string;
  }>;
  /** Shown when rows are empty: what the customer needs to record to populate it. */
  emptyHint?: string;
  /** Footnotes under the section. */
  notes?: string[];
}

export interface ReportKpi {
  label: string;
  value: CellValue;
  format?: CellFormat;
  /** Short qualifier, e.g. "12 batches". */
  sub?: string;
}

export interface ReportOrganization {
  name: string;
  dspNumber: string | null;
  ein: string | null;
  address: string | null;
  logoDataUrl: string | null;
}

export interface ReportPeriod {
  /** ISO date YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
  /** Human label, e.g. "September 2026" or "Jul 1 – Sep 30, 2026". */
  label: string;
}

export interface ReportDocument {
  kind: ReportKind;
  group: ReportGroup;
  title: string;
  subtitle: string;
  /** Official form reference, when the report mirrors one (e.g. "TTB Form 5110.40"). */
  formReference?: string;
  organization: ReportOrganization;
  /** Null for point-in-time reports such as the barrel inventory. */
  period: ReportPeriod | null;
  /** ISO timestamp when the document was built. */
  generatedAt: string;
  kpis: ReportKpi[];
  sections: ReportSection[];
  /** "How this report is calculated" — plain-English bullets. */
  methodology: string[];
  /** Warnings about missing setup (no DSP number, batches without dates, …). */
  warnings: string[];
  /** Report-specific extras, e.g. the figures the Word TTB form generators need. */
  extras?: Record<string, unknown>;
}

/** Catalog entry: what a report is for, in the customer's words. */
export interface ReportCatalogEntry {
  kind: ReportKind;
  group: ReportGroup;
  title: string;
  /** One line, plain English. */
  summary: string;
  /** What you'd use it for. */
  useFor: string[];
  formReference?: string;
  /** Whether the report takes a date range. Point-in-time reports don't. */
  takesPeriod: boolean;
  /** Suggested default range. */
  defaultRange: "this-month" | "last-month" | "this-quarter" | "year-to-date" | "all-time";
  /** Extra export formats beyond pdf/xlsx/csv (e.g. the Word TTB form). */
  extraExports?: Array<{ id: string; label: string }>;
}
