/** Shared compliance vocabulary so the list, the new-record form and the record page agree. */

export const COMPLIANCE_STATUSES = [
  "Pending Review",
  "In Progress",
  "Approved",
  "Expiring Soon",
  "Missing",
  "Expired",
] as const;

export const COMPLIANCE_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

/** The happy path a record moves through, shown as a progress bar on the record page. */
export const COMPLIANCE_STEPS = [
  { status: "Pending Review", label: "Pending review", hint: "Logged — needs someone to review it" },
  { status: "In Progress", label: "In progress", hint: "Being worked on — filing, renewal or fix" },
  { status: "Approved", label: "Approved", hint: "In good standing" },
] as const;

/** Older records used Open / Resolved / Waived; map them onto the current steps. */
export function stepIndexFor(status: string | null | undefined): number {
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "resolved" || s === "waived" || s === "expiring soon") return 2;
  if (s === "in progress") return 1;
  if (s === "pending review" || s === "open") return 0;
  return -1; // Missing / Expired / anything custom: off the happy path
}

export function isProblemStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s.includes("missing") || s.includes("expired");
}

export function displaySeverity(sev: string | null | undefined): string {
  if (!sev) return "—";
  return sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
}

export function severityTone(sev: string | null | undefined): { bg: string; fg: string; dot: string } {
  switch ((sev || "").toLowerCase()) {
    case "critical": return { bg: "#FEF2F2", fg: "#B91C1C", dot: "#DC2626" };
    case "high": return { bg: "#FFF7ED", fg: "#C2410C", dot: "#EA580C" };
    case "medium": return { bg: "#FFFBEB", fg: "#B45309", dot: "#D97706" };
    case "low": return { bg: "#F0FDF4", fg: "#15803D", dot: "#16A34A" };
    default: return { bg: "#F5F5F5", fg: "#525252", dot: "#A3A3A3" };
  }
}

/** Whole days from today until a YYYY-MM-DD (or ISO) date; negative when past. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00") : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Netlify functions cap request bodies (~6 MB), and base64 adds a third. */
export const MAX_COMPLIANCE_UPLOAD_BYTES = 4 * 1024 * 1024;
export const COMPLIANCE_UPLOAD_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export const FIELD_LABELS: Record<string, string> = {
  type: "Type",
  status: "Status",
  severity: "Severity",
  jurisdiction: "Jurisdiction",
  regulatoryArea: "Regulatory area",
  controlReference: "Reference / permit #",
  expires: "Expires / due",
  owner: "Owner",
  requiredFor: "Required for",
  lastReviewedOn: "Last reviewed",
  documentUrl: "Document link",
  notes: "Notes",
  clientId: "Trading partner",
};
