const RETENTION_YEARS_DEFAULT = 3;

export const MIN_RECORD_RETENTION_YEARS = RETENTION_YEARS_DEFAULT;

export const complianceControlAreas = [
  "TTB Reporting",
  "Excise Tax",
  "Production Records",
  "Storage Records",
  "COLA Labeling",
  "Data Privacy",
  "Payment Security",
  "Safety",
] as const;

export type ComplianceControlArea = (typeof complianceControlAreas)[number];

export const ttbFilingCadences = ["Semi-Monthly", "Monthly", "Quarterly", "Annual"] as const;
export type TtbFilingCadence = (typeof ttbFilingCadences)[number];

export function addYearsIso(base: string | Date, years = RETENTION_YEARS_DEFAULT): string {
  const parsed = base instanceof Date ? new Date(base) : new Date(base);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date();
    fallback.setUTCFullYear(fallback.getUTCFullYear() + years);
    return fallback.toISOString();
  }
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  return parsed.toISOString();
}

export function isRetentionLocked(retentionUntil: string | null | undefined, now = new Date()): boolean {
  if (!retentionUntil) return true;
  const parsed = new Date(retentionUntil);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() > now.getTime();
}

export function deriveComplianceAreaFromType(
  type: string | null | undefined,
  fallback: ComplianceControlArea = "TTB Reporting",
): ComplianceControlArea {
  const value = (type || "").toLowerCase();
  if (value.includes("cola") || value.includes("label")) return "COLA Labeling";
  if (value.includes("excise") || value.includes("tax")) return "Excise Tax";
  if (value.includes("privacy") || value.includes("gdpr")) return "Data Privacy";
  if (value.includes("pci") || value.includes("payment")) return "Payment Security";
  if (value.includes("fire") || value.includes("safety")) return "Safety";
  if (value.includes("storage") || value.includes("warehouse")) return "Storage Records";
  if (value.includes("production") || value.includes("distill")) return "Production Records";
  if (value.includes("ttb") || value.includes("filing")) return "TTB Reporting";
  return fallback;
}

export function deriveCadenceFromPeriod(periodStart: string, periodEnd: string): TtbFilingCadence {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Monthly";
  const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  if (durationDays <= 16) return "Semi-Monthly";
  if (durationDays <= 45) return "Monthly";
  if (durationDays <= 120) return "Quarterly";
  return "Annual";
}

export function defaultDueDateForCadence(periodEnd: string, cadence: TtbFilingCadence): string {
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + 14);
    return fallback.toISOString().slice(0, 10);
  }

  const due = new Date(end);
  const offsetDaysByCadence: Record<TtbFilingCadence, number> = {
    "Semi-Monthly": 14,
    Monthly: 14,
    Quarterly: 30,
    Annual: 45,
  };
  due.setUTCDate(due.getUTCDate() + offsetDaysByCadence[cadence]);
  return due.toISOString().slice(0, 10);
}
