/**
 * Spirits arithmetic used by reports, exports and forms.
 * Kept in one place so the screen, the PDF and the Excel file never disagree.
 */

export const LITERS_PER_US_GALLON = 3.785411784;

/** Case definitions keyed by the bottle-size labels used on inventory records. */
export const CASE_SIZES: Record<string, { label: string; bottleMl: number; bottlesPerCase: number }> = {
  "750ml": { label: "750 mL", bottleMl: 750, bottlesPerCase: 6 },
  "1000ml": { label: "1 L", bottleMl: 1000, bottlesPerCase: 6 },
  "1750ml": { label: "1.75 L", bottleMl: 1750, bottlesPerCase: 6 },
  "375ml": { label: "375 mL", bottleMl: 375, bottlesPerCase: 12 },
  "50ml": { label: "50 mL", bottleMl: 50, bottlesPerCase: 60 },
};

export const DEFAULT_CASE_SIZE = "750ml";

/** Wine gallons in one case of the given size. */
export function wineGallonsPerCase(sizeKey: string): number {
  const size = CASE_SIZES[sizeKey] ?? CASE_SIZES[DEFAULT_CASE_SIZE];
  return (size.bottleMl * size.bottlesPerCase) / 1000 / LITERS_PER_US_GALLON;
}

/** Proof gallons = wine gallons × proof ÷ 100 (proof = 2 × ABV%). */
export function proofGallons(wineGallons: number, proof: number): number {
  return wineGallons * (proof / 100);
}

export function proofFromAbv(abvPercent: number): number {
  return abvPercent * 2;
}

/**
 * Federal excise tax on distilled spirits (26 U.S.C. §5001), per proof gallon,
 * including the Craft Beverage Modernization Act reduced rates.
 */
export const FEDERAL_EXCISE_TIERS = [
  {
    key: "craft_tier1",
    line: "1",
    label: "Reduced rate — first 100,000 proof gallons",
    citation: "IRC §5001(c)(1)",
    ratePerProofGallon: 2.7,
  },
  {
    key: "craft_tier2",
    line: "2",
    label: "Reduced rate — 100,001 to 22,230,000 proof gallons",
    citation: "IRC §5001(c)(2)",
    ratePerProofGallon: 13.34,
  },
  {
    key: "standard",
    line: "3",
    label: "Standard rate",
    citation: "IRC §5001(a)(1)",
    ratePerProofGallon: 13.5,
  },
] as const;

export type FederalTaxTier = (typeof FEDERAL_EXCISE_TIERS)[number]["key"];

export const DEFAULT_TAX_TIER: FederalTaxTier = "craft_tier1";

export function federalRate(tier: string | null | undefined): number {
  const found = FEDERAL_EXCISE_TIERS.find((t) => t.key === tier);
  return (found ?? FEDERAL_EXCISE_TIERS.find((t) => t.key === DEFAULT_TAX_TIER)!).ratePerProofGallon;
}

export function normalizeTaxTier(value: string | null | undefined): FederalTaxTier {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "craft_tier1" || v === "tier1" || v === "craft tier 1") return "craft_tier1";
  if (v === "craft_tier2" || v === "tier2" || v === "craft tier 2") return "craft_tier2";
  if (v === "standard" || v === "full") return "standard";
  return DEFAULT_TAX_TIER;
}

export function taxTierLabel(tier: string | null | undefined): string {
  const key = normalizeTaxTier(tier);
  if (key === "craft_tier1") return "Craft Tier 1";
  if (key === "craft_tier2") return "Craft Tier 2";
  return "Standard";
}

/** Monthly federal excise return is due the 14th of the following month. */
export function federalExciseDueDate(periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map(Number);
  const due = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 14));
  return due.toISOString().slice(0, 10);
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}
