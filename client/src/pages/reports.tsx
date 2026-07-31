import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { fmt, fmtNum } from "../lib/utils";
import { exportReportsToExcel } from "../lib/exportExcel";
import { export5110Word, export5000Word } from "../lib/exportWord";
import {
  FileText, Receipt, FlaskConical, List, Package, Truck,
  Download, FileDown, ChevronDown, ChevronLeft, ChevronRight,
  Calendar,
} from "lucide-react";

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
  label, value, sub, highlight,
}: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? "bg-[#f0f9ff] border-[#bae6fd]" : "bg-white border-[#e5e5e5]"}`}>
      <p className="text-xs text-[#737373]">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-[#0369a1]" : "text-[#0a0a0a]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#a3a3a3] mt-0.5">{sub}</p>}
    </div>
  );
}

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
// Report type dropdown
// ---------------------------------------------------------------------------
type ReportKey = "operations" | "excise" | "state" | "batches" | "all-batches" | "barrels";

const REPORT_GROUPS = [
  {
    label: "Compliance & Tax",
    items: [
      { key: "operations" as ReportKey, label: "Operations Report", sub: "TTB 5110.40", Icon: FileText },
      { key: "excise" as ReportKey,     label: "Excise Tax Return",  sub: "TTB 5000.24", Icon: Receipt  },
    ],
  },
  {
    label: "Production",
    items: [
      { key: "batches" as ReportKey,     label: "Batch Detail",     sub: "Period filter",   Icon: FlaskConical },
      { key: "all-batches" as ReportKey, label: "All Production",   sub: "All batches",     Icon: List         },
      { key: "barrels" as ReportKey,     label: "Barrel Inventory", sub: "Barrel registry", Icon: Package      },
    ],
  },
  {
    label: "Sales",
    items: [
      { key: "state" as ReportKey, label: "State Distributor", sub: "Sales orders", Icon: Truck },
    ],
  },
];

function ReportDropdown({ value, onChange }: { value: ReportKey; onChange: (v: ReportKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allItems = REPORT_GROUPS.flatMap(g => g.items);
  const current = allItems.find(i => i.key === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 pl-3.5 pr-3 py-2 bg-[var(--brand)] text-white rounded-xl hover:bg-[var(--brand)] transition-colors shadow-sm"
      >
        {current && <current.Icon size={13} className="text-white/70 shrink-0" />}
        <div className="text-left min-w-0">
          <p className="text-[11px] font-semibold leading-tight whitespace-nowrap">{current?.label ?? "Select Report"}</p>
          <p className="text-[9px] text-white/40 leading-none mt-0.5">{current?.sub}</p>
        </div>
        <ChevronDown size={12} className={`text-white/40 ml-1 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-[#e5e5e5] rounded-xl shadow-2xl z-50 w-64 py-2 overflow-hidden">
          {REPORT_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-4 pt-2 pb-1 text-[9px] font-bold text-[#c3bfba] uppercase tracking-widest">{group.label}</p>
              {group.items.map(({ key, label, sub, Icon }) => (
                <button
                  key={key}
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    value === key
                      ? "bg-[#f3f4f6] text-[#0a0a0a]"
                      : "hover:bg-[#f9f8f7] text-[#404040]"
                  }`}
                >
                  <Icon size={13} className={value === key ? "text-[#525252]" : "text-[#c3bfba]"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-[9px] text-[#a3a3a3] mt-0.5">{sub}</p>
                  </div>
                  {value === key && <ChevronRight size={10} className="text-[#525252] shrink-0" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive Period Picker
// ---------------------------------------------------------------------------
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function PeriodPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [yr, mo] = month.split("-").map(Number);
  const [pickerYear, setPickerYear] = useState(yr);

  const label = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  function navigate(delta: number) {
    const d = new Date(yr, mo - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function quickSelect(monthsAgo: number) {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function selectMonth(m: number) {
    onChange(`${pickerYear}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const quickOptions = [
    { label: "This Month", delta: 0 },
    { label: "Last Month", delta: 1 },
    { label: "2 Mo Ago",   delta: 2 },
  ];

  return (
    <div className="flex items-center gap-2" ref={ref}>
      {/* Quick select pills */}
      <div className="flex items-center gap-1">
        {quickOptions.map(({ label: ql, delta }) => {
          const d = new Date(today.getFullYear(), today.getMonth() - delta, 1);
          const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const active = month === target;
          return (
            <button
              key={delta}
              onClick={() => quickSelect(delta)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                active
                  ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                  : "bg-white text-[#525252] border-[#e5e5e5] hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a]"
              }`}
            >
              {ql}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-[#e5e5e5]" />

      {/* Prev arrow */}
      <button
        onClick={() => navigate(-1)}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#e5e5e5] bg-white hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a] text-[#a3a3a3] transition-colors"
      >
        <ChevronLeft size={13} />
      </button>

      {/* Month display button */}
      <div className="relative">
        <button
          onClick={() => { setPickerYear(yr); setOpen(o => !o); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold transition-all min-w-[148px] justify-center ${
            open ? "border-[var(--brand)] text-[#0a0a0a]" : "border-[#e5e5e5] text-[#0a0a0a] hover:border-[#0a0a0a]/40"
          }`}
        >
          <Calendar size={11} className="text-[#525252] shrink-0" />
          {label}
          <ChevronDown size={10} className={`text-[#a3a3a3] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Month/year grid popover */}
        {open && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border border-[#e5e5e5] rounded-2xl shadow-2xl z-50 w-60 p-4">
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYear(y => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-bold text-[#0a0a0a]">{pickerYear}</span>
              <button
                onClick={() => setPickerYear(y => y + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((mn, i) => {
                const mStr = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                const isSelected = month === mStr;
                const isCurrent = mStr === currentMonthStr;
                return (
                  <button
                    key={mn}
                    onClick={() => selectMonth(i + 1)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all relative ${
                      isSelected
                        ? "bg-[var(--brand)] text-white shadow-sm"
                        : isCurrent
                        ? "bg-[#f3f4f6] text-[#0a0a0a] font-semibold"
                        : "hover:bg-[#f9f8f7] text-[#404040]"
                    }`}
                  >
                    {mn}
                    {isCurrent && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#525252]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Next arrow */}
      <button
        onClick={() => navigate(1)}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#e5e5e5] bg-white hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a] text-[#a3a3a3] transition-colors"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------
export default function Reports() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [report, setReport] = useState<ReportKey>("operations");
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
    enabled: !!month && report === "state",
  });

  const { data: exciseByProduct, isLoading: exciseByProductLoading } = useQuery<ExciseByProductReport>({
    queryKey: ["/api/reports/excise-by-product", month],
    queryFn: () => apiRequest(`/api/reports/excise-by-product?month=${month}`),
    enabled: !!month,
    staleTime: 60_000,
  });

  const totalProduced  = summary?.total_produced  ?? 0;
  const totalDeposited = summary?.total_deposited ?? 0;
  const totalProcessed = summary?.total_processed ?? 0;
  const totalExcise    = summary?.total_excise_tax ?? 0;
  const grandCases     = summary?.grand_total_cases ?? 0;

  interface TaxClassEntry { pg: number; tax: number }
  const exciseByCls: Record<string, TaxClassEntry> = {};
  for (const b of batches) {
    if (b.proofGallonsProcessed == null) continue;
    const cls = b.taxClass ?? "standard";
    if (!exciseByCls[cls]) exciseByCls[cls] = { pg: 0, tax: 0 };
    exciseByCls[cls].pg  += b.proofGallonsProcessed;
    exciseByCls[cls].tax += b.exciseTaxDue ?? (b.proofGallonsProcessed * (taxClassRates[cls] ?? 13.50));
  }
  // If no batch records exist for the period but we have imported excise-by-product data,
  // assign all proof gallons to Craft Tier 1 (the applicable rate for this DSP).
  const hasBatchData = Object.keys(exciseByCls).length > 0;
  if (!hasBatchData && exciseByProduct && exciseByProduct.totalProofGallons > 0) {
    exciseByCls["craft_tier1"] = {
      pg:  exciseByProduct.totalProofGallons,
      tax: exciseByProduct.totalExciseTax,
    };
  }

  const dspNumber      = platformConfig?.dspNumber;
  const proprietorName = platformConfig?.organizationNameOverride || platformConfig?.organizationName || "Distillr";

  async function handleExport() {
    setExporting(true);
    try {
      await exportReportsToExcel({ month, proprietorName, dspNumber: dspNumber ?? null, exciseByProduct, summary, batches, allBatches: allBatches as any[], barrels: barrels as any[] });
    } finally { setExporting(false); }
  }

  async function handleExport5110() {
    setExporting5110(true);
    try { await export5110Word({ month, proprietorName, dspNumber: dspNumber ?? null, summary }); }
    finally { setExporting5110(false); }
  }

  async function handleExport5000() {
    if (!exciseByProduct) return;
    setExporting5000(true);
    try { await export5000Word({ month, proprietorName, dspNumber: dspNumber ?? null, exciseByProduct }); }
    finally { setExporting5000(false); }
  }

  const REPORT_META: Record<ReportKey, { title: string; subtitle: string }> = {
    operations:    { title: "Operations Report",    subtitle: "TTB Form 5110.40 — Monthly Report of Production Operations" },
    excise:        { title: "Excise Tax Return",     subtitle: "TTB Form 5000.24 — Distilled Spirits" },
    state:         { title: "State Distributor",     subtitle: "Sales orders to state distributors for the selected period" },
    batches:       { title: "Batch Detail",          subtitle: "All batches with activity in the selected reporting period" },
    "all-batches": { title: "All Production",        subtitle: "Every batch in the system — all time, no period filter" },
    barrels:       { title: "Barrel Inventory",      subtitle: "Full barrel registry and aging status" },
  };
  const currentMeta = REPORT_META[report];
  const needsPeriod  = report !== "all-batches" && report !== "barrels";

  const periodLabel = month
    ? (() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); })()
    : "—";

  return (
    <Layout>
      <div className="flex flex-col" style={{ minHeight: "calc(100vh - 56px)" }}>

        {/* ── Control Bar ── */}
        <div className="bg-white border-b border-[#e5e5e5] sticky top-0 z-20 shadow-sm">
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap">

            {/* Report selector */}
            <ReportDropdown value={report} onChange={setReport} />

            <div className="h-7 w-px bg-[#f0ede9] shrink-0" />

            {/* Period picker */}
            {needsPeriod && <PeriodPicker month={month} onChange={setMonth} />}
            {!needsPeriod && (
              <span className="text-[11px] text-[#a3a3a3] italic">No period filter for this report</span>
            )}

            <div className="flex-1" />

            {/* DSP chip */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f9f8f7] border border-[#e5e5e5]">
              <span className="text-[9px] font-bold text-[#a3a3a3] uppercase tracking-wider">DSP</span>
              <span className={`text-[11px] font-semibold ${dspNumber ? "text-[#0a0a0a]" : "text-red-400 italic"}`}>
                {dspNumber ?? "Not set"}
              </span>
            </div>

            {/* Export buttons */}
            {report === "operations" && (
              <Button variant="outline" size="sm" onClick={handleExport5110} disabled={exporting5110 || summaryLoading} className="text-xs gap-1.5">
                <FileDown size={12} />
                {exporting5110 ? "Generating…" : "Word 5110.40"}
              </Button>
            )}
            {report === "excise" && (
              <Button variant="outline" size="sm" onClick={handleExport5000} disabled={exporting5000 || exciseByProductLoading || !exciseByProduct} className="text-xs gap-1.5">
                <FileDown size={12} />
                {exporting5000 ? "Generating…" : "Word 5000.24"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || summaryLoading} className="text-xs gap-1.5">
              <Download size={12} />
              {exporting ? "Generating…" : "Export Excel"}
            </Button>
          </div>
        </div>

        {/* ── Report Title Banner ── */}
        <div className="bg-[#0a0a0a] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">{proprietorName}{dspNumber ? ` · DSP ${dspNumber}` : ""}</p>
            <h1 className="text-white text-lg font-bold">{currentMeta.title}</h1>
            <p className="text-white/40 text-xs mt-0.5">{currentMeta.subtitle}</p>
          </div>
          {needsPeriod && (
            <div className="text-right shrink-0">
              <p className="text-white/80 text-sm font-bold">{periodLabel}</p>
              <p className="text-white/30 text-[10px] mt-0.5">Reporting Period</p>
            </div>
          )}
        </div>

        {/* ── Report Body ── */}
        <div className="flex-1 overflow-y-auto bg-[#f7f5f2]">
          <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

            {/* ---------------------------------------------------------------- */}
            {/* Operations (5110.40) */}
            {/* ---------------------------------------------------------------- */}
            {report === "operations" && (
              <div className="space-y-0 rounded-2xl overflow-hidden border border-[#0a0a0a]/15 shadow-sm">

                {summaryLoading ? (
                  <div className="bg-white p-12 text-center text-sm text-[#737373]">Loading report data…</div>
                ) : (
                  <>
                    {/* Part I */}
                    <div className="bg-white border-b border-[#e5e5e5]">
                      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                        <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">I</span>
                        <div>
                          <p className="text-xs font-semibold text-[#0a0a0a]">Spirits Produced</p>
                          <p className="text-[10px] text-[#a3a3a3]">By distillation date within the reporting period</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">{totalProduced.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
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
                              <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                                <td className="px-6 py-2.5 font-medium text-[#0a0a0a] capitalize">{r.spiritType}</td>
                                <td className="px-4 py-2.5 text-[#737373] capitalize">{r.spiritClass || "—"}</td>
                                <td className="px-4 py-2.5 text-[#737373] font-mono text-[10px]">{(r.batchCodes ?? []).join(", ") || "—"}</td>
                                <td className="px-4 py-2.5 text-center text-[#737373]">{r.batchCount}</td>
                                <td className="px-6 py-2.5 text-right font-semibold tabular-nums">{r.proofGallons.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[#0a0a0a]/10 bg-[#f7f7f7]">
                              <td className="px-6 py-2 font-semibold text-[#0a0a0a]" colSpan={4}>Total Spirits Produced</td>
                              <td className="px-6 py-2 text-right font-bold text-[#0a0a0a] tabular-nums">{totalProduced.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>

                    {/* Part II */}
                    <div className="bg-white border-b border-[#e5e5e5]">
                      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                        <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">II</span>
                        <div>
                          <p className="text-xs font-semibold text-[#0a0a0a]">Spirits Deposited to Bond</p>
                          <p className="text-[10px] text-[#a3a3a3]">By fill date within the reporting period</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">{totalDeposited.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
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
                              <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                                <td className="px-6 py-2.5 font-medium text-[#0a0a0a] capitalize">{r.spiritType}</td>
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
                            <tr className="border-t-2 border-[#0a0a0a]/10 bg-[#f7f7f7]">
                              <td className="px-6 py-2 font-semibold text-[#0a0a0a]" colSpan={4}>Total Deposited to Bond</td>
                              <td className="px-4 py-2 text-right font-semibold tabular-nums">{(summary?.total_fill_wine_gallons ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2" />
                              <td className="px-6 py-2 text-right font-bold text-[#0a0a0a] tabular-nums">{totalDeposited.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>

                    {/* Part III */}
                    <div className="bg-white border-b border-[#e5e5e5]">
                      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                        <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">III</span>
                        <div>
                          <p className="text-xs font-semibold text-[#0a0a0a]">Bonded Storage Balance</p>
                          <p className="text-[10px] text-[#a3a3a3]">Period ledger + current warehouse inventory</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">{(summary?.ending_bond_balance ?? 0).toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                          <p className="text-[10px] text-[#a3a3a3]">Ending balance</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-[#e5e5e5]">
                        <div className="px-6 py-4">
                          <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Period Ledger</p>
                          <div className="space-y-2">
                            {[
                              { label: "Beginning Inventory",          value: (summary?.beginning_bond_balance ?? 0).toFixed(2), sign: "" },
                              { label: "Spirits Deposited (Part II)", value: totalDeposited.toFixed(2),                          sign: "+" },
                              { label: "Spirits Processed (Part IV)", value: totalProcessed.toFixed(2),                          sign: "−" },
                              { label: "Losses / Angel's Share",      value: (summary?.period_losses_pg ?? 0).toFixed(2),        sign: "−" },
                            ].map((row) => (
                              <div key={row.label} className="flex items-center justify-between text-xs">
                                <span className="text-[#737373]">
                                  {row.sign && <span className="font-mono w-3 inline-block text-[#0a0a0a]">{row.sign}</span>}
                                  {row.label}
                                </span>
                                <span className="font-medium tabular-nums text-[#404040]">{row.value} PG</span>
                              </div>
                            ))}
                            <div className="border-t-2 border-[#0a0a0a] pt-2 mt-2 flex items-center justify-between text-xs font-bold">
                              <span className="text-[#0a0a0a]">= Ending Bond Balance</span>
                              <span className="text-[#0a0a0a] tabular-nums text-sm">{(summary?.ending_bond_balance ?? 0).toFixed(2)} PG</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-4">
                          <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Current Warehouse (Aging Barrels)</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#737373]">Barrels in Bond</span>
                              <span className="font-semibold text-[#0a0a0a] tabular-nums">{summary?.barrels_in_bond_count ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#737373]">Wine Gallons in Bond</span>
                              <span className="font-semibold text-[#0a0a0a] tabular-nums">{(summary?.barrels_in_bond_wg ?? 0).toFixed(2)} WG</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#737373]">Proof Gallons in Bond</span>
                              <span className="font-bold text-[#0a0a0a] tabular-nums text-sm">{(summary?.barrels_in_bond_pg ?? 0).toFixed(2)} PG</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-[#a3a3a3] mt-4 italic">Snapshot as of report generation — all barrels with status "Aging"</p>
                        </div>
                      </div>
                    </div>

                    {/* Part IV */}
                    <div className="bg-white">
                      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                        <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">IV</span>
                        <div>
                          <p className="text-xs font-semibold text-[#0a0a0a]">Spirits Processed</p>
                          <p className="text-[10px] text-[#a3a3a3]">By bottling date — taxable removals from bond</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">{totalProcessed.toFixed(2)} <span className="text-xs font-normal text-[#737373]">PG</span></p>
                          <p className="text-[10px] text-[#525252] font-medium">${totalExcise.toLocaleString("en-US", { minimumFractionDigits: 2 })} excise tax</p>
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
                                <tr key={i} className={`border-b border-[#f5f5f5] ${i % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                                  <td className="px-6 py-2.5 font-medium text-[#0a0a0a] capitalize">{r.spiritType}</td>
                                  <td className="px-4 py-2.5 text-[#737373] capitalize">{r.spiritClass || "—"}</td>
                                  <td className="px-4 py-2.5 text-[#737373] font-mono text-[10px]">{(r.lotNumbers ?? []).join(", ") || "—"}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.avgBottlingProof.toFixed(1)}°</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.cases750 || "—"}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.cases1000 || "—"}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.cases1750 || "—"}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.totalCases}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.proofGallons.toFixed(2)}</td>
                                  <td className="px-6 py-2.5 text-right font-bold text-white tabular-nums">
                                    ${r.exciseTaxDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-[#0a0a0a] bg-[#0a0a0a]">
                                <td className="px-6 py-2.5 font-bold text-white" colSpan={4}>Total Spirits Processed</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_750 ?? 0}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_1000 ?? 0}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">{summary?.total_cases_1750 ?? 0}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-white tabular-nums">{summary?.grand_total_cases ?? 0}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{totalProcessed.toFixed(2)}</td>
                                <td className="px-6 py-2.5 text-right font-bold text-white tabular-nums">
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

            {/* ---------------------------------------------------------------- */}
            {/* Excise Tax Return (5000.24) */}
            {/* ---------------------------------------------------------------- */}
            {report === "excise" && (() => {
              const [yr2, mo2] = month.split("-").map(Number);
              const dueDate    = new Date(mo2 === 12 ? yr2 + 1 : yr2, mo2 === 12 ? 0 : mo2, 14);
              const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

              const RATE_LINES = [
                { line: "1", cls: "craft_tier1", description: "Craft Distillery — Tier 1 Reduced Rate",  subtitle: "First 100,000 PG/year · IRC §5001(c)(1)", rate: 2.70  },
                { line: "2", cls: "craft_tier2", description: "Craft Distillery — Tier 2 Reduced Rate",  subtitle: "100,001–22,230,000 PG/year · IRC §5001(c)(2)", rate: 13.34 },
                { line: "3", cls: "standard",    description: "Standard Rate",                            subtitle: "Large distiller / over 22.23M PG annual",  rate: 13.50 },
              ];

              const ebp    = exciseByProduct;
              const netTax = ebp?.totalExciseTax ?? totalExcise;

              return (
                <div className="space-y-0 rounded-2xl overflow-hidden border border-[#0a0a0a]/15 shadow-sm">

                  {/* Part I — Identification */}
                  <div className="bg-white border-b border-[#e5e5e5]">
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">I</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0a0a0a]">Part I — Identification</p>
                        <p className="text-[10px] text-[#a3a3a3]">TTB Form 5000.24 · Excise Tax Return</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#e5e5e5]">
                      {[
                        { label: "1g · DSP Permit No.",   value: dspNumber || <span className="text-red-500 italic text-xs">Not configured</span> },
                        { label: "1h · Proprietor Name",  value: proprietorName },
                        { label: "1d · Tax Period",       value: periodLabel },
                        { label: "1e · Payment Due",      value: dueDateStr },
                      ].map((item, i) => (
                        <div key={i} className="px-5 py-3.5">
                          <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wider mb-1">{item.label}</p>
                          <p className="text-xs font-semibold text-[#0a0a0a]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Part II — Tax on Distilled Spirits */}
                  <div className="bg-white border-b border-[#e5e5e5]">
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">II</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0a0a0a]">Part II — Tax on Distilled Spirits</p>
                        <p className="text-[10px] text-[#a3a3a3]">Proof gallons removed from bond, by applicable rate class</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">
                          ${(ebp?.totalExciseTax ?? totalExcise).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-[#a3a3a3]">Total tax on spirits</p>
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                          <th className="text-center px-4 py-2 text-[#737373] font-medium w-12">Line</th>
                          <th className="text-left px-4 py-2 text-[#737373] font-medium">Kind of Spirits / Rate Class</th>
                          <th className="text-right px-5 py-2 text-[#737373] font-medium">Rate ($/PG)</th>
                          <th className="text-right px-5 py-2 text-[#737373] font-medium">Proof Gallons</th>
                          <th className="text-right px-6 py-2 text-[#737373] font-medium">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RATE_LINES.map((row) => {
                          const entry  = exciseByCls[row.cls];
                          const pg     = entry?.pg  ?? 0;
                          const tax    = entry?.tax ?? 0;
                          const active = pg > 0;
                          return (
                            <tr key={row.cls} className={`border-b border-[#f5f5f5] ${active ? "" : "opacity-40"}`}>
                              <td className="px-4 py-3 text-center text-[#a3a3a3] font-mono text-[11px]">{row.line}</td>
                              <td className="px-4 py-3">
                                <p className={`font-medium ${active ? "text-[#0a0a0a]" : "text-[#737373]"}`}>{row.description}</p>
                                <p className="text-[10px] text-[#a3a3a3] mt-0.5">{row.subtitle}</p>
                              </td>
                              <td className="px-5 py-3 text-right font-mono tabular-nums text-[#737373]">${row.rate.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right font-semibold tabular-nums">{active ? pg.toFixed(4) : "0.0000"}</td>
                              <td className="px-6 py-3 text-right font-bold tabular-nums text-[#0a0a0a]">
                                {active ? `$${tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#0a0a0a] bg-[#0a0a0a]">
                          <td className="px-4 py-2.5" />
                          <td className="px-4 py-2.5 font-bold text-white">Total Tax — Distilled Spirits</td>
                          <td className="px-5 py-2.5" />
                          <td className="px-5 py-2.5 text-right font-bold text-white tabular-nums">{(ebp?.totalProofGallons ?? totalProcessed).toFixed(4)}</td>
                          <td className="px-6 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                            ${(ebp?.totalExciseTax ?? totalExcise).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Part III — Other Commodities */}
                  <div className="bg-white border-b border-[#e5e5e5]">
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">III</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0a0a0a]">Part III — Other Commodities</p>
                        <p className="text-[10px] text-[#a3a3a3]">Wine, beer, tobacco, firearms — not applicable for DSP operations</p>
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                          <th className="text-left px-6 py-2 text-[#737373] font-medium">Commodity</th>
                          <th className="text-right px-6 py-2 text-[#737373] font-medium">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {["Wine", "Beer", "Tobacco Products", "Cigarette Papers & Tubes", "Firearms & Ammunition"].map((c) => (
                          <tr key={c} className="border-b border-[#f5f5f5] opacity-40">
                            <td className="px-6 py-2 text-[#737373]">{c}</td>
                            <td className="px-6 py-2 text-right text-[#a3a3a3] italic">N/A</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Part IV — Tax by Product (Schedule A detail) */}
                  <div className="bg-white border-b border-[#e5e5e5]">
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">IV</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0a0a0a]">Part IV — Excise Tax by Product (Schedule A)</p>
                        <p className="text-[10px] text-[#a3a3a3]">Cases sold per product this period, proof gallons, and tax owed</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-lg font-bold text-[#0a0a0a] tabular-nums">
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
                            <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
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
                                <tr key={row.key} className={`border-b border-[#f5f5f5] ${!active ? "opacity-40" : i % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                                  <td className={`px-6 py-2.5 font-medium ${active ? "text-[#0a0a0a]" : "text-[#737373]"}`}>{row.name}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{active ? row.distCases : "—"}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{active ? row.retailCases : "—"}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{active ? row.totalCases : "—"}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-[#737373]">{row.abv.toFixed(1)}%</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{active ? row.proofGallons.toFixed(4) : "—"}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[#0a0a0a]">
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
                            <tr className="border-t-2 border-[#0a0a0a] bg-[#0a0a0a]">
                              <td className="px-6 py-2.5 font-bold text-white">Totals</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{ebp?.totalDistCases ?? 0}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">{ebp?.totalRetailCases ?? 0}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{ebp?.totalCases ?? 0}</td>
                              <td className="px-4 py-2.5" />
                              <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{(ebp?.totalProofGallons ?? 0).toFixed(4)}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                                ${(ebp?.totalExciseTax ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-2.5" />
                            </tr>
                          </tfoot>
                        </table>
                        <p className="px-6 py-2 text-[10px] text-[#a3a3a3] italic border-t border-[#f0f0f0]">
                          Formula: Cases × 1.19 gal/case × (ABV × 2) ÷ 100 = Proof Gallons · Rate: $2.70/PG (Craft Tier 1, IRC §5001(c)(1)) · Per Bottle = Excise Tax ÷ 6
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Part V — Summary / Net Amount Due */}
                  <div className="bg-white">
                    <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      <span className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">V</span>
                      <p className="text-xs font-semibold text-[#0a0a0a]">Part V — Summary &amp; Net Amount Due</p>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[#e5e5e5]">
                      <div className="px-6 py-5 flex flex-col gap-3">
                        {[
                          { line: "8",  label: "Total Tax Liability — Distilled Spirits",    value: netTax, bold: false },
                          { line: "9",  label: "Adjustments Increasing Tax (Schedule A)",     value: 0,      bold: false, muted: true },
                          { line: "10", label: "Total Adjusted Tax Due",                      value: netTax, bold: false },
                          { line: "11", label: "Adjustments Decreasing Tax (Schedule B)",     value: 0,      bold: false, muted: true },
                          { line: "12", label: "Net Amount Due — Remit This Amount",          value: netTax, bold: true  },
                        ].map(({ line, label, value, bold, muted }) => (
                          <div key={line} className={`flex items-center justify-between text-xs ${bold ? "border-t-2 border-[#0a0a0a] pt-3 mt-1" : ""}`}>
                            <span className={`flex items-center gap-2 ${muted ? "text-[#a3a3a3]" : "text-[#737373]"}`}>
                              <span className="font-mono text-[10px] w-5 text-right shrink-0 text-[#a3a3a3]">{line}</span>
                              {label}
                            </span>
                            <span className={`tabular-nums ${bold ? "text-xl font-bold text-[#0a0a0a]" : muted ? "text-[#a3a3a3]" : "font-semibold text-[#0a0a0a]"}`}>
                              ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="px-6 py-5 space-y-2.5">
                        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Payment Instructions</p>
                        <div className="space-y-1.5 text-xs text-[#737373]">
                          <p><span className="font-medium text-[#0a0a0a]">Method:</span> Electronic Funds Transfer (EFT) via Pay.gov</p>
                          <p><span className="font-medium text-[#0a0a0a]">Due:</span> {dueDateStr}</p>
                          <p><span className="font-medium text-[#0a0a0a]">Reference:</span> DSP {dspNumber ?? "—"} · {periodLabel}</p>
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

            {/* ---------------------------------------------------------------- */}
            {/* State Distributor */}
            {/* ---------------------------------------------------------------- */}
            {report === "state" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Total Orders"  value={String(stateReport?.totalOrders ?? 0)} highlight={(stateReport?.totalOrders ?? 0) > 0} />
                  <StatCard label="Total Revenue" value={`$${(stateReport?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} highlight={(stateReport?.totalRevenue ?? 0) > 0} />
                </div>
                <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-sm">
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
                                {o.total_amount ? `$${parseFloat(o.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
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

            {/* ---------------------------------------------------------------- */}
            {/* All Production */}
            {/* ---------------------------------------------------------------- */}
            {report === "all-batches" && (
              <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-sm">
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

            {/* ---------------------------------------------------------------- */}
            {/* Barrel Inventory */}
            {/* ---------------------------------------------------------------- */}
            {report === "barrels" && (
              <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-sm">
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
                                b.status === "Aging"   ? "bg-amber-100 text-amber-700" :
                                b.status === "Dumped"  ? "bg-blue-100 text-blue-700"   :
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

            {/* ---------------------------------------------------------------- */}
            {/* Batch Detail */}
            {/* ---------------------------------------------------------------- */}
            {report === "batches" && (
              <div className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-[#e5e5e5]">
                  <h3 className="text-sm font-semibold text-[#0a0a0a]">Batches in Period</h3>
                  <p className="text-xs text-[#737373] mt-0.5">Includes any batch with a distill, fill, or bottling date in the selected month</p>
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
                              {b.exciseTaxDue != null ? `$${b.exciseTaxDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
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
        </div>
      </div>
    </Layout>
  );
}
