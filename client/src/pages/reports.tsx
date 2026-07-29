import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { fmt, fmtNum } from "../lib/utils";
import { exportReportsToExcel } from "../lib/exportExcel";
import { export5110Word, export5000Word } from "../lib/exportWord";

const STAGE_LABELS: Record<string, string> = {
  planning: "Planning", mash_fermentation: "Mash & Fermentation",
  distillation: "Distillation", barreling: "Barreling",
  aging: "Aging", bottling: "Bottling", closed: "Closed",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SpiritProducedRow {
  spiritType: string;
  spiritClass: string;
  batchCount: number;
  proofGallons: number;
  batchCodes: string[];
}

interface SpiritDepositedRow {
  spiritType: string;
  spiritClass: string;
  barrelCount: number;
  wineGallons: number;
  proofGallons: number;
  avgFillProof: number;
  fillNumbers: string;
}

interface SpiritProcessedRow {
  spiritType: string;
  spiritClass: string;
  batchCount: number;
  proofGallons: number;
  avgBottlingProof: number;
  cases750: number;
  cases1000: number;
  cases1750: number;
  totalCases: number;
  wineGallonsBottled: number;
  exciseTaxDue: number;
  lotNumbers: string[];
}

interface OperationsSummary {
  total_produced: number;
  prod_batch_count: number;
  total_deposited: number;
  total_fill_wine_gallons: number;
  beginning_bond_balance: number;
  period_losses_pg: number;
  ending_bond_balance: number;
  total_processed: number;
  total_excise_tax: number;
  total_cases_750: number;
  total_cases_1000: number;
  total_cases_1750: number;
  grand_total_cases: number;
  barrels_in_bond_count: number;
  barrels_in_bond_wg: number;
  barrels_in_bond_pg: number;
  produced_by_spirit: SpiritProducedRow[];
  deposited_by_spirit: SpiritDepositedRow[];
  processed_by_spirit: SpiritProcessedRow[];
}

interface BatchPeriodRow {
  id: string;
  batchCode: string;
  batchDate: string;
  stage: string;
  status: string;
  productName: string | null;
  spiritType: string | null;
  proofGallonsProduced: number | null;
  fillProofGallons: number | null;
  proofGallonsProcessed: number | null;
  exciseTaxDue: number | null;
  totalCases: number | null;
  bottlingDate: string | null;
  distillDate: string | null;
  fillDate: string | null;
  taxClass: string | null;
  lotNumber: string | null;
}

interface StateOrder {
  id: string;
  order_number: string | null;
  order_date: string | null;
  status: string | null;
  total_amount: string | null;
  currency: string | null;
  client_name: string | null;
  client_type: string | null;
  batch_code: string | null;
  product_name: string | null;
  spirit_type: string | null;
  lot_number: string | null;
  total_cases: number | null;
}

interface StateDistributorReport {
  orders: StateOrder[];
  totalOrders: number;
  totalRevenue: number;
}

interface PlatformConfig {
  dspNumber: string | null;
  organizationNameOverride: string | null;
  organizationName: string;
}

interface AllBatchRow {
  id: string;
  batchCode: string;
  batchDate: string;
  stage: string;
  productName: string | null;
  spiritType: string | null;
  spiritClass: string | null;
  proofGallonsProduced: number | null;
  fillProofGallons: number | null;
  proofGallonsProcessed: number | null;
  cases750ml: number | null;
  cases1000ml: number | null;
  cases1750ml: number | null;
  totalCases: number | null;
  exciseTaxDue: number | null;
  taxClass: string | null;
  lotNumber: string | null;
  bottlingDate: string | null;
}

interface BarrelSummaryRow {
  id: string;
  serialNumber: string;
  productName: string | null;
  status: string;
  fillDate: string | null;
  fillProof: number | null;
  fillVolume: number | null;
  fillProofGallons: number | null;
  warehouseZone: string | null;
  charLevel: string | null;
}

interface ExciseProductRow {
  key: string;
  name: string;
  abv: number;
  distCases: number;
  retailCases: number;
  totalCases: number;
  proofGallons: number;
  exciseTax: number;
  perBottle: number;
}

interface ExciseByProductReport {
  rows: ExciseProductRow[];
  totalDistCases: number;
  totalRetailCases: number;
  totalCases: number;
  totalProofGallons: number;
  totalExciseTax: number;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? "bg-[#f0f9ff] border-[#bae6fd]" : "bg-[#f7f7f7] border-[#e5e5e5]"}`}>
      <p className="text-xs text-[#737373]">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${highlight ? "text-[#0369a1]" : "text-[#0a0a0a]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#a3a3a3] mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tax class label helper
// ---------------------------------------------------------------------------
function taxClassLabel(tc: string | null): string {
  if (!tc) return "—";
  if (tc === "craft_tier1") return "Craft Tier 1";
  if (tc === "craft_tier2") return "Craft Tier 2";
  if (tc === "standard") return "Standard";
  return tc;
}

const taxClassRates: Record<string, number> = {
  craft_tier1: 2.70,
  craft_tier2: 13.34,
  standard: 13.50,
};

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------
export default function Reports() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [tab, setTab] = useState<"operations" | "excise" | "state" | "batches" | "all-batches" | "barrels">("operations");
  const [exporting, setExporting] = useState(false);
  const [exporting5110, setExporting5110] = useState(false);
  const [exporting5000, setExporting5000] = useState(false);

  const { data: platformConfig } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest("/api/platform-config"),
    staleTime: 60_000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<OperationsSummary>({
    queryKey: [`/api/reports/operations`, month],
    queryFn: () => apiRequest(`/api/reports/operations?month=${month}`),
    enabled: !!month,
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery<BatchPeriodRow[]>({
    queryKey: [`/api/reports/batches-by-period`, month],
    queryFn: () => apiRequest(`/api/reports/batches-by-period?month=${month}`),
    enabled: !!month,
  });

  const { data: allBatches = [], isLoading: allBatchesLoading } = useQuery<AllBatchRow[]>({
    queryKey: ["/api/distilling/batch-records"],
    queryFn: () => apiRequest("/api/distilling/batch-records"),
  });

  const { data: barrels = [], isLoading: barrelsLoading } = useQuery<BarrelSummaryRow[]>({
    queryKey: ["/api/barrels"],
    queryFn: () => apiRequest("/api/barrels"),
  });

  const { data: stateReport, isLoading: stateLoading } = useQuery<StateDistributorReport>({
    queryKey: [`/api/reports/state-distributor`, month],
    queryFn: () => apiRequest(`/api/reports/state-distributor?month=${month}`),
    enabled: !!month && tab === "state",
  });

  const { data: exciseByProduct, isLoading: exciseByProductLoading } = useQuery<ExciseByProductReport>({
    queryKey: ["/api/reports/excise-by-product", month],
    queryFn: () => apiRequest(`/api/reports/excise-by-product?month=${month}`),
    enabled: !!month,
    staleTime: 60_000,
  });

  const totalProduced = summary?.total_produced ?? 0;
  const totalDeposited = summary?.total_deposited ?? 0;
  const totalProcessed = summary?.total_processed ?? 0;
  const totalExcise = summary?.total_excise_tax ?? 0;
  const grandCases = summary?.grand_total_cases ?? 0;

  // Excise by tax class from batch rows
  interface TaxClassEntry { pg: number; tax: number; }
  const exciseByCls: Record<string, TaxClassEntry> = {};
  for (const b of batches) {
    if (b.proofGallonsProcessed == null) continue;
    const cls = b.taxClass ?? "standard";
    if (!exciseByCls[cls]) exciseByCls[cls] = { pg: 0, tax: 0 };
    exciseByCls[cls].pg += b.proofGallonsProcessed;
    exciseByCls[cls].tax += b.exciseTaxDue ?? (b.proofGallonsProcessed * (taxClassRates[cls] ?? 13.50));
  }

  const dspNumber = platformConfig?.dspNumber;
  const proprietorName = platformConfig?.organizationNameOverride || platformConfig?.organizationName || "Distillr";

  async function handleExport() {
    setExporting(true);
    try {
      await exportReportsToExcel({
        month,
        proprietorName,
        dspNumber: dspNumber ?? null,
        exciseByProduct,
        summary,
        batches,
        allBatches: allBatches as any[],
        barrels: barrels as any[],
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleExport5110() {
    if (!summary) return;
    setExporting5110(true);
    try {
      await export5110Word({
        month,
        proprietorName,
        dspNumber: dspNumber ?? null,
        summary,
      });
    } finally {
      setExporting5110(false);
    }
  }

  async function handleExport5000() {
    if (!exciseByProduct) return;
    setExporting5000(true);
    try {
      await export5000Word({
        month,
        proprietorName,
        dspNumber: dspNumber ?? null,
        exciseByProduct,
      });
    } finally {
      setExporting5000(false);
    }
  }

  const TABS = [
    { key: "operations" as const, label: "Operations (5110.40)" },
    { key: "excise" as const, label: "Excise Tax (5000.24)" },
    { key: "state" as const, label: "State Distributor" },
    { key: "batches" as const, label: "Batch Detail" },
    { key: "all-batches" as const, label: "All Production" },
    { key: "barrels" as const, label: "Barrel Inventory" },
  ];

  return (
    <Layout>
      <PageHeader
        title="Reports"
        subtitle="Operations, compliance, and excise tax reports"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport5110}
              disabled={exporting5110 || summaryLoading || !summary}
            >
              {exporting5110 ? "Generating…" : "5110.40 Word"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport5000}
              disabled={exporting5000 || exciseByProductLoading || !exciseByProduct}
            >
              {exporting5000 ? "Generating…" : "5000.24 Word"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || summaryLoading}
            >
              {exporting ? "Generating…" : "Export to Excel"}
            </Button>
          </div>
        }
      />

      {/* DSP header + month picker */}
      <div className="px-6 py-3 bg-white border-b border-[#e5e5e5] space-y-2">
        <div className="flex items-center gap-6">
          <span className="text-xs text-[#737373]">
            DSP Permit:{" "}
            {dspNumber ? (
              <span className="font-medium text-[#0a0a0a]">{dspNumber}</span>
            ) : (
              <span className="text-[#ef4444]">Not configured — set in Settings</span>
            )}
          </span>
          <span className="text-xs text-[#737373]">
            Proprietor: <span className="font-medium text-[#0a0a0a]">{proprietorName}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[#737373]">Reporting Period</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-[#e5e5e5] rounded-md px-3 py-1.5 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 bg-white border-b border-[#e5e5e5] flex gap-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#0a0a0a] text-[#0a0a0a]"
                : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* Tab: Operations (5110.40) */}
        {/* ------------------------------------------------------------------ */}
        {tab === "operations" && (
          <div className="space-y-0 rounded-lg overflow-hidden border border-[#2B1A0E]/20 shadow-sm">

            {/* Form header band */}
            <div className="bg-[#2B1A0E] px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#C9A227] text-[10px] font-semibold uppercase tracking-widest">TTB Form 5110.40</p>
                  <h2 className="text-white text-base font-bold mt-0.5">Monthly Report of Production Operations</h2>
                  <p className="text-white/50 text-xs mt-1">{proprietorName}{dspNumber ? ` · DSP ${dspNumber}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#C9A227] text-xs font-semibold">
                    {month ? new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                  </p>
                  <p className="text-white/40 text-[10px] mt-0.5">Reporting Period</p>
                </div>
              </div>
            </div>

            {summaryLoading ? (
              <div className="bg-white p-10 text-center text-sm text-[#737373]">Loading report data…</div>
            ) : (
              <>
                {/* ---- Part I: Spirits Produced ---- */}
                <div className="bg-white border-b border-[#e5e5e5]">
                  <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                    <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">I</span>
                    <div>
                      <p className="text-xs font-semibold text-[#2B1A0E]">Spirits Produced</p>
                      <p className="text-[10px] text-[#a3a3a3]">By distillation date within the reporting period</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-bold text-[#2B1A0E] tabular-nums">{totalProduced.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                      <p className="text-[10px] text-[#a3a3a3]">{summary?.prod_batch_count ?? 0} batch{(summary?.prod_batch_count ?? 0) !== 1 ? "es" : ""}</p>
                    </div>
                  </div>
                  {(summary?.produced_by_spirit?.length ?? 0) === 0 ? (
                    <p className="px-6 py-4 text-xs text-[#a3a3a3] italic">No spirits produced in this period.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5e5]">
                          <th className="text-left px-6 py-2 text-[#737373] font-medium">Spirit Type</th>
                          <th className="text-left px-4 py-2 text-[#737373] font-medium">Class</th>
                          <th className="text-left px-4 py-2 text-[#737373] font-medium">Batch Codes</th>
                          <th className="text-center px-4 py-2 text-[#737373] font-medium">Batches</th>
                          <th className="text-right px-6 py-2 text-[#737373] font-medium">Proof Gallons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary?.produced_by_spirit ?? []).map((r, i) => (
                          <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#faf9f7]" : ""}`}>
                            <td className="px-6 py-2.5 font-medium text-[#2B1A0E] capitalize">{r.spiritType}</td>
                            <td className="px-4 py-2.5 text-[#737373] capitalize">{r.spiritClass || "—"}</td>
                            <td className="px-4 py-2.5 text-[#737373] font-mono text-[10px]">{(r.batchCodes ?? []).join(", ") || "—"}</td>
                            <td className="px-4 py-2.5 text-center text-[#737373]">{r.batchCount}</td>
                            <td className="px-6 py-2.5 text-right font-semibold tabular-nums">{r.proofGallons.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#2B1A0E]/10 bg-[#f9f6f2]">
                          <td className="px-6 py-2 font-semibold text-[#2B1A0E]" colSpan={4}>Total Spirits Produced</td>
                          <td className="px-6 py-2 text-right font-bold text-[#2B1A0E] tabular-nums">{totalProduced.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>

                {/* ---- Part II: Spirits Deposited to Bond ---- */}
                <div className="bg-white border-b border-[#e5e5e5]">
                  <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                    <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">II</span>
                    <div>
                      <p className="text-xs font-semibold text-[#2B1A0E]">Spirits Deposited to Bond</p>
                      <p className="text-[10px] text-[#a3a3a3]">By fill date within the reporting period</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-bold text-[#2B1A0E] tabular-nums">{totalDeposited.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                      <p className="text-[10px] text-[#a3a3a3]">{(summary?.total_fill_wine_gallons ?? 0).toFixed(2)} wine gal</p>
                    </div>
                  </div>
                  {(summary?.deposited_by_spirit?.length ?? 0) === 0 ? (
                    <p className="px-6 py-4 text-xs text-[#a3a3a3] italic">No spirits deposited to bond in this period.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5e5]">
                          <th className="text-left px-6 py-2 text-[#737373] font-medium">Spirit Type</th>
                          <th className="text-left px-4 py-2 text-[#737373] font-medium">Class</th>
                          <th className="text-left px-4 py-2 text-[#737373] font-medium">Fill Numbers</th>
                          <th className="text-center px-4 py-2 text-[#737373] font-medium">Barrels</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Wine Gallons</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Avg Proof</th>
                          <th className="text-right px-6 py-2 text-[#737373] font-medium">Proof Gallons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary?.deposited_by_spirit ?? []).map((r, i) => (
                          <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#faf9f7]" : ""}`}>
                            <td className="px-6 py-2.5 font-medium text-[#2B1A0E] capitalize">{r.spiritType}</td>
                            <td className="px-4 py-2.5 text-[#737373] capitalize">{r.spiritClass || "—"}</td>
                            <td className="px-4 py-2.5 text-[#737373] font-mono text-[10px]">{r.fillNumbers || "—"}</td>
                            <td className="px-4 py-2.5 text-center text-[#737373]">{r.barrelCount}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{r.wineGallons.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{r.avgFillProof.toFixed(1)}°</td>
                            <td className="px-6 py-2.5 text-right font-semibold tabular-nums">{r.proofGallons.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#2B1A0E]/10 bg-[#f9f6f2]">
                          <td className="px-6 py-2 font-semibold text-[#2B1A0E]" colSpan={4}>Total Deposited to Bond</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">{(summary?.total_fill_wine_gallons ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-2" />
                          <td className="px-6 py-2 text-right font-bold text-[#2B1A0E] tabular-nums">{totalDeposited.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>

                {/* ---- Part III: Bonded Storage Balance ---- */}
                <div className="bg-white border-b border-[#e5e5e5]">
                  <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                    <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">III</span>
                    <div>
                      <p className="text-xs font-semibold text-[#2B1A0E]">Bonded Storage Balance</p>
                      <p className="text-[10px] text-[#a3a3a3]">Period ledger + current warehouse inventory</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-bold text-[#2B1A0E] tabular-nums">{(summary?.ending_bond_balance ?? 0).toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                      <p className="text-[10px] text-[#a3a3a3]">Ending balance</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#e5e5e5]">
                    {/* Ledger */}
                    <div className="px-6 py-4">
                      <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Period Ledger</p>
                      <div className="space-y-2">
                        {[
                          { label: "Beginning Inventory", value: (summary?.beginning_bond_balance ?? 0).toFixed(2), sign: "" },
                          { label: "Spirits Deposited (Part II)", value: totalDeposited.toFixed(2), sign: "+" },
                          { label: "Spirits Processed (Part IV)", value: totalProcessed.toFixed(2), sign: "−" },
                          { label: "Losses / Angel's Share", value: (summary?.period_losses_pg ?? 0).toFixed(2), sign: "−" },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between text-xs">
                            <span className="text-[#737373]">
                              {row.sign && <span className="font-mono w-3 inline-block text-[#2B1A0E]">{row.sign}</span>}
                              {row.label}
                            </span>
                            <span className="font-medium tabular-nums text-[#404040]">{row.value} PG</span>
                          </div>
                        ))}
                        <div className="border-t-2 border-[#2B1A0E] pt-2 mt-2 flex items-center justify-between text-xs font-bold">
                          <span className="text-[#2B1A0E]">= Ending Bond Balance</span>
                          <span className="text-[#2B1A0E] tabular-nums text-sm">{(summary?.ending_bond_balance ?? 0).toFixed(2)} PG</span>
                        </div>
                      </div>
                    </div>
                    {/* Current warehouse snapshot */}
                    <div className="px-6 py-4">
                      <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Current Warehouse (Aging Barrels)</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#737373]">Barrels in Bond</span>
                          <span className="font-semibold text-[#2B1A0E] tabular-nums">{summary?.barrels_in_bond_count ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#737373]">Wine Gallons in Bond</span>
                          <span className="font-semibold text-[#2B1A0E] tabular-nums">{(summary?.barrels_in_bond_wg ?? 0).toFixed(2)} WG</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#737373]">Proof Gallons in Bond</span>
                          <span className="font-bold text-[#C9A227] tabular-nums text-sm">{(summary?.barrels_in_bond_pg ?? 0).toFixed(2)} PG</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#a3a3a3] mt-4 italic">Snapshot as of report generation — all barrels with status "Aging"</p>
                    </div>
                  </div>
                </div>

                {/* ---- Part IV: Spirits Processed ---- */}
                <div className="bg-white">
                  <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                    <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">IV</span>
                    <div>
                      <p className="text-xs font-semibold text-[#2B1A0E]">Spirits Processed</p>
                      <p className="text-[10px] text-[#a3a3a3]">By bottling date — taxable removals from bond</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-bold text-[#2B1A0E] tabular-nums">{totalProcessed.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                      <p className="text-[10px] text-[#C9A227] font-semibold">${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2 })} excise tax</p>
                    </div>
                  </div>
                  {(summary?.processed_by_spirit?.length ?? 0) === 0 ? (
                    <p className="px-6 py-4 text-xs text-[#a3a3a3] italic">No spirits processed in this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#e5e5e5]">
                            <th className="text-left px-6 py-2 text-[#737373] font-medium">Spirit Type</th>
                            <th className="text-left px-4 py-2 text-[#737373] font-medium">Class</th>
                            <th className="text-left px-4 py-2 text-[#737373] font-medium">Lot Numbers</th>
                            <th className="text-right px-3 py-2 text-[#737373] font-medium">Avg Proof</th>
                            <th className="text-right px-3 py-2 text-[#737373] font-medium">750 ml</th>
                            <th className="text-right px-3 py-2 text-[#737373] font-medium">1 L</th>
                            <th className="text-right px-3 py-2 text-[#737373] font-medium">1.75 L</th>
                            <th className="text-right px-3 py-2 text-[#737373] font-medium">Total Cases</th>
                            <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Removed</th>
                            <th className="text-right px-6 py-2 text-[#737373] font-medium">Excise Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(summary?.processed_by_spirit ?? []).map((r, i) => (
                            <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#faf9f7]" : ""}`}>
                              <td className="px-6 py-2.5 font-medium text-[#2B1A0E] capitalize">{r.spiritType}</td>
                              <td className="px-4 py-2.5 text-[#737373] capitalize">{r.spiritClass || "—"}</td>
                              <td className="px-4 py-2.5 text-[#737373] font-mono text-[10px]">{(r.lotNumbers ?? []).join(", ") || "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.avgBottlingProof.toFixed(1)}°</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.cases750 || "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.cases1000 || "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.cases1750 || "—"}</td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.totalCases}</td>
                              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.proofGallons.toFixed(2)}</td>
                              <td className="px-6 py-2.5 text-right font-bold text-[#C9A227] tabular-nums">
                                ${r.exciseTaxDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#2B1A0E] bg-[#2B1A0E]">
                            <td className="px-6 py-2.5 font-bold text-white" colSpan={4}>Total Spirits Processed</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_750 ?? 0}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_1000 ?? 0}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_1750 ?? 0}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-white tabular-nums">{summary?.grand_total_cases ?? 0}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{totalProcessed.toFixed(2)}</td>
                            <td className="px-6 py-2.5 text-right font-bold text-[#C9A227] tabular-nums">
                              ${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Tab: Excise Tax (5000.24) */}
        {/* ------------------------------------------------------------------ */}
        {tab === "excise" && (() => {
          // Payment due = 14th of month following period end
          const [yr, mo] = month.split("-").map(Number);
          const dueDate = new Date(mo === 12 ? yr + 1 : yr, mo === 12 ? 0 : mo, 14);
          const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          const periodLabel = month
            ? new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : "—";

          const SCHEDULE_A = [
            {
              line: "1",
              cls: "craft_tier1",
              description: "Craft Distillery Reduced Rate — Tier 1",
              subtitle: "First 100,000 proof gallons per calendar year",
              rate: 2.70,
            },
            {
              line: "2",
              cls: "craft_tier2",
              description: "Craft Distillery Reduced Rate — Tier 2",
              subtitle: "100,001 – 22,230,000 proof gallons per calendar year",
              rate: 13.34,
            },
            {
              line: "3",
              cls: "standard",
              description: "Standard Rate",
              subtitle: "Large distiller / over 22.23M PG annual production",
              rate: 13.50,
            },
          ];

          const ebp = exciseByProduct;
          const netTax = ebp?.totalExciseTax ?? totalExcise;

          return (
            <div className="space-y-0 rounded-lg overflow-hidden border border-[#2B1A0E]/20 shadow-sm">

              {/* Form header band */}
              <div className="bg-[#2B1A0E] px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[#C9A227] text-[10px] font-semibold uppercase tracking-widest">TTB Form 5000.24</p>
                    <h2 className="text-white text-base font-bold mt-0.5">TTB Form 5000.24 — Excise Tax Return · Distilled Spirits</h2>
                    <p className="text-white/50 text-xs mt-1">{proprietorName}{dspNumber ? ` · DSP ${dspNumber}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#C9A227] text-xs font-semibold">{periodLabel}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">Reporting Period</p>
                    <p className="text-white/60 text-[10px] mt-2">Due <span className="text-white font-medium">{dueDateStr}</span></p>
                  </div>
                </div>
              </div>

              {/* Filing Information block */}
              <div className="bg-white border-b border-[#e5e5e5]">
                <div className="px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Filing Information</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#e5e5e5]">
                  {[
                    { label: "Proprietor", value: proprietorName },
                    { label: "DSP Permit Number", value: dspNumber || <span className="text-red-500 italic">Not configured</span> },
                    { label: "Tax Period", value: periodLabel },
                    { label: "Payment Due", value: dueDateStr },
                  ].map((item, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="text-xs font-semibold text-[#2B1A0E]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main product table — mirrors the spreadsheet */}
              <div className="bg-white border-b border-[#e5e5e5]">
                <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                  <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">A</span>
                  <div>
                    <p className="text-xs font-semibold text-[#2B1A0E]">Schedule A — Excise Tax by Product</p>
                    <p className="text-[10px] text-[#a3a3a3]">Cases sold per product this period, proof gallons, and tax owed</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-lg font-bold text-[#C9A227] tabular-nums">
                      ${(ebp?.totalExciseTax ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-[#a3a3a3]">Total excise tax</p>
                  </div>
                </div>
                {exciseByProductLoading ? (
                  <div className="px-6 py-8 text-xs text-[#737373]">Loading product data…</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5e5] bg-[#f9f6f2]">
                          <th className="text-left px-6 py-2 text-[#737373] font-medium">Product</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Dist. Cases</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Retail Cases</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Total Cases</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">ABV %</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Proof Gallons</th>
                          <th className="text-right px-4 py-2 text-[#737373] font-medium">Excise Tax</th>
                          <th className="text-right px-6 py-2 text-[#737373] font-medium">Per Bottle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ebp?.rows ?? []).map((row, i) => {
                          const active = row.totalCases > 0;
                          return (
                            <tr
                              key={row.key}
                              className={`border-b border-[#f5f5f5] ${!active ? "opacity-40" : i % 2 === 1 ? "bg-[#faf9f7]" : ""}`}
                            >
                              <td className={`px-6 py-2.5 font-medium ${active ? "text-[#2B1A0E]" : "text-[#737373]"}`}>{row.name}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{active ? row.distCases : "—"}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{active ? row.retailCases : "—"}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{active ? row.totalCases : "—"}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{row.abv.toFixed(1)}%</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{active ? row.proofGallons.toFixed(4) : "—"}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[#C9A227]">
                                {active ? `$${row.exciseTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                              </td>
                              <td className="px-6 py-2.5 text-right tabular-nums text-[#737373]">
                                {active ? `$${row.perBottle.toFixed(4)}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#2B1A0E] bg-[#2B1A0E]">
                          <td className="px-6 py-2.5 font-bold text-white">Totals</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{ebp?.totalDistCases ?? 0}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{ebp?.totalRetailCases ?? 0}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{ebp?.totalCases ?? 0}</td>
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{(ebp?.totalProofGallons ?? 0).toFixed(4)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#C9A227] tabular-nums text-sm">
                            ${(ebp?.totalExciseTax ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-2.5" />
                        </tr>
                      </tfoot>
                    </table>
                    <p className="px-6 py-2 text-[10px] text-[#a3a3a3] italic border-t border-[#f0f0f0]">
                      Formula: Cases × 1.19 gal/case × (ABV × 2) ÷ 100 = Proof Gallons · Rate: $2.70/PG (Craft Tier 1)
                    </p>
                  </div>
                )}
              </div>

              {/* Schedule B — Tax Determination by Rate Class */}
              <div className="bg-white border-b border-[#e5e5e5]">
                <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                  <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">B</span>
                  <div>
                    <p className="text-xs font-semibold text-[#2B1A0E]">Schedule B — Tax Determination by Rate Class</p>
                    <p className="text-[10px] text-[#a3a3a3]">Proof gallons removed from bond, by applicable rate class</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-lg font-bold text-[#C9A227] tabular-nums">
                      ${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-[#a3a3a3]">Total tax determined</p>
                  </div>
                </div>
                {batchesLoading ? (
                  <div className="px-6 py-8 text-xs text-[#737373]">Loading…</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#e5e5e5]">
                        <th className="text-center px-4 py-2 text-[#737373] font-medium w-10">Line</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Rate Class</th>
                        <th className="text-right px-4 py-2 text-[#737373] font-medium">Rate ($/PG)</th>
                        <th className="text-right px-6 py-2 text-[#737373] font-medium">Proof Gallons</th>
                        <th className="text-right px-6 py-2 text-[#737373] font-medium">Tax Determined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCHEDULE_A.map((row) => {
                        const entry = exciseByCls[row.cls];
                        const pg = entry?.pg ?? 0;
                        const tax = entry?.tax ?? 0;
                        const active = pg > 0;
                        return (
                          <tr key={row.cls} className={`border-b border-[#f5f5f5] ${active ? "" : "opacity-40"}`}>
                            <td className="px-4 py-3 text-center text-[#a3a3a3] font-mono">{row.line}</td>
                            <td className="px-4 py-3">
                              <p className={`font-medium ${active ? "text-[#2B1A0E]" : "text-[#737373]"}`}>{row.description}</p>
                              <p className="text-[10px] text-[#a3a3a3] mt-0.5">{row.subtitle}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-[#737373]">${row.rate.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-semibold tabular-nums">
                              {active ? pg.toFixed(2) : "—"}
                            </td>
                            <td className="px-6 py-3 text-right font-bold tabular-nums text-[#C9A227]">
                              {active ? `$${tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#2B1A0E] bg-[#2B1A0E]">
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 font-bold text-white">Total Tax Determined</td>
                        <td className="px-4 py-2.5" />
                        <td className="px-6 py-2.5 text-right font-bold text-white tabular-nums">{totalProcessed.toFixed(2)} PG</td>
                        <td className="px-6 py-2.5 text-right font-bold text-[#C9A227] tabular-nums text-sm">
                          ${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Schedule C — Per-batch breakdown */}
              <div className="bg-white border-b border-[#e5e5e5]">
                <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                  <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">C</span>
                  <div>
                    <p className="text-xs font-semibold text-[#2B1A0E]">Schedule C — Tax by Batch</p>
                    <p className="text-[10px] text-[#a3a3a3]">Supporting detail by spirit type for this period</p>
                  </div>
                </div>
                {batchesLoading ? (
                  <div className="px-6 py-6 text-xs text-[#737373]">Loading…</div>
                ) : batches.filter(b => b.proofGallonsProcessed != null && b.proofGallonsProcessed > 0).length === 0 ? (
                  <p className="px-6 py-4 text-xs text-[#a3a3a3] italic">No excise tax data for this period.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#e5e5e5]">
                        <th className="text-left px-6 py-2 text-[#737373] font-medium">Batch</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Product / Spirit</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Lot</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Tax Class</th>
                        <th className="text-right px-4 py-2 text-[#737373] font-medium">Rate ($/PG)</th>
                        <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Removed</th>
                        <th className="text-right px-6 py-2 text-[#737373] font-medium">Tax Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches
                        .filter(b => b.proofGallonsProcessed != null && b.proofGallonsProcessed > 0)
                        .map((b, i) => {
                          const cls = b.taxClass ?? "standard";
                          const rate = taxClassRates[cls] ?? 13.50;
                          const tax = b.exciseTaxDue ?? (b.proofGallonsProcessed! * rate);
                          return (
                            <tr key={b.id} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#faf9f7]" : ""}`}>
                              <td className="px-6 py-2.5 font-mono font-medium text-[#2B1A0E]">{b.batchCode}</td>
                              <td className="px-4 py-2.5 text-[#737373] capitalize">{b.productName ?? b.spiritType ?? "—"}</td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-[#a3a3a3]">{b.lotNumber ?? "—"}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  cls === "craft_tier1" ? "bg-green-100 text-green-700" :
                                  cls === "craft_tier2" ? "bg-amber-100 text-amber-700" :
                                  "bg-[#f0f0f0] text-[#737373]"
                                }`}>
                                  {taxClassLabel(cls)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#737373]">${rate.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{b.proofGallonsProcessed!.toFixed(2)}</td>
                              <td className="px-6 py-2.5 text-right font-bold text-[#C9A227] tabular-nums">
                                ${tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#2B1A0E]/10 bg-[#f9f6f2]">
                        <td className="px-6 py-2 font-semibold text-[#2B1A0E]" colSpan={5}>Period Total</td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">{totalProcessed.toFixed(2)}</td>
                        <td className="px-6 py-2 text-right font-bold text-[#C9A227] tabular-nums">
                          ${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Payment Summary */}
              <div className="bg-white">
                <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f9f6f2]">
                  <span className="w-6 h-6 rounded-full bg-[#2B1A0E] text-[#C9A227] text-[10px] font-bold flex items-center justify-center shrink-0">D</span>
                  <p className="text-xs font-semibold text-[#2B1A0E]">Payment Summary</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#e5e5e5]">
                  {/* Tax due panel */}
                  <div className="px-6 py-5 flex flex-col gap-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#737373]">Total Tax Determined (Schedule A)</span>
                      <span className="font-semibold tabular-nums text-[#2B1A0E]">
                        ${netTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-[#a3a3a3]">
                      <span>Credits / Prior Overpayments</span>
                      <span className="tabular-nums">$0.00</span>
                    </div>
                    <div className="border-t-2 border-[#2B1A0E] pt-3 flex justify-between">
                      <span className="text-sm font-bold text-[#2B1A0E]">Net Tax Due</span>
                      <span className="text-xl font-bold text-[#C9A227] tabular-nums">
                        ${netTax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {/* Payment instructions */}
                  <div className="px-6 py-5 space-y-2.5">
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Payment Instructions</p>
                    <div className="space-y-1.5 text-xs text-[#737373]">
                      <p><span className="font-medium text-[#2B1A0E]">Method:</span> Electronic Funds Transfer (EFT) via Pay.gov</p>
                      <p><span className="font-medium text-[#2B1A0E]">Due:</span> {dueDateStr}</p>
                      <p><span className="font-medium text-[#2B1A0E]">Reference:</span> DSP {dspNumber ?? "—"} · {periodLabel}</p>
                      <p className="text-[#a3a3a3] text-[10px] pt-1 italic">
                        Semi-monthly filers: payment due by the 14th and 29th. Contact TTB for EFT enrollment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ------------------------------------------------------------------ */}
        {/* Tab: State Distributor */}
        {/* ------------------------------------------------------------------ */}
        {tab === "state" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Orders"
                value={String(stateReport?.totalOrders ?? 0)}
                highlight={(stateReport?.totalOrders ?? 0) > 0}
              />
              <StatCard
                label="Total Revenue"
                value={`$${(stateReport?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                highlight={(stateReport?.totalRevenue ?? 0) > 0}
              />
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e5e5e5]">
                <h3 className="text-sm font-semibold text-[#0a0a0a]">Sales Orders in Period</h3>
              </div>
              {stateLoading ? (
                <div className="p-6 text-xs text-[#737373]">Loading…</div>
              ) : !stateReport || stateReport.orders.length === 0 ? (
                <div className="p-6 text-xs text-[#737373]">No sales orders found for this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Order #</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Date</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Client</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Product</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Batch</th>
                        <th className="text-right px-4 py-2 text-[#737373] font-medium">Cases</th>
                        <th className="text-right px-4 py-2 text-[#737373] font-medium">Amount</th>
                        <th className="text-left px-4 py-2 text-[#737373] font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stateReport.orders.map((o) => (
                        <tr key={o.id} className="border-b border-[#f0f0f0] hover:bg-[#f7f7f7]">
                          <td className="px-4 py-2 font-mono font-medium">{o.order_number ?? "—"}</td>
                          <td className="px-4 py-2 text-[#737373]">{fmt(o.order_date)}</td>
                          <td className="px-4 py-2 text-[#737373]">{o.client_name ?? "—"}</td>
                          <td className="px-4 py-2 text-[#737373]">{o.product_name ?? "—"}</td>
                          <td className="px-4 py-2 font-mono text-[#737373]">{o.batch_code ?? "—"}</td>
                          <td className="px-4 py-2 text-right">{o.total_cases ?? "—"}</td>
                          <td className="px-4 py-2 text-right">
                            {o.total_amount
                              ? `$${parseFloat(o.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-[#737373] capitalize">{o.status ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Tab: All Production (all batches, no period filter) */}
        {/* ------------------------------------------------------------------ */}
        {tab === "all-batches" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#0a0a0a]">All Production Batches</h3>
                <p className="text-xs text-[#737373] mt-0.5">Every batch in the system regardless of period</p>
              </div>
              {!allBatchesLoading && (
                <span className="text-xs text-[#737373]">{allBatches.length} batch{allBatches.length !== 1 ? "es" : ""}</span>
              )}
            </div>
            {allBatchesLoading ? (
              <div className="p-6 text-xs text-[#737373]">Loading…</div>
            ) : allBatches.length === 0 ? (
              <div className="p-6 text-xs text-[#737373]">No batches found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Batch Code</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Product</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Spirit</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Batch Date</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Stage</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Produced</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Deposited</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Processed</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Cases</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Excise Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBatches.map((b, i) => (
                      <tr key={b.id} className={`border-b border-[#f0f0f0] hover:bg-[#f7f7f7] ${i % 2 === 0 ? "" : "bg-[#fafafa]"}`}>
                        <td className="px-4 py-2 font-mono font-medium">{(b as any).batchCode}</td>
                        <td className="px-4 py-2 text-[#737373]">{(b as any).productName ?? "—"}</td>
                        <td className="px-4 py-2 text-[#737373] capitalize">{(b as any).spiritType ?? "—"}</td>
                        <td className="px-4 py-2 text-[#737373]">{fmt((b as any).batchDate)}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            (b as any).stage === "closed" ? "bg-green-100 text-green-700" : "bg-[#f0f0f0] text-[#737373]"
                          }`}>
                            {STAGE_LABELS[(b as any).stage] ?? (b as any).stage}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{(b as any).proofGallonsProduced != null ? Number((b as any).proofGallonsProduced).toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{(b as any).fillProofGallons != null ? Number((b as any).fillProofGallons).toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{(b as any).proofGallonsProcessed != null ? Number((b as any).proofGallonsProcessed).toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{(b as any).totalCases ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-medium text-[#0369a1]">
                          {(b as any).exciseTaxDue != null
                            ? `$${Number((b as any).exciseTaxDue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-[#e5e5e5] bg-[#f7f7f7] font-semibold">
                    <tr>
                      <td className="px-4 py-2" colSpan={5}>Totals ({allBatches.length} batches)</td>
                      <td className="px-4 py-2 text-right">{allBatches.reduce((s, b) => s + (Number((b as any).proofGallonsProduced) || 0), 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{allBatches.reduce((s, b) => s + (Number((b as any).fillProofGallons) || 0), 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{allBatches.reduce((s, b) => s + (Number((b as any).proofGallonsProcessed) || 0), 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{allBatches.reduce((s, b) => s + (Number((b as any).totalCases) || 0), 0)}</td>
                      <td className="px-4 py-2 text-right text-[#0369a1]">
                        ${allBatches.reduce((s, b) => s + (Number((b as any).exciseTaxDue) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Tab: Barrel Inventory */}
        {/* ------------------------------------------------------------------ */}
        {tab === "barrels" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#0a0a0a]">Barrel Inventory</h3>
                <p className="text-xs text-[#737373] mt-0.5">All barrels currently tracked in the system</p>
              </div>
              {!barrelsLoading && (
                <span className="text-xs text-[#737373]">{barrels.length} barrel{barrels.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            {barrelsLoading ? (
              <div className="p-6 text-xs text-[#737373]">Loading…</div>
            ) : barrels.length === 0 ? (
              <div className="p-6 text-xs text-[#737373]">No barrels found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Serial #</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Product</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Status</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Fill Date</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Proof</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Wine Gal</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Proof Gal</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Zone</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Char</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barrels.map((b, i) => (
                      <tr key={b.id} className={`border-b border-[#f0f0f0] hover:bg-[#f7f7f7] ${i % 2 === 0 ? "" : "bg-[#fafafa]"}`}>
                        <td className="px-4 py-2 font-mono font-medium">{b.serialNumber}</td>
                        <td className="px-4 py-2 text-[#737373]">{b.productName ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            b.status === "Aging" ? "bg-amber-100 text-amber-700" :
                            b.status === "Dumped" ? "bg-blue-100 text-blue-700" :
                            b.status === "Empty" || b.status === "Retired" ? "bg-[#f0f0f0] text-[#737373]" :
                            "bg-green-100 text-green-700"
                          }`}>{b.status}</span>
                        </td>
                        <td className="px-4 py-2 text-[#737373]">{fmt(b.fillDate)}</td>
                        <td className="px-4 py-2 text-right">{b.fillProof != null ? `${b.fillProof}°` : "—"}</td>
                        <td className="px-4 py-2 text-right">{b.fillVolume != null ? fmtNum(b.fillVolume) : "—"}</td>
                        <td className="px-4 py-2 text-right font-medium text-[#0369a1]">{b.fillProofGallons != null ? fmtNum(b.fillProofGallons) : "—"}</td>
                        <td className="px-4 py-2 text-[#737373]">{b.warehouseZone ?? "—"}</td>
                        <td className="px-4 py-2 text-[#737373]">{b.charLevel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-[#e5e5e5] bg-[#f7f7f7] font-semibold">
                    <tr>
                      <td className="px-4 py-2" colSpan={5}>Totals ({barrels.length} barrels)</td>
                      <td className="px-4 py-2 text-right">{barrels.reduce((s, b) => s + (b.fillVolume || 0), 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-[#0369a1]">{barrels.reduce((s, b) => s + (b.fillProofGallons || 0), 0).toFixed(2)}</td>
                      <td className="px-4 py-2" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Tab: Batch Detail */}
        {/* ------------------------------------------------------------------ */}
        {tab === "batches" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e5e5e5]">
              <h3 className="text-sm font-semibold text-[#0a0a0a]">Batches in Period</h3>
              <p className="text-xs text-[#737373] mt-0.5">
                Includes any batch with a distill, fill, or bottling date in the selected month
              </p>
            </div>
            {batchesLoading ? (
              <div className="p-6 text-xs text-[#737373]">Loading…</div>
            ) : batches.length === 0 ? (
              <div className="p-6 text-xs text-[#737373]">No batches found for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Batch Code</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Product</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Spirit</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Distill Date</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Fill Date</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Produced</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Deposited</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">PG Processed</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Cases</th>
                      <th className="text-right px-4 py-2 text-[#737373] font-medium">Excise Tax</th>
                      <th className="text-left px-4 py-2 text-[#737373] font-medium">Tax Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id} className="border-b border-[#f0f0f0] hover:bg-[#f7f7f7]">
                        <td className="px-4 py-2 font-mono font-medium">{b.batchCode}</td>
                        <td className="px-4 py-2 text-[#737373]">{b.productName ?? "—"}</td>
                        <td className="px-4 py-2 text-[#737373] capitalize">{b.spiritType ?? "—"}</td>
                        <td className="px-4 py-2 text-[#737373]">{fmt(b.distillDate)}</td>
                        <td className="px-4 py-2 text-[#737373]">{fmt(b.fillDate)}</td>
                        <td className="px-4 py-2 text-right">{b.proofGallonsProduced != null ? b.proofGallonsProduced.toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{b.fillProofGallons != null ? b.fillProofGallons.toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{b.proofGallonsProcessed != null ? b.proofGallonsProcessed.toFixed(2) : "—"}</td>
                        <td className="px-4 py-2 text-right">{b.totalCases ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          {b.exciseTaxDue != null
                            ? `$${b.exciseTaxDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-[#737373]">{taxClassLabel(b.taxClass)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-[#e5e5e5] bg-[#f7f7f7]">
                    <tr>
                      <td className="px-4 py-2 font-semibold" colSpan={5}>Totals</td>
                      <td className="px-4 py-2 text-right font-semibold">{totalProduced.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{totalDeposited.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{totalProcessed.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{grandCases}</td>
                      <td className="px-4 py-2 text-right font-semibold text-[#0369a1]">
                        ${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
