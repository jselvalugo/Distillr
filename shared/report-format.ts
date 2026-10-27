import type { CellFormat, CellValue } from "./report-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function groupThousands(s: string): string {
  const [int, frac] = s.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac != null ? `${withCommas}.${frac}` : withCommas;
}

export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function formatMonth(value: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return value;
  const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${full[Number(m[2]) - 1]} ${m[1]}`;
}

/** Render a cell as text, the same way on screen, in PDF and in CSV. */
export function formatCell(value: CellValue | undefined, format: CellFormat = "text", opts: { blank?: string } = {}): string {
  const blank = opts.blank ?? "—";
  if (value == null || value === "") return blank;
  if (Array.isArray(value)) return value.length ? value.join(", ") : blank;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (format === "date") return formatDate(value);
    if (format === "month") return formatMonth(value);
    const n = Number(value);
    if (format !== "text" && value.trim() !== "" && !Number.isNaN(n)) return formatCell(n, format, opts);
    return value;
  }
  const n = value;
  switch (format) {
    case "integer":
      return groupThousands(Math.round(n).toFixed(0));
    case "number":
      return groupThousands(n.toFixed(2));
    case "number4":
      return groupThousands(n.toFixed(4));
    case "currency": {
      const s = groupThousands(Math.abs(n).toFixed(2));
      return n < 0 ? `-$${s}` : `$${s}`;
    }
    case "percent":
      return `${n.toFixed(1)}%`;
    case "proof":
      return `${n.toFixed(1)}°`;
    default:
      return Number.isInteger(n) ? groupThousands(String(n)) : groupThousands(n.toFixed(2));
  }
}

export function isNumericFormat(format: CellFormat | undefined): boolean {
  return format === "integer" || format === "number" || format === "number4" || format === "currency" || format === "percent" || format === "proof";
}

export function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report";
}
