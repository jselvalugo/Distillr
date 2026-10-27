import type { ReportCatalogEntry, ReportKind, ReportPeriod } from "../../shared/report-types";

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    kind: "production-operations",
    group: "Compliance & Tax",
    title: "Monthly Operations Report",
    formReference: "TTB Form 5110.40",
    summary: "What you distilled, barreled and bottled in the period, and what's left in bond.",
    useFor: ["Monthly TTB production report", "Bonded storage balance", "Month-end review"],
    takesPeriod: true,
    defaultRange: "last-month",
    extraExports: [{ id: "word-5110", label: "Word — TTB 5110.40 form" }],
  },
  {
    kind: "excise-tax",
    group: "Compliance & Tax",
    title: "Federal Excise Tax Return",
    formReference: "TTB Form 5000.24",
    summary: "Proof gallons removed from bond, the tax rate that applies, and the amount due.",
    useFor: ["Pay.gov excise filing", "Tax by product and rate tier", "Per-bottle tax cost"],
    takesPeriod: true,
    defaultRange: "last-month",
    extraExports: [{ id: "word-5000", label: "Word — TTB 5000.24 form" }],
  },
  {
    kind: "state-excise",
    group: "Compliance & Tax",
    title: "State Excise Returns",
    summary: "Every state return in the period with proof gallons, rate, tax and filing status.",
    useFor: ["State filing calendar", "Multi-state tax summary"],
    takesPeriod: true,
    defaultRange: "this-quarter",
  },
  {
    kind: "batch-activity",
    group: "Production",
    title: "Batch Activity",
    summary: "Every batch that was distilled, barreled or bottled in the period, with its numbers.",
    useFor: ["Backing detail for the operations report", "Production review"],
    takesPeriod: true,
    defaultRange: "last-month",
  },
  {
    kind: "production-ledger",
    group: "Production",
    title: "Production Ledger",
    summary: "All batches started in the period, by product, from mash to bottle.",
    useFor: ["Yield by product", "Year-end production summary", "Investor or lender updates"],
    takesPeriod: true,
    defaultRange: "year-to-date",
  },
  {
    kind: "barrel-inventory",
    group: "Inventory & Aging",
    title: "Barrel Inventory",
    summary: "Every barrel you hold today: where it is, how long it's aged, and the proof gallons in bond.",
    useFor: ["Warehouse count", "Insurance and bond coverage", "Aging schedule"],
    takesPeriod: false,
    defaultRange: "all-time",
  },
  {
    kind: "finished-goods",
    group: "Inventory & Aging",
    title: "Finished Goods Movement",
    summary: "Cases made, shipped to distributors and retail, and on hand at month end, by product.",
    useFor: ["Case flow by product", "Distributor vs. retail split", "Month-end inventory"],
    takesPeriod: true,
    defaultRange: "this-quarter",
  },
  {
    kind: "sales",
    group: "Sales",
    title: "Sales Summary",
    summary: "Orders in the period by trading partner, with cases and revenue.",
    useFor: ["Distributor statements", "Revenue by partner", "Order status review"],
    takesPeriod: true,
    defaultRange: "this-month",
  },
];

export function getCatalogEntry(kind: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((e) => e.kind === kind);
}

export function isReportKind(value: string): value is ReportKind {
  return REPORT_CATALOG.some((e) => e.kind === value);
}

// ── Periods ─────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(y: number, m0: number): Date {
  return new Date(Date.UTC(y, m0, 1));
}
function monthEnd(y: number, m0: number): Date {
  return new Date(Date.UTC(y, m0 + 1, 0));
}

/** Resolve a named preset or explicit from/to into an inclusive ISO range. */
export function resolvePeriod(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): { start: string; end: string } | null {
  const now = input.now ?? new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  if (input.from && input.to) {
    if (!ISO_DATE.test(input.from) || !ISO_DATE.test(input.to)) return null;
    if (input.from > input.to) return null;
    return { start: input.from, end: input.to };
  }

  switch (input.preset) {
    case "this-month":
      return { start: iso(monthStart(y, m)), end: iso(monthEnd(y, m)) };
    case "last-month":
      return { start: iso(monthStart(y, m - 1)), end: iso(monthEnd(y, m - 1)) };
    case "this-quarter": {
      const q = Math.floor(m / 3) * 3;
      return { start: iso(monthStart(y, q)), end: iso(monthEnd(y, q + 2)) };
    }
    case "last-quarter": {
      const q = Math.floor(m / 3) * 3 - 3;
      return { start: iso(monthStart(y, q)), end: iso(monthEnd(y, q + 2)) };
    }
    case "year-to-date":
      return { start: iso(monthStart(y, 0)), end: iso(now) };
    case "last-12-months":
      return { start: iso(monthStart(y, m - 11)), end: iso(monthEnd(y, m)) };
    case "last-year":
      return { start: iso(monthStart(y - 1, 0)), end: iso(monthEnd(y - 1, 11)) };
    case "all-time":
      return { start: "1900-01-01", end: iso(monthEnd(y, m)) };
    default:
      return null;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = MONTHS.map((x) => x.slice(0, 3));

function parts(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { y, m, d };
}

export function formatDateLong(isoDate: string): string {
  const { y, m, d } = parts(isoDate);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function periodLabel(start: string, end: string): string {
  if (start === "1900-01-01") return `All time (through ${formatDateLong(end)})`;
  const a = parts(start);
  const b = parts(end);
  const lastOfMonth = new Date(Date.UTC(b.y, b.m, 0)).getUTCDate();
  const wholeMonths = a.d === 1 && b.d === lastOfMonth;
  if (wholeMonths && a.y === b.y && a.m === b.m) return `${MONTHS[a.m - 1]} ${a.y}`;
  if (wholeMonths && a.y === b.y && a.m === 1 && b.m === 12) return `Calendar year ${a.y}`;
  if (wholeMonths && a.y === b.y && (a.m - 1) % 3 === 0 && b.m - a.m === 2) {
    return `Q${(a.m - 1) / 3 + 1} ${a.y} (${MONTHS_SHORT[a.m - 1]}–${MONTHS_SHORT[b.m - 1]})`;
  }
  if (wholeMonths && a.y === b.y) return `${MONTHS_SHORT[a.m - 1]}–${MONTHS_SHORT[b.m - 1]} ${a.y}`;
  const left = `${MONTHS_SHORT[a.m - 1]} ${a.d}${a.y !== b.y ? `, ${a.y}` : ""}`;
  return `${left} – ${MONTHS_SHORT[b.m - 1]} ${b.d}, ${b.y}`;
}

export function toPeriod(start: string, end: string): ReportPeriod {
  return { start, end, label: periodLabel(start, end) };
}

/** Months (YYYY-MM) covered by an inclusive range. */
export function monthsInRange(start: string, end: string): string[] {
  const a = parts(start);
  const b = parts(end);
  const out: string[] = [];
  let y = a.y;
  let m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 600) break;
  }
  return out;
}

// ── Inventory period keys ──────────────────────────────────────────────────
// Inventory records are keyed by ISO week ("2026-W37"); older data may use a
// month ("2026-09"). Both are resolved to a date range here.

const ISO_WEEK = /^(\d{4})-W(\d{1,2})$/i;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Monday–Sunday of an ISO week. */
export function isoWeekRange(key: string): { start: string; end: string } | null {
  const m = ISO_WEEK.exec(key.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO week 1 contains Jan 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000 + (week - 1) * 7 * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { start: iso(monday), end: iso(sunday) };
}

export function periodKeyRange(key: string): { start: string; end: string } | null {
  const w = isoWeekRange(key);
  if (w) return w;
  const m = ISO_MONTH.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { start: iso(monthStart(y, mo)), end: iso(monthEnd(y, mo)) };
}

/**
 * The date that decides which period a record belongs to: the first of the month
 * for month keys, the Thursday for week keys (ISO's own rule), so every week lands
 * in exactly one month.
 */
export function periodKeyAnchor(key: string): string | null {
  const w = isoWeekRange(key);
  if (w) return iso(new Date(Date.parse(w.start + "T00:00:00Z") + 3 * 86_400_000));
  const r = periodKeyRange(key);
  return r ? r.start : null;
}

export function periodKeyInRange(key: string, start: string, end: string): boolean {
  const anchor = periodKeyAnchor(key);
  return !!anchor && anchor >= start && anchor <= end;
}

export function periodKeyLabel(key: string): string {
  const w = isoWeekRange(key);
  if (w) {
    const a = parts(w.start);
    const b = parts(w.end);
    const m = ISO_WEEK.exec(key.trim())!;
    const days = a.m === b.m ? `${MONTHS_SHORT[a.m - 1]} ${a.d}–${b.d}` : `${MONTHS_SHORT[a.m - 1]} ${a.d} – ${MONTHS_SHORT[b.m - 1]} ${b.d}`;
    return `Week ${Number(m[2])}, ${m[1]} (${days})`;
  }
  const m = ISO_MONTH.exec(key.trim());
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return key;
}
