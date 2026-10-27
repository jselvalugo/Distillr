import type {
  Barrel,
  BarrelEvent,
  Client,
  DistillingBatchRecord,
  DistillingInventoryRecord,
  PlatformConfig,
  SalesOrder,
} from "../../shared/schema";
import type {
  ReportDocument,
  ReportKind,
  ReportKpi,
  ReportOrganization,
  ReportRow,
  ReportSection,
} from "../../shared/report-types";
import {
  CASE_SIZES,
  FEDERAL_EXCISE_TIERS,
  federalExciseDueDate,
  federalRate,
  normalizeTaxTier,
  proofFromAbv,
  proofGallons,
  round,
  taxTierLabel,
  wineGallonsPerCase,
} from "../../shared/spirits-math";
import { storage, getStateExciseReturns } from "../storage";
import { formatDateLong, getCatalogEntry, periodKeyInRange, periodKeyLabel, toPeriod } from "./catalog";

// ── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  mash_fermentation: "Mash & Fermentation",
  distillation: "Distillation",
  barreling: "Barreling",
  aging: "Aging",
  bottling: "Bottling",
  closed: "Closed",
};

const num = (v: unknown): number => (v == null || v === "" || Number.isNaN(Number(v)) ? 0 : Number(v));
const within = (date: string | null | undefined, start: string, end: string): boolean =>
  !!date && date.slice(0, 10) >= start && date.slice(0, 10) <= end;
const before = (date: string | null | undefined, start: string): boolean => !!date && date.slice(0, 10) < start;
const text = (v: unknown, fallback = "Unspecified"): string => {
  const s = v == null ? "" : String(v).trim();
  return s || fallback;
};
const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const order: string[] = [];
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!map[k]) {
      map[k] = [];
      order.push(k);
    }
    map[k].push(item);
  }
  return order.map((k) => [k, map[k]] as [string, T[]]);
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

function avg<T>(items: T[], pick: (item: T) => number | null | undefined): number {
  const vals = items.map(pick).filter((v): v is number => v != null && !Number.isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Excise tax a batch record carries: the stored figure, or PG × its tier rate. */
function batchExciseTax(b: DistillingBatchRecord): number {
  if (b.exciseTaxDue != null) return num(b.exciseTaxDue);
  return num(b.proofGallonsProcessed) * federalRate(normalizeTaxTier(b.taxClass));
}

/**
 * Proof-gallon losses per barrel, dated.
 * - "gauge" events are readings (wineGallons at proofAtEvent); the loss is the drop
 *   from the previous reading (or the fill) — the app's own angel's-share definition.
 * - "Sample" events are positive removals at the event proof.
 * - Dumps/empties move spirit to processing and are not losses.
 */
interface Loss {
  barrelId: string;
  date: string;
  proofGallons: number;
}

function computeLosses(barrels: Barrel[], events: BarrelEvent[]): Loss[] {
  const losses: Loss[] = [];
  const byBarrel = groupBy(
    events.filter((e) => e.eventType === "gauge" || e.eventType === "Sample"),
    (e) => e.barrelId,
  );
  const barrelById: Record<string, Barrel> = {};
  for (const b of barrels) barrelById[b.id] = b;
  for (const [barrelId, items] of byBarrel) {
    const barrel = barrelById[barrelId];
    if (!barrel) continue;
    let lastPg: number | null = barrel.fillProofGallons ?? null;
    const sorted = items.slice().sort((a, b) => a.eventAt.localeCompare(b.eventAt));
    for (const e of sorted) {
      const date = e.eventAt.slice(0, 10);
      if (e.eventType === "Sample") {
        const proof = e.proofAtEvent ?? barrel.fillProof ?? null;
        const vol = Math.abs(num(e.volumeChange));
        if (proof != null && vol) losses.push({ barrelId, date, proofGallons: proofGallons(vol, num(proof)) });
        if (lastPg != null && proof != null) lastPg -= proofGallons(vol, num(proof));
        continue;
      }
      // gauge
      if (e.wineGallons == null) continue;
      const proof = e.proofAtEvent ?? barrel.fillProof ?? null;
      if (proof == null) continue;
      const readingPg = proofGallons(num(e.wineGallons), num(proof));
      if (lastPg != null && readingPg < lastPg) losses.push({ barrelId, date, proofGallons: lastPg - readingPg });
      lastPg = readingPg;
    }
  }
  return losses;
}

/** Current proof gallons: latest gauge reading, else the barrel's stored figure, else the fill. */
function currentProofGallonsOf(barrel: Barrel, events: BarrelEvent[]): number {
  const gauges = events
    .filter((e) => e.barrelId === barrel.id && e.eventType === "gauge" && e.wineGallons != null)
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt));
  const latest = gauges[0];
  if (latest) {
    const proof = latest.proofAtEvent ?? barrel.fillProof ?? null;
    if (proof != null) return proofGallons(num(latest.wineGallons), num(proof));
  }
  return num(barrel.currentProofGallons ?? barrel.fillProofGallons);
}

function currentWineGallonsOf(barrel: Barrel, events: BarrelEvent[]): number {
  const gauges = events
    .filter((e) => e.barrelId === barrel.id && e.eventType === "gauge" && e.wineGallons != null)
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt));
  if (gauges[0]) return num(gauges[0].wineGallons);
  return num(barrel.currentVolume ?? barrel.fillVolume);
}

const IN_BOND_STATUSES = new Set(["Filled", "Aging", "Ready"]);

function organizationFrom(config: PlatformConfig): ReportOrganization {
  return {
    name: (config.organizationNameOverride || config.organizationName || "").trim() || "Your distillery",
    dspNumber: config.dspNumber ?? null,
    ein: config.ein ?? null,
    address: config.primaryAddress ?? null,
    logoDataUrl: config.logoDataUrl ?? null,
  };
}

interface Ctx {
  start: string;
  end: string;
  config: PlatformConfig;
  org: ReportOrganization;
  today: string;
}

function baseDoc(ctx: Ctx, kind: ReportKind, usesPeriod = true): ReportDocument {
  const entry = getCatalogEntry(kind)!;
  return {
    kind,
    group: entry.group,
    title: entry.title,
    subtitle: entry.summary,
    formReference: entry.formReference,
    organization: ctx.org,
    period: usesPeriod ? toPeriod(ctx.start, ctx.end) : null,
    generatedAt: new Date().toISOString(),
    kpis: [],
    sections: [],
    methodology: [],
    warnings: [],
  };
}

function commonWarnings(ctx: Ctx, doc: ReportDocument, needsDsp: boolean) {
  if (needsDsp && !ctx.org.dspNumber) {
    doc.warnings.push("No DSP permit number is set. Add it under Settings → Company Info so it prints on this report.");
  }
}

// ── 1. Monthly Operations Report (TTB 5110.40 style) ───────────────────────

async function buildProductionOperations(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "production-operations");
  const [batches, barrels, events] = await Promise.all([
    storage.getDistillingBatchRecords(),
    storage.getBarrels(),
    storage.getAllBarrelEvents(),
  ]);
  const losses = computeLosses(barrels, events);
  const { start, end } = ctx;

  // Part I — produced (by distillation date)
  const produced = batches.filter((b) => within(b.distillDate, start, end) && num(b.proofGallonsProduced) > 0);
  const producedRows: ReportRow[] = groupBy(produced, (b) => `${text(b.spiritType)}|${text(b.spiritClass, "")}`)
    .map(([, items]) => ({
      spiritType: titleCase(text(items[0].spiritType)),
      spiritClass: titleCase(text(items[0].spiritClass, "—")),
      batchCodes: items.map((b) => b.batchCode),
      batches: items.length,
      avgProof: avg(items, (b) => b.distillationProof),
      proofGallons: sum(items, (b) => num(b.proofGallonsProduced)),
    }))
    .sort((a, b) => num(b.proofGallons) - num(a.proofGallons));
  const totalProduced = sum(produced, (b) => num(b.proofGallonsProduced));

  // Part II — deposited into bond (by fill date)
  const deposited = batches.filter((b) => within(b.fillDate, start, end) && num(b.fillProofGallons) > 0);
  const depositedRows: ReportRow[] = groupBy(deposited, (b) => `${text(b.spiritType)}|${text(b.spiritClass, "")}`)
    .map(([, items]) => ({
      spiritType: titleCase(text(items[0].spiritType)),
      spiritClass: titleCase(text(items[0].spiritClass, "—")),
      fillNumbers: items.map((b) => b.fillNumber).filter(Boolean) as string[],
      barrels: items.length,
      wineGallons: sum(items, (b) => num(b.fillWineGallons)),
      avgProof: avg(items, (b) => b.fillProof),
      proofGallons: sum(items, (b) => num(b.fillProofGallons)),
    }))
    .sort((a, b) => num(b.proofGallons) - num(a.proofGallons));
  const totalDeposited = sum(deposited, (b) => num(b.fillProofGallons));
  const totalDepositedWg = sum(deposited, (b) => num(b.fillWineGallons));

  // Part IV — processed / removed (by bottling date)
  const processed = batches.filter((b) => within(b.bottlingDate, start, end) && num(b.proofGallonsProcessed) > 0);
  const processedRows: ReportRow[] = groupBy(processed, (b) => `${text(b.spiritType)}|${text(b.spiritClass, "")}`)
    .map(([, items]) => ({
      spiritType: titleCase(text(items[0].spiritType)),
      spiritClass: titleCase(text(items[0].spiritClass, "—")),
      lotNumbers: items.map((b) => b.lotNumber).filter(Boolean) as string[],
      avgProof: avg(items, (b) => b.bottlingProof),
      cases750: sum(items, (b) => num(b.cases750ml)),
      cases1000: sum(items, (b) => num(b.cases1000ml)),
      cases1750: sum(items, (b) => num(b.cases1750ml)),
      totalCases: sum(items, (b) => num(b.totalCases)),
      wineGallons: sum(items, (b) => num(b.wineGallonsBottled)),
      proofGallons: sum(items, (b) => num(b.proofGallonsProcessed)),
      exciseTax: sum(items, batchExciseTax),
    }))
    .sort((a, b) => num(b.proofGallons) - num(a.proofGallons));
  const totalProcessed = sum(processed, (b) => num(b.proofGallonsProcessed));
  const totalExcise = sum(processed, batchExciseTax);

  // Part III — bonded storage ledger
  const lossesBefore = sum(losses.filter((l) => before(l.date, start)), (l) => l.proofGallons);
  const lossesInPeriod = sum(losses.filter((l) => within(l.date, start, end)), (l) => l.proofGallons);
  const beginning =
    sum(batches.filter((b) => before(b.fillDate, start)), (b) => num(b.fillProofGallons)) -
    sum(batches.filter((b) => before(b.bottlingDate, start)), (b) => num(b.proofGallonsProcessed)) -
    lossesBefore;
  const ending = beginning + totalDeposited - totalProcessed - lossesInPeriod;

  const inBond = barrels.filter((b) => IN_BOND_STATUSES.has(b.status));
  const inBondWg = sum(inBond, (b) => currentWineGallonsOf(b, events));
  const inBondPg = sum(inBond, (b) => currentProofGallonsOf(b, events));

  doc.kpis = [
    { label: "Spirits produced", value: totalProduced, format: "number", sub: `${produced.length} batch${produced.length === 1 ? "" : "es"} · proof gallons` },
    { label: "Deposited in bond", value: totalDeposited, format: "number", sub: `${deposited.length} fill${deposited.length === 1 ? "" : "s"} · proof gallons` },
    { label: "Removed / bottled", value: totalProcessed, format: "number", sub: `${sum(processed, (b) => num(b.totalCases))} cases · proof gallons` },
    { label: "Excise tax on removals", value: totalExcise, format: "currency" },
    { label: "Ending bond balance", value: ending, format: "number", sub: "proof gallons" },
  ];

  doc.sections = [
    {
      id: "produced",
      tag: "I",
      title: "Spirits Produced",
      description: "Batches whose distillation date falls in the period, grouped by spirit type and class.",
      columns: [
        { key: "spiritType", label: "Spirit type", width: 1.2 },
        { key: "spiritClass", label: "Class" },
        { key: "batchCodes", label: "Batch codes", format: "list", width: 1.6 },
        { key: "batches", label: "Batches", format: "integer", align: "right" },
        { key: "avgProof", label: "Avg. distillation proof", format: "proof", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number", align: "right" },
      ],
      rows: producedRows,
      totals: { spiritType: "Total produced", batches: produced.length, proofGallons: totalProduced },
      emptyHint: "No batch has a distillation date in this period. Record the distillation step on a batch to populate this part.",
    },
    {
      id: "deposited",
      tag: "II",
      title: "Spirits Deposited in Bond",
      description: "Batches whose barrel fill date falls in the period — spirits entering the bonded warehouse.",
      columns: [
        { key: "spiritType", label: "Spirit type", width: 1.2 },
        { key: "spiritClass", label: "Class" },
        { key: "fillNumbers", label: "Fill numbers", format: "list", width: 1.4 },
        { key: "barrels", label: "Fills", format: "integer", align: "right" },
        { key: "wineGallons", label: "Wine gallons", format: "number", align: "right" },
        { key: "avgProof", label: "Avg. fill proof", format: "proof", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number", align: "right" },
      ],
      rows: depositedRows,
      totals: { spiritType: "Total deposited", barrels: deposited.length, wineGallons: totalDepositedWg, proofGallons: totalDeposited },
      emptyHint: "No batch has a fill date in this period. Record the barreling step to populate this part.",
    },
    {
      id: "bond-balance",
      tag: "III",
      title: "Bonded Storage Balance",
      description: "A running ledger of proof gallons in bond, plus a snapshot of the barrels on hand today.",
      columns: [],
      rows: [],
      facts: [
        { group: "Period ledger (proof gallons)", label: "Beginning balance", value: beginning, format: "number" },
        { group: "Period ledger (proof gallons)", label: "Deposited in bond (Part II)", value: totalDeposited, format: "number", sign: "+" },
        { group: "Period ledger (proof gallons)", label: "Removed / bottled (Part IV)", value: totalProcessed, format: "number", sign: "−" },
        { group: "Period ledger (proof gallons)", label: "Losses on barrels (angel's share, samples)", value: lossesInPeriod, format: "number", sign: "−" },
        { group: "Period ledger (proof gallons)", label: "Ending balance", value: ending, format: "number", sign: "=", emphasis: true },
        { group: "In bond today", label: "Barrels", value: inBond.length, format: "integer" },
        { group: "In bond today", label: "Wine gallons", value: inBondWg, format: "number" },
        { group: "In bond today", label: "Proof gallons", value: inBondPg, format: "number", emphasis: true },
      ],
      notes: [
        "The ledger is computed from batch fill and bottling dates and from barrel gauge events. The 'today' snapshot counts barrels with status Filled, Aging or Ready at their latest gauge reading, regardless of the period.",
      ],
    },
    {
      id: "processed",
      tag: "IV",
      title: "Spirits Removed from Bond (Bottled)",
      description: "Batches whose bottling date falls in the period — the taxable removals.",
      columns: [
        { key: "spiritType", label: "Spirit type", width: 1.2 },
        { key: "spiritClass", label: "Class" },
        { key: "lotNumbers", label: "Lot numbers", format: "list", width: 1.3 },
        { key: "avgProof", label: "Avg. bottling proof", format: "proof", align: "right" },
        { key: "cases750", label: "750 mL", format: "integer", align: "right" },
        { key: "cases1000", label: "1 L", format: "integer", align: "right" },
        { key: "cases1750", label: "1.75 L", format: "integer", align: "right" },
        { key: "totalCases", label: "Cases", format: "integer", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number", align: "right" },
        { key: "exciseTax", label: "Excise tax", format: "currency", align: "right" },
      ],
      rows: processedRows,
      totals: {
        spiritType: "Total removed",
        cases750: sum(processed, (b) => num(b.cases750ml)),
        cases1000: sum(processed, (b) => num(b.cases1000ml)),
        cases1750: sum(processed, (b) => num(b.cases1750ml)),
        totalCases: sum(processed, (b) => num(b.totalCases)),
        proofGallons: totalProcessed,
        exciseTax: totalExcise,
      },
      emptyHint: "No batch has a bottling date in this period. Record the bottling step to populate this part.",
    },
  ];

  doc.extras = {
    ttb5110: {
      total_produced: totalProduced,
      prod_batch_count: produced.length,
      total_deposited: totalDeposited,
      total_fill_wine_gallons: totalDepositedWg,
      beginning_bond_balance: beginning,
      period_losses_pg: lossesInPeriod,
      ending_bond_balance: ending,
      total_processed: totalProcessed,
      total_excise_tax: totalExcise,
      total_cases_750: sum(processed, (b) => num(b.cases750ml)),
      total_cases_1000: sum(processed, (b) => num(b.cases1000ml)),
      total_cases_1750: sum(processed, (b) => num(b.cases1750ml)),
      grand_total_cases: sum(processed, (b) => num(b.totalCases)),
      barrels_in_bond_count: inBond.length,
      barrels_in_bond_wg: inBondWg,
      barrels_in_bond_pg: inBondPg,
      produced_by_spirit: producedRows.map((r) => ({ spiritType: r.spiritType, spiritClass: r.spiritClass, batchCount: r.batches, proofGallons: r.proofGallons, batchCodes: r.batchCodes })),
      deposited_by_spirit: depositedRows.map((r) => ({ spiritType: r.spiritType, spiritClass: r.spiritClass, barrelCount: r.barrels, wineGallons: r.wineGallons, proofGallons: r.proofGallons, avgFillProof: r.avgProof, fillNumbers: (r.fillNumbers as string[]).join(", ") })),
      processed_by_spirit: processedRows.map((r) => ({ spiritType: r.spiritType, spiritClass: r.spiritClass, batchCount: 0, proofGallons: r.proofGallons, avgBottlingProof: r.avgProof, cases750: r.cases750, cases1000: r.cases1000, cases1750: r.cases1750, totalCases: r.totalCases, exciseTaxDue: r.exciseTax, lotNumbers: r.lotNumbers })),
    },
  };
  doc.methodology = [
    "Proof gallons = wine gallons × proof ÷ 100. Each batch stores its own proof gallons at distillation, fill and bottling.",
    "Part I uses the distillation date, Part II the barrel fill date and Part IV the bottling date, so a batch can appear in different months for each step.",
    "Excise tax per batch is the figure saved on the batch, or proof gallons × the rate for its tax tier when none is saved.",
    "Losses (angel's share) are the drop between successive barrel gauge readings, plus samples drawn, in proof gallons.",
  ];
  commonWarnings(ctx, doc, true);
  const undated = batches.filter((b) => num(b.proofGallonsProduced) > 0 && !b.distillDate).length;
  if (undated) doc.warnings.push(`${undated} batch${undated === 1 ? " has" : "es have"} proof gallons produced but no distillation date, so they never appear in Part I.`);
  return doc;
}

// ── 2. Federal Excise Tax Return (TTB 5000.24 style) ───────────────────────

interface RemovalLine {
  product: string;
  cases: number;
  casesDistributors: number;
  casesRetail: number;
  abv: number | null;
  wineGallons: number;
  proofGallons: number;
  tier: string;
  rate: number;
  tax: number;
  perBottle: number;
  records: number;
}

function removalsFromInventory(
  records: DistillingInventoryRecord[],
  batches: DistillingBatchRecord[],
  start: string,
  end: string,
): { lines: RemovalLine[]; missingAbv: string[] } {
  const batchById: Record<string, DistillingBatchRecord> = {};
  for (const b of batches) batchById[b.id] = b;
  const inPeriod = records.filter((r) => periodKeyInRange(r.reportMonth, start, end));
  const missingAbv: string[] = [];

  const byProduct = groupBy(inPeriod, (r) => text(r.productName, "Unnamed product"));
  const lines: RemovalLine[] = [];
  for (const [product, items] of byProduct) {
    let casesDistributors = 0;
    let casesRetail = 0;
    let wineGallons = 0;
    let pg = 0;
    let bottles = 0;
    const tierVotes: Record<string, number> = {};
    for (const r of items) {
      const batch = r.batchRecordId ? batchById[r.batchRecordId] : undefined;
      const abv = r.averageAbvPercent ?? (batch?.bottlingProof != null ? num(batch.bottlingProof) / 2 : null);
      if (abv == null) missingAbv.push(product);
      const tier = normalizeTaxTier(batch?.taxClass);
      const dist = r.casesToDistributors ?? {};
      const retail = r.casesToRetail ?? {};
      const sizeKeys = Object.keys(dist).concat(Object.keys(retail).filter((k) => !(k in dist)));
      for (const sizeKey of sizeKeys) {
        const c = num(dist[sizeKey]) + num(retail[sizeKey]);
        if (!c) continue;
        const wg = c * wineGallonsPerCase(sizeKey);
        wineGallons += wg;
        if (abv != null) pg += proofGallons(wg, proofFromAbv(abv));
        bottles += c * (CASE_SIZES[sizeKey]?.bottlesPerCase ?? CASE_SIZES["750ml"].bottlesPerCase);
        tierVotes[tier] = (tierVotes[tier] ?? 0) + c;
      }
      casesDistributors += Object.values(dist).reduce((s, v) => s + num(v), 0);
      casesRetail += Object.values(retail).reduce((s, v) => s + num(v), 0);
    }
    const tier = Object.keys(tierVotes).sort((a, b) => tierVotes[b] - tierVotes[a])[0] ?? "craft_tier1";
    const rate = federalRate(tier);
    const tax = pg * rate;
    const cases = casesDistributors + casesRetail;
    if (!cases) continue;
    lines.push({
      product,
      cases,
      casesDistributors,
      casesRetail,
      abv: avg(items, (r) => r.averageAbvPercent) || null,
      wineGallons,
      proofGallons: pg,
      tier,
      rate,
      tax,
      perBottle: bottles ? tax / bottles : 0,
      records: items.length,
    });
  }
  lines.sort((a, b) => b.tax - a.tax);
  return { lines, missingAbv: missingAbv.filter((v, i) => missingAbv.indexOf(v) === i) };
}

async function buildExciseTax(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "excise-tax");
  const [batches, inventory] = await Promise.all([
    storage.getDistillingBatchRecords(),
    storage.getDistillingInventoryRecords(),
  ]);
  const { start, end } = ctx;
  const { lines, missingAbv } = removalsFromInventory(inventory, batches, start, end);

  const totalPg = sum(lines, (l) => l.proofGallons);
  const totalTax = sum(lines, (l) => l.tax);
  const totalCases = sum(lines, (l) => l.cases);
  const dueDate = federalExciseDueDate(end);

  // Tier summary
  const tierRows: ReportRow[] = FEDERAL_EXCISE_TIERS.map((tier) => {
    const items = lines.filter((l) => l.tier === tier.key);
    return {
      line: tier.line,
      tier: `${taxTierLabel(tier.key)} — ${tier.label}`,
      citation: tier.citation,
      rate: tier.ratePerProofGallon,
      proofGallons: sum(items, (l) => l.proofGallons),
      tax: sum(items, (l) => l.tax),
    };
  });

  // Cross-check: batches bottled in period
  const bottled = batches.filter((b) => within(b.bottlingDate, start, end) && num(b.proofGallonsProcessed) > 0);
  const bottledRows: ReportRow[] = groupBy(bottled, (b) => text(b.productName, "Unnamed product"))
    .map(([product, items]) => ({
      product,
      batches: items.map((b) => b.batchCode),
      cases: sum(items, (b) => num(b.totalCases)),
      proofGallons: sum(items, (b) => num(b.proofGallonsProcessed)),
      tier: taxTierLabel(items[0].taxClass),
      tax: sum(items, batchExciseTax),
    }))
    .sort((a, b) => num(b.tax) - num(a.tax));
  const bottledPg = sum(bottled, (b) => num(b.proofGallonsProcessed));

  doc.kpis = [
    { label: "Net tax due", value: totalTax, format: "currency", sub: `due ${formatDateLong(dueDate)}` },
    { label: "Taxable proof gallons", value: totalPg, format: "number4" },
    { label: "Cases shipped", value: totalCases, format: "integer", sub: "distributors + retail" },
    { label: "Effective rate", value: totalPg ? totalTax / totalPg : 0, format: "currency", sub: "per proof gallon" },
  ];

  doc.sections = [
    {
      id: "identification",
      tag: "I",
      title: "Identification",
      columns: [],
      rows: [],
      facts: [
        { group: "Proprietor", label: "Name", value: ctx.org.name },
        { group: "Proprietor", label: "DSP permit number", value: ctx.org.dspNumber ?? "Not set" },
        { group: "Proprietor", label: "Employer ID (EIN)", value: ctx.org.ein ?? "Not set" },
        { group: "Proprietor", label: "Premises address", value: ctx.org.address ?? "Not set" },
        { group: "Return", label: "Tax period", value: toPeriod(start, end).label },
        { group: "Return", label: "Return and payment due", value: dueDate, format: "date", emphasis: true },
        { group: "Return", label: "Filing", value: "Monthly — TTB Form 5000.24 via Pay.gov" },
      ],
    },
    {
      id: "by-tier",
      tag: "II",
      title: "Tax on Distilled Spirits by Rate Tier",
      description: "Taxable proof gallons removed in the period, at the federal rate tier assigned to each batch (Craft Tier 1 unless set otherwise).",
      columns: [
        { key: "line", label: "Line", align: "center", width: 0.5 },
        { key: "tier", label: "Rate tier", width: 2.2 },
        { key: "citation", label: "Authority", width: 0.9 },
        { key: "rate", label: "Rate / PG", format: "currency", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number4", align: "right" },
        { key: "tax", label: "Tax", format: "currency", align: "right" },
      ],
      rows: tierRows,
      totals: { tier: "Total tax on distilled spirits", proofGallons: totalPg, tax: totalTax },
    },
    {
      id: "by-product",
      tag: "III",
      title: "Taxable Removals by Product (Schedule)",
      description: "Cases shipped to distributors and retail on the weekly inventory records in the period, converted to proof gallons using each product's average ABV.",
      columns: [
        { key: "product", label: "Product", width: 1.6 },
        { key: "casesDistributors", label: "Distributor cases", format: "integer", align: "right" },
        { key: "casesRetail", label: "Retail cases", format: "integer", align: "right" },
        { key: "cases", label: "Total cases", format: "integer", align: "right" },
        { key: "abv", label: "ABV", format: "percent", align: "right" },
        { key: "wineGallons", label: "Wine gallons", format: "number", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number4", align: "right" },
        { key: "tierLabel", label: "Tier" },
        { key: "tax", label: "Excise tax", format: "currency", align: "right" },
        { key: "perBottle", label: "Per bottle", format: "currency", align: "right" },
      ],
      rows: lines.map((l) => ({
        product: l.product,
        casesDistributors: l.casesDistributors,
        casesRetail: l.casesRetail,
        cases: l.cases,
        abv: l.abv,
        wineGallons: l.wineGallons,
        proofGallons: l.proofGallons,
        tierLabel: taxTierLabel(l.tier),
        tax: l.tax,
        perBottle: l.perBottle,
      })),
      totals: {
        product: "Total",
        casesDistributors: sum(lines, (l) => l.casesDistributors),
        casesRetail: sum(lines, (l) => l.casesRetail),
        cases: totalCases,
        wineGallons: sum(lines, (l) => l.wineGallons),
        proofGallons: totalPg,
        tax: totalTax,
      },
      emptyHint: "No inventory record in this period has cases shipped to distributors or retail. Record the weekly inventory on a bottled batch to populate this schedule.",
    },
    {
      id: "summary",
      tag: "IV",
      title: "Summary and Amount Due",
      columns: [],
      rows: [],
      facts: [
        { group: "Amount due", label: "Line 8 — Total tax liability, distilled spirits", value: totalTax, format: "currency" },
        { group: "Amount due", label: "Line 9 — Adjustments increasing tax", value: 0, format: "currency", sign: "+" },
        { group: "Amount due", label: "Line 11 — Adjustments decreasing tax", value: 0, format: "currency", sign: "−" },
        { group: "Amount due", label: "Line 12 — Net amount due", value: totalTax, format: "currency", sign: "=", emphasis: true },
        { group: "Payment", label: "Method", value: "Electronic funds transfer via Pay.gov" },
        { group: "Payment", label: "Due date", value: dueDate, format: "date", emphasis: true },
        { group: "Payment", label: "Reference", value: `${ctx.org.dspNumber ?? "DSP —"} · ${toPeriod(start, end).label}` },
      ],
      notes: ["Adjustments (credits, prior-period corrections) are not tracked by Distillr. Enter them on the TTB form if they apply."],
    },
    {
      id: "bottled-crosscheck",
      tag: "V",
      title: "Cross-check: Spirits Bottled in the Period",
      description: "What left bond at bottling according to batch records. Compare with Part III — the two match when every bottled case was shipped in the same period.",
      columns: [
        { key: "product", label: "Product", width: 1.6 },
        { key: "batches", label: "Batches", format: "list", width: 1.4 },
        { key: "cases", label: "Cases bottled", format: "integer", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number4", align: "right" },
        { key: "tier", label: "Tier" },
        { key: "tax", label: "Tax on batch", format: "currency", align: "right" },
      ],
      rows: bottledRows,
      totals: { product: "Total bottled", cases: sum(bottled, (b) => num(b.totalCases)), proofGallons: bottledPg, tax: sum(bottled, batchExciseTax) },
      emptyHint: "No batch has a bottling date in this period.",
    },
  ];

  doc.extras = {
    ttb5000: {
      rows: lines.map((l) => ({ key: l.product, name: l.product, abv: l.abv ?? 0, distCases: l.casesDistributors, retailCases: l.casesRetail, totalCases: l.cases, proofGallons: round(l.proofGallons, 4), exciseTax: round(l.tax, 2), perBottle: round(l.perBottle, 2) })),
      totalDistCases: sum(lines, (l) => l.casesDistributors),
      totalRetailCases: sum(lines, (l) => l.casesRetail),
      totalCases,
      totalProofGallons: round(totalPg, 4),
      totalExciseTax: round(totalTax, 2),
    },
  };
  doc.methodology = [
    "Taxable removals are the cases shipped to distributors and retail on the weekly inventory records whose week falls in the period (a week belongs to the month of its Thursday).",
    "Wine gallons per case use the bottle size on the record (6 × 750 mL = 1.19 gal, 6 × 1 L = 1.59 gal, 6 × 1.75 L = 2.77 gal).",
    "Proof gallons = wine gallons × (ABV × 2) ÷ 100, using the record's average ABV, or the linked batch's bottling proof.",
    "Each product is taxed at the tier set on its batch (default Craft Tier 1 at $2.70/PG). Tier limits apply to the calendar year across all products.",
    "The return and payment are due on the 14th of the month after the period.",
  ];
  commonWarnings(ctx, doc, true);
  if (!ctx.org.ein) doc.warnings.push("No EIN is set. Add it under Settings → Company Info.");
  if (missingAbv.length) doc.warnings.push(`No ABV on inventory records for: ${missingAbv.join(", ")}. Their cases are counted but produce no proof gallons until an ABV is entered.`);
  if (totalPg > 100_000) doc.warnings.push("More than 100,000 proof gallons in one period — check whether the Tier 2 rate applies to part of it.");
  return doc;
}

// ── 3. Batch activity ──────────────────────────────────────────────────────

function batchRow(b: DistillingBatchRecord): ReportRow {
  return {
    batchCode: b.batchCode,
    product: text(b.productName, "—"),
    spiritType: titleCase(text(b.spiritType, "—")),
    stage: STAGE_LABELS[b.stage] ?? titleCase(b.stage),
    batchDate: b.batchDate ?? null,
    distillDate: b.distillDate ?? null,
    fillDate: b.fillDate ?? null,
    bottlingDate: b.bottlingDate ?? null,
    pgProduced: b.proofGallonsProduced ?? null,
    pgDeposited: b.fillProofGallons ?? null,
    pgProcessed: b.proofGallonsProcessed ?? null,
    cases: b.totalCases ?? null,
    lotNumber: b.lotNumber ?? null,
    taxTier: b.proofGallonsProcessed ? taxTierLabel(b.taxClass) : null,
    exciseTax: b.proofGallonsProcessed ? batchExciseTax(b) : null,
  };
}

const BATCH_COLUMNS = [
  { key: "batchCode", label: "Batch", width: 1.1 },
  { key: "product", label: "Product", width: 1.3 },
  { key: "spiritType", label: "Spirit" },
  { key: "stage", label: "Stage" },
  { key: "distillDate", label: "Distilled", format: "date" as const },
  { key: "fillDate", label: "Barreled", format: "date" as const },
  { key: "bottlingDate", label: "Bottled", format: "date" as const },
  { key: "pgProduced", label: "PG produced", format: "number" as const, align: "right" as const },
  { key: "pgDeposited", label: "PG in bond", format: "number" as const, align: "right" as const },
  { key: "pgProcessed", label: "PG removed", format: "number" as const, align: "right" as const },
  { key: "cases", label: "Cases", format: "integer" as const, align: "right" as const },
  { key: "exciseTax", label: "Excise tax", format: "currency" as const, align: "right" as const },
];

function batchTotals(label: string, items: DistillingBatchRecord[]): ReportRow {
  return {
    batchCode: label,
    pgProduced: sum(items, (b) => num(b.proofGallonsProduced)),
    pgDeposited: sum(items, (b) => num(b.fillProofGallons)),
    pgProcessed: sum(items, (b) => num(b.proofGallonsProcessed)),
    cases: sum(items, (b) => num(b.totalCases)),
    exciseTax: sum(items.filter((b) => num(b.proofGallonsProcessed) > 0), batchExciseTax),
  };
}

async function buildBatchActivity(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "batch-activity");
  const batches = await storage.getDistillingBatchRecords();
  const { start, end } = ctx;
  const active = batches
    .filter((b) => within(b.distillDate, start, end) || within(b.fillDate, start, end) || within(b.bottlingDate, start, end))
    .sort((a, b) => String(a.bottlingDate ?? a.fillDate ?? a.distillDate ?? "").localeCompare(String(b.bottlingDate ?? b.fillDate ?? b.distillDate ?? "")));

  doc.kpis = [
    { label: "Active batches", value: active.length, format: "integer" },
    { label: "Distilled", value: active.filter((b) => within(b.distillDate, start, end)).length, format: "integer", sub: "batches" },
    { label: "Barreled", value: active.filter((b) => within(b.fillDate, start, end)).length, format: "integer", sub: "batches" },
    { label: "Bottled", value: active.filter((b) => within(b.bottlingDate, start, end)).length, format: "integer", sub: "batches" },
  ];
  doc.sections = [
    {
      id: "batches",
      title: "Batches with activity",
      description: "Any batch with a distillation, barrel fill or bottling date inside the period. Figures are the batch's own totals, not just the part that happened this period.",
      columns: BATCH_COLUMNS,
      rows: active.map(batchRow),
      totals: batchTotals("Total", active),
      emptyHint: "No batch has a distillation, fill or bottling date in this period.",
    },
  ];
  doc.methodology = ["A batch is listed once even if several steps happened in the period.", "Excise tax is the saved batch figure or proof gallons removed × the batch's tier rate."];
  return doc;
}

// ── 4. Production ledger ───────────────────────────────────────────────────

async function buildProductionLedger(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "production-ledger");
  const batches = (await storage.getDistillingBatchRecords())
    .filter((b) => within(b.batchDate, ctx.start, ctx.end))
    .sort((a, b) => String(a.batchDate).localeCompare(String(b.batchDate)));

  const byProduct = groupBy(batches, (b) => text(b.productName, "Unnamed product"))
    .map(([product, items]) => ({
      product,
      batches: items.length,
      closed: items.filter((b) => b.stage === "closed").length,
      pgProduced: sum(items, (b) => num(b.proofGallonsProduced)),
      pgDeposited: sum(items, (b) => num(b.fillProofGallons)),
      pgProcessed: sum(items, (b) => num(b.proofGallonsProcessed)),
      cases: sum(items, (b) => num(b.totalCases)),
      yieldPct: sum(items, (b) => num(b.proofGallonsProduced)) ? (sum(items, (b) => num(b.proofGallonsProcessed)) / sum(items, (b) => num(b.proofGallonsProduced))) * 100 : null,
    }))
    .sort((a, b) => b.pgProduced - a.pgProduced);

  doc.kpis = [
    { label: "Batches started", value: batches.length, format: "integer" },
    { label: "Proof gallons produced", value: sum(batches, (b) => num(b.proofGallonsProduced)), format: "number" },
    { label: "Cases bottled", value: sum(batches, (b) => num(b.totalCases)), format: "integer" },
    { label: "Products", value: byProduct.length, format: "integer" },
  ];
  doc.sections = [
    {
      id: "by-product",
      tag: "A",
      title: "Summary by product",
      description: "All batches started in the period, rolled up by product.",
      columns: [
        { key: "product", label: "Product", width: 1.6 },
        { key: "batches", label: "Batches", format: "integer", align: "right" },
        { key: "closed", label: "Closed", format: "integer", align: "right" },
        { key: "pgProduced", label: "PG produced", format: "number", align: "right" },
        { key: "pgDeposited", label: "PG in bond", format: "number", align: "right" },
        { key: "pgProcessed", label: "PG removed", format: "number", align: "right" },
        { key: "cases", label: "Cases", format: "integer", align: "right" },
        { key: "yieldPct", label: "Removed ÷ produced", format: "percent", align: "right", help: "How much of what was distilled has been bottled so far." },
      ],
      rows: byProduct,
      totals: {
        product: "All products",
        batches: batches.length,
        closed: batches.filter((b) => b.stage === "closed").length,
        pgProduced: sum(batches, (b) => num(b.proofGallonsProduced)),
        pgDeposited: sum(batches, (b) => num(b.fillProofGallons)),
        pgProcessed: sum(batches, (b) => num(b.proofGallonsProcessed)),
        cases: sum(batches, (b) => num(b.totalCases)),
      },
      emptyHint: "No batches were started in this period.",
    },
    {
      id: "batches",
      tag: "B",
      title: "Batch detail",
      columns: BATCH_COLUMNS,
      rows: batches.map(batchRow),
      totals: batchTotals("Total", batches),
      emptyHint: "No batches were started in this period.",
    },
  ];
  doc.methodology = ["A batch belongs to the period of its batch (start) date.", "'Removed ÷ produced' compares proof gallons bottled to proof gallons distilled; aging batches will show a low figure until they are bottled."];
  return doc;
}

// ── 5. Barrel inventory (point in time) ────────────────────────────────────

async function buildBarrelInventory(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "barrel-inventory", false);
  const [barrels, events] = await Promise.all([storage.getBarrels(), storage.getAllBarrelEvents()]);
  const lossByBarrel: Record<string, number> = {};
  for (const l of computeLosses(barrels, events)) lossByBarrel[l.barrelId] = (lossByBarrel[l.barrelId] ?? 0) + l.proofGallons;

  const inBond = barrels.filter((b) => IN_BOND_STATUSES.has(b.status));
  const out = barrels.filter((b) => !IN_BOND_STATUSES.has(b.status));

  const row = (b: Barrel): ReportRow => {
    const agingDays = b.fillDate ? daysBetween(b.fillDate, b.dumpDate ?? ctx.today) : num(b.totalAgingDays);
    const currentPg = currentProofGallonsOf(b, events);
    return {
      serialNumber: b.serialNumber,
      product: text(b.productName, "—"),
      status: b.status,
      zone: text(b.warehouseZone, "—"),
      charLevel: text(b.charLevel, "—"),
      fillDate: b.fillDate ?? null,
      agingDays,
      agingYears: agingDays ? agingDays / 365.25 : null,
      fillProof: b.fillProof ?? null,
      fillWg: b.fillVolume ?? null,
      fillPg: b.fillProofGallons ?? null,
      currentWg: currentWineGallonsOf(b, events),
      currentPg,
      losses: (lossByBarrel[b.id] ?? 0) || (b.lossesProofGallons ?? 0) || null,
    };
  };
  const columns = [
    { key: "serialNumber", label: "Barrel", width: 1 },
    { key: "product", label: "Product", width: 1.3 },
    { key: "status", label: "Status" },
    { key: "zone", label: "Zone" },
    { key: "charLevel", label: "Char" },
    { key: "fillDate", label: "Filled", format: "date" as const },
    { key: "agingYears", label: "Age (yrs)", format: "number" as const, align: "right" as const },
    { key: "fillProof", label: "Fill proof", format: "proof" as const, align: "right" as const },
    { key: "fillWg", label: "Fill WG", format: "number" as const, align: "right" as const },
    { key: "fillPg", label: "Fill PG", format: "number" as const, align: "right" as const },
    { key: "currentPg", label: "Current PG", format: "number" as const, align: "right" as const },
    { key: "losses", label: "Losses PG", format: "number" as const, align: "right" as const },
  ];
  const totals = (label: string, items: Barrel[]): ReportRow => ({
    serialNumber: label,
    fillWg: sum(items, (b) => num(b.fillVolume)),
    fillPg: sum(items, (b) => num(b.fillProofGallons)),
    currentPg: sum(items, (b) => currentProofGallonsOf(b, events)),
    losses: sum(items, (b) => lossByBarrel[b.id] ?? num(b.lossesProofGallons)),
  });

  const byProduct = groupBy(inBond, (b) => text(b.productName, "Unnamed product")).map(([product, items]) => ({
    product,
    barrels: items.length,
    avgAgeYears: avg(items, (b) => (b.fillDate ? daysBetween(b.fillDate, ctx.today) / 365.25 : null)),
    currentWg: sum(items, (b) => currentWineGallonsOf(b, events)),
    currentPg: sum(items, (b) => currentProofGallonsOf(b, events)),
  }));
  const byZone = groupBy(inBond, (b) => text(b.warehouseZone, "No zone")).map(([zone, items]) => ({
    zone,
    barrels: items.length,
    currentPg: sum(items, (b) => currentProofGallonsOf(b, events)),
  }));

  doc.kpis = [
    { label: "Barrels in bond", value: inBond.length, format: "integer", sub: `of ${barrels.length} tracked` },
    { label: "Proof gallons in bond", value: sum(inBond, (b) => currentProofGallonsOf(b, events)), format: "number" },
    { label: "Wine gallons in bond", value: sum(inBond, (b) => currentWineGallonsOf(b, events)), format: "number" },
    { label: "Average age", value: avg(inBond, (b) => (b.fillDate ? daysBetween(b.fillDate, ctx.today) / 365.25 : null)), format: "number", sub: "years" },
  ];
  doc.sections = [
    {
      id: "by-product",
      tag: "A",
      title: "In bond by product",
      columns: [
        { key: "product", label: "Product", width: 1.6 },
        { key: "barrels", label: "Barrels", format: "integer", align: "right" },
        { key: "avgAgeYears", label: "Avg. age (yrs)", format: "number", align: "right" },
        { key: "currentWg", label: "Wine gallons", format: "number", align: "right" },
        { key: "currentPg", label: "Proof gallons", format: "number", align: "right" },
      ],
      rows: byProduct.sort((a, b) => b.currentPg - a.currentPg),
      totals: { product: "Total in bond", barrels: inBond.length, currentWg: sum(inBond, (b) => currentWineGallonsOf(b, events)), currentPg: sum(inBond, (b) => currentProofGallonsOf(b, events)) },
      emptyHint: "No barrels are currently Filled, Aging or Ready.",
    },
    {
      id: "by-zone",
      tag: "B",
      title: "In bond by warehouse zone",
      columns: [
        { key: "zone", label: "Zone", width: 1.6 },
        { key: "barrels", label: "Barrels", format: "integer", align: "right" },
        { key: "currentPg", label: "Proof gallons", format: "number", align: "right" },
      ],
      rows: byZone.sort((a, b) => b.barrels - a.barrels),
      emptyHint: "No barrels are currently in bond.",
    },
    {
      id: "in-bond",
      tag: "C",
      title: "Barrel register — in bond",
      description: "Every barrel with status Filled, Aging or Ready, oldest first.",
      columns,
      rows: inBond.sort((a, b) => String(a.fillDate ?? "").localeCompare(String(b.fillDate ?? ""))).map(row),
      totals: totals("Total in bond", inBond),
      emptyHint: "No barrels are currently in bond.",
    },
    {
      id: "out-of-bond",
      tag: "D",
      title: "Dumped and retired barrels",
      columns,
      rows: out.sort((a, b) => String(b.dumpDate ?? "").localeCompare(String(a.dumpDate ?? ""))).map(row),
      totals: totals("Total", out),
      emptyHint: "No barrels have been dumped or retired.",
    },
  ];
  doc.methodology = [
    `Figures are as of ${formatDateLong(ctx.today)}; this report has no period filter.`,
    "Current proof gallons use the barrel's latest gauge when one is recorded, otherwise the fill figure.",
    "Age counts days from the fill date to today (or to the dump date for dumped barrels).",
    "Losses are the drop between successive gauge readings plus samples drawn, in proof gallons (the barrel's angel's share).",
  ];
  return doc;
}

// ── 6. Finished goods movement ─────────────────────────────────────────────

async function buildFinishedGoods(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "finished-goods");
  const records = await storage.getDistillingInventoryRecords();
  const inPeriod = records.filter((r) => periodKeyInRange(r.reportMonth, ctx.start, ctx.end)).sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));

  const casesOf = (m: Record<string, number> | null | undefined) => Object.values(m ?? {}).reduce((s, v) => s + num(v), 0);

  const byProduct = groupBy(inPeriod, (r) => text(r.productName, "Unnamed product")).map(([product, items]) => {
    const first = items[0];
    const last = items[items.length - 1];
    return {
      product,
      periods: items.length,
      beginning: num(first.beginningOfMonthCases),
      made: sum(items, (r) => casesOf(r.casesMade)),
      toDistributors: sum(items, (r) => casesOf(r.casesToDistributors)),
      toRetail: sum(items, (r) => casesOf(r.casesToRetail)),
      ending: num(last.endingMonthInventory),
      endingPg: num(last.endingProofGallons),
    };
  });

  const byMonth = inPeriod.map((r) => ({
    period: periodKeyLabel(r.reportMonth),
    product: text(r.productName, "Unnamed product"),
    abv: r.averageAbvPercent ?? null,
    beginning: num(r.beginningOfMonthCases),
    made: casesOf(r.casesMade),
    toDistributors: casesOf(r.casesToDistributors),
    toRetail: casesOf(r.casesToRetail),
    ending: num(r.endingMonthInventory),
    endingPg: num(r.endingProofGallons),
  }));

  doc.kpis = [
    { label: "Cases made", value: sum(byProduct, (p) => p.made), format: "integer" },
    { label: "To distributors", value: sum(byProduct, (p) => p.toDistributors), format: "integer", sub: "cases" },
    { label: "To retail", value: sum(byProduct, (p) => p.toRetail), format: "integer", sub: "cases" },
    { label: "On hand at period end", value: sum(byProduct, (p) => p.ending), format: "integer", sub: "cases" },
  ];
  doc.sections = [
    {
      id: "by-product",
      tag: "A",
      title: "Movement by product",
      description: "Beginning inventory from the first weekly record in the period, ending inventory from the last.",
      columns: [
        { key: "product", label: "Product", width: 1.6 },
        { key: "periods", label: "Weeks", format: "integer", align: "right" },
        { key: "beginning", label: "Beginning", format: "integer", align: "right" },
        { key: "made", label: "Made", format: "integer", align: "right" },
        { key: "toDistributors", label: "To distributors", format: "integer", align: "right" },
        { key: "toRetail", label: "To retail", format: "integer", align: "right" },
        { key: "ending", label: "Ending", format: "integer", align: "right" },
        { key: "endingPg", label: "Ending PG", format: "number", align: "right" },
      ],
      rows: byProduct.sort((a, b) => b.made + b.toDistributors - (a.made + a.toDistributors)),
      totals: {
        product: "All products",
        beginning: sum(byProduct, (p) => p.beginning),
        made: sum(byProduct, (p) => p.made),
        toDistributors: sum(byProduct, (p) => p.toDistributors),
        toRetail: sum(byProduct, (p) => p.toRetail),
        ending: sum(byProduct, (p) => p.ending),
        endingPg: sum(byProduct, (p) => p.endingPg),
      },
      emptyHint: "No weekly inventory records fall in this period. They are created from a batch's Bottling step.",
    },
    {
      id: "by-month",
      tag: "B",
      title: "Weekly detail",
      columns: [
        { key: "period", label: "Week", width: 1.4 },
        { key: "product", label: "Product", width: 1.5 },
        { key: "abv", label: "ABV", format: "percent", align: "right" },
        { key: "beginning", label: "Beginning", format: "integer", align: "right" },
        { key: "made", label: "Made", format: "integer", align: "right" },
        { key: "toDistributors", label: "To distributors", format: "integer", align: "right" },
        { key: "toRetail", label: "To retail", format: "integer", align: "right" },
        { key: "ending", label: "Ending", format: "integer", align: "right" },
        { key: "endingPg", label: "Ending PG", format: "number", align: "right" },
      ],
      rows: byMonth,
      emptyHint: "No weekly inventory records fall in this period.",
    },
  ];
  doc.methodology = ["Inventory is recorded weekly; a week belongs to the month of its Thursday.", "Cases are summed across bottle sizes on each record.", "Ending proof gallons is the figure on the last weekly record in the period."];
  return doc;
}

// ── 7. Sales summary ───────────────────────────────────────────────────────

function orderCases(o: SalesOrder): number {
  return sum(o.lineItems ?? [], (li) => (/(case|cs)/i.test(li.unit ?? "case") ? num(li.quantity) : 0));
}

async function buildSales(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "sales");
  const [orders, clients] = await Promise.all([storage.getSalesOrders(), storage.getClients()]);
  const clientById = new Map<string, Client>(clients.map((c) => [c.id, c]));
  const inPeriod = orders.filter((o) => within(o.orderDate, ctx.start, ctx.end)).sort((a, b) => a.orderDate.localeCompare(b.orderDate));

  const revenue = sum(inPeriod, (o) => num(o.totalAmount));
  const byPartner = groupBy(inPeriod, (o) => o.clientId).map(([clientId, items]) => {
    const c = clientById.get(clientId);
    return {
      partner: c?.name ?? "Unknown partner",
      type: c?.type ?? "—",
      orders: items.length,
      cases: sum(items, orderCases),
      revenue: sum(items, (o) => num(o.totalAmount)),
      share: revenue ? (sum(items, (o) => num(o.totalAmount)) / revenue) * 100 : null,
    };
  });
  const byStatus = groupBy(inPeriod, (o) => o.status).map(([status, items]) => ({
    status,
    orders: items.length,
    revenue: sum(items, (o) => num(o.totalAmount)),
  }));

  doc.kpis = [
    { label: "Orders", value: inPeriod.length, format: "integer" },
    { label: "Revenue", value: revenue, format: "currency" },
    { label: "Cases ordered", value: sum(inPeriod, orderCases), format: "integer" },
    { label: "Trading partners", value: byPartner.length, format: "integer" },
  ];
  doc.sections = [
    {
      id: "by-partner",
      tag: "A",
      title: "By trading partner",
      columns: [
        { key: "partner", label: "Trading partner", width: 1.6 },
        { key: "type", label: "Type" },
        { key: "orders", label: "Orders", format: "integer", align: "right" },
        { key: "cases", label: "Cases", format: "integer", align: "right" },
        { key: "revenue", label: "Revenue", format: "currency", align: "right" },
        { key: "share", label: "Share", format: "percent", align: "right" },
      ],
      rows: byPartner.sort((a, b) => b.revenue - a.revenue),
      totals: { partner: "Total", orders: inPeriod.length, cases: sum(inPeriod, orderCases), revenue },
      emptyHint: "No sales orders have an order date in this period.",
    },
    {
      id: "by-status",
      tag: "B",
      title: "By order status",
      columns: [
        { key: "status", label: "Status", width: 1.4 },
        { key: "orders", label: "Orders", format: "integer", align: "right" },
        { key: "revenue", label: "Revenue", format: "currency", align: "right" },
      ],
      rows: byStatus,
      emptyHint: "No sales orders in this period.",
    },
    {
      id: "orders",
      tag: "C",
      title: "Order detail",
      columns: [
        { key: "orderNumber", label: "Order", width: 1 },
        { key: "orderDate", label: "Date", format: "date" },
        { key: "partner", label: "Trading partner", width: 1.5 },
        { key: "status", label: "Status" },
        { key: "items", label: "Items", format: "list", width: 1.8 },
        { key: "cases", label: "Cases", format: "integer", align: "right" },
        { key: "amount", label: "Amount", format: "currency", align: "right" },
        { key: "fulfilled", label: "Fulfilled", format: "date" },
      ],
      rows: inPeriod.map((o) => ({
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        partner: clientById.get(o.clientId)?.name ?? "Unknown partner",
        status: o.status,
        items: (o.lineItems ?? []).map((li) => `${li.quantity} × ${li.description}`),
        cases: orderCases(o),
        amount: o.totalAmount ?? null,
        fulfilled: o.fulfilledDate ?? null,
      })),
      totals: { orderNumber: "Total", cases: sum(inPeriod, orderCases), amount: revenue },
      emptyHint: "No sales orders in this period.",
    },
  ];
  doc.methodology = ["Orders belong to the period of their order date.", "Cases count line items whose unit is a case; other units are listed but not counted as cases."];
  return doc;
}

// ── 8. State excise returns ────────────────────────────────────────────────

async function buildStateExcise(ctx: Ctx): Promise<ReportDocument> {
  const doc = baseDoc(ctx, "state-excise");
  const returns = await getStateExciseReturns();
  const inPeriod = returns
    .filter((r) => r.periodStart <= ctx.end && r.periodEnd >= ctx.start)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const byState = groupBy(inPeriod, (r) => r.state).map(([state, items]) => ({
    state,
    returns: items.length,
    proofGallons: sum(items, (r) => num(r.totalProofGallons)),
    tax: sum(items, (r) => num(r.totalTax)),
    unfiled: items.filter((r) => r.status !== "filed").length,
  }));

  doc.kpis = [
    { label: "Returns", value: inPeriod.length, format: "integer" },
    { label: "Total state tax", value: sum(inPeriod, (r) => num(r.totalTax)), format: "currency" },
    { label: "Proof gallons reported", value: sum(inPeriod, (r) => num(r.totalProofGallons)), format: "number" },
    { label: "Not yet filed", value: inPeriod.filter((r) => r.status !== "filed").length, format: "integer" },
  ];
  doc.sections = [
    {
      id: "by-state",
      tag: "A",
      title: "By state",
      columns: [
        { key: "state", label: "State" },
        { key: "returns", label: "Returns", format: "integer", align: "right" },
        { key: "proofGallons", label: "Proof gallons", format: "number", align: "right" },
        { key: "tax", label: "Tax", format: "currency", align: "right" },
        { key: "unfiled", label: "Not filed", format: "integer", align: "right" },
      ],
      rows: byState.sort((a, b) => b.tax - a.tax),
      totals: { state: "Total", returns: inPeriod.length, proofGallons: sum(inPeriod, (r) => num(r.totalProofGallons)), tax: sum(inPeriod, (r) => num(r.totalTax)) },
      emptyHint: "No state excise returns overlap this period. Add them under Regulatory → State Excise.",
    },
    {
      id: "returns",
      tag: "B",
      title: "Return detail",
      columns: [
        { key: "state", label: "State" },
        { key: "periodStart", label: "Period start", format: "date" },
        { key: "periodEnd", label: "Period end", format: "date" },
        { key: "dueDate", label: "Due", format: "date" },
        { key: "status", label: "Status" },
        { key: "proofGallons", label: "Proof gallons", format: "number", align: "right" },
        { key: "rate", label: "Rate / PG", format: "currency", align: "right" },
        { key: "tax", label: "Tax", format: "currency", align: "right" },
        { key: "filedAt", label: "Filed", format: "date" },
      ],
      rows: inPeriod.map((r) => ({
        state: r.state,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        dueDate: r.dueDate,
        status: titleCase(r.status),
        proofGallons: r.totalProofGallons,
        rate: r.ratePerProofGallon,
        tax: r.totalTax,
        filedAt: r.filedAt ? r.filedAt.slice(0, 10) : null,
      })),
      totals: { state: "Total", proofGallons: sum(inPeriod, (r) => num(r.totalProofGallons)), tax: sum(inPeriod, (r) => num(r.totalTax)) },
      emptyHint: "No state excise returns overlap this period.",
    },
  ];
  doc.methodology = ["A return is included when its reporting period overlaps the selected range.", "Tax = proof gallons × the state rate saved on the return."];
  return doc;
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

export async function buildReport(kind: ReportKind, range: { start: string; end: string }): Promise<ReportDocument> {
  const config = await storage.getPlatformConfig();
  const ctx: Ctx = {
    start: range.start,
    end: range.end,
    config,
    org: organizationFrom(config),
    today: new Date().toISOString().slice(0, 10),
  };
  let doc: ReportDocument;
  switch (kind) {
    case "production-operations":
      doc = await buildProductionOperations(ctx);
      break;
    case "excise-tax":
      doc = await buildExciseTax(ctx);
      break;
    case "batch-activity":
      doc = await buildBatchActivity(ctx);
      break;
    case "production-ledger":
      doc = await buildProductionLedger(ctx);
      break;
    case "barrel-inventory":
      doc = await buildBarrelInventory(ctx);
      break;
    case "finished-goods":
      doc = await buildFinishedGoods(ctx);
      break;
    case "sales":
      doc = await buildSales(ctx);
      break;
    case "state-excise":
      doc = await buildStateExcise(ctx);
      break;
  }
  if (ctx.org.name === "Your distillery") {
    doc.warnings.unshift("No company name is set. Add it under Settings → Company Info so it prints on this report.");
  }
  // Round every numeric cell so screen and exports agree to the cent / hundredth.
  for (const kpi of doc.kpis) if (typeof kpi.value === "number") kpi.value = round(kpi.value, kpi.format === "number4" ? 4 : 2);
  for (const s of doc.sections) {
    const digitsFor = (key: string) => (s.columns.find((c) => c.key === key)?.format === "number4" ? 4 : 2);
    for (const r of [...s.rows, ...(s.totals ? [s.totals] : [])]) {
      for (const k of Object.keys(r)) if (typeof r[k] === "number") r[k] = round(r[k] as number, digitsFor(k));
    }
    for (const f of s.facts ?? []) if (typeof f.value === "number") f.value = round(f.value, f.format === "number4" ? 4 : 2);
  }
  return doc;
}
