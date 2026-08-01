import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Upload, Download } from "lucide-react";
import { exportToCsv, downloadBrandedTemplate, parseImportFile } from "../lib/csv";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { fmt, fmtNum } from "../lib/utils";
import type { DistillingBatchRecord } from "@shared/schema";

// ---------------------------------------------------------------------------
// Tax class labels (mirrors batch-detail.tsx TAX_CLASSES)
// ---------------------------------------------------------------------------
const TAX_CLASS_LABELS: Record<string, string> = {
  craft_tier1: "Craft Tier 1 — ≤100,000 PG ($2.70/PG)",
  craft_tier2: "Craft Tier 2 — 100,001–22.1M PG ($13.34/PG)",
  standard: "Standard Rate ($13.50/PG)",
};

// ---------------------------------------------------------------------------
// Stage pill
// ---------------------------------------------------------------------------
const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  mash_fermentation: "Mash & Fermentation",
  distillation: "Distillation",
  barreling: "Barreling",
  aging: "Aging",
  bottling: "Bottling",
  closed: "Closed",
};

const STAGE_STEP: Record<string, number> = {
  planning: 1, mash_fermentation: 2, distillation: 3, barreling: 4,
  aging: 5, bottling: 6, closed: 7,
};

function StagePill({ stage }: { stage: string }) {
  const step = STAGE_STEP[stage] ?? 1;
  const label = STAGE_LABELS[stage] ?? stage;
  const isClosed = stage === "closed";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
      isClosed ? "bg-[#22c55e]/10 text-[#16a34a]" : "bg-[#0a0a0a]/8 text-[#0a0a0a]"
    }`}>
      <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
        isClosed ? "bg-[#22c55e] text-white" : "bg-[var(--brand)] text-white"
      }`}>{step}</span>
      {label}
      <span className="text-[#737373] font-normal">· {step}/7</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BatchRow = DistillingBatchRecord & {
  productName?: string | null;
  spiritType?: string | null;
  spiritClass?: string | null;
  fillProof?: number | null;
  fillWineGallons?: number | null;
  fillProofGallons?: number | null;
  proofGallonsProduced?: number | null;
  distillationProof?: number | null;
  stillType?: string | null;
  fillNumber?: string | null;
  containerType?: string | null;
  bottlingDate?: string | null;
  bottlingProof?: number | null;
  wineGallonsBottled?: number | null;
  proofGallonsProcessed?: number | null;
  cases750ml?: number | null;
  cases1000ml?: number | null;
  cases1750ml?: number | null;
  totalCases?: number | null;
  lotNumber?: string | null;
  taxClass?: string | null;
  exciseTaxDue?: number | null;
  targetDumpDate?: string | null;
  amountReceivedGallons?: number | null;
  distillDate?: string | null;
  fillDate?: string | null;
  // Joined from distilling_inventory_records
  invCasesToDistributors?: number | null;
  invCasesToRetail?: number | null;
  invCasesMade?: number | null;
  invBottlesMade?: number | null;
  invReportMonth?: string | null;
  invTaxesOwed?: number | null;
  invAbv?: number | null;
  invProofGallons?: number | null;
  invEndingUsGallons?: number | null;
  invBeginningCases?: number | null;
  invEndingInventory?: number | null;
};

// ---------------------------------------------------------------------------
// Read-only detail row helper
// ---------------------------------------------------------------------------
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-[#f0f0f0] last:border-0">
      <span className="text-xs text-[#737373] w-44 shrink-0">{label}</span>
      <span className="text-xs font-medium text-[#0a0a0a] text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-2">{title}</p>
      <div className="rounded-lg border border-[#e5e5e5] px-3 py-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only batch detail dialog — full source-of-truth record
// ---------------------------------------------------------------------------
function fmtMoney(n: number | null | undefined) {
  if (n == null) return null;
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-1">{label}</p>
      <p className={`text-lg font-bold leading-tight ${accent ?? "text-[#0a0a0a]"}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#737373] mt-0.5">{sub}</p>}
    </div>
  );
}

function BatchDetailDialog({ batch, onClose, onEdit }: {
  batch: BatchRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  // Fetch the full joined record — production, barrel, inventory
  const { data: full } = useQuery<{
    batch: any;
    productionRecord: any;
    barrel: any;
    inventoryRecord: any;
  }>({
    queryKey: [`/api/distilling/batch-records/${batch.id}/full`],
    queryFn: () => apiRequest(`/api/distilling/batch-records/${batch.id}/full`),
    staleTime: 30_000,
  });

  // Merge full data over the sparse list row
  const b: any = {
    ...batch,
    ...(full?.batch ?? {}),
    // Flatten production record fields
    distillDate: full?.productionRecord?.distillDate ?? (batch as any).distillDate,
    distillationProof: full?.productionRecord?.percentageDistilled ?? (batch as any).distillationProof,
    proofGallonsProduced: full?.productionRecord?.proofOfGallons ?? (batch as any).proofGallonsProduced,
    stillType: full?.productionRecord?.stillType ?? (batch as any).stillType,
    gallonsDistilled: full?.productionRecord?.gallonsDistilled ?? null,
    // Flatten barrel fields
    barrelSerialNumber: full?.barrel?.serialNumber ?? null,
    fillProof: full?.barrel?.fillProof ?? (batch as any).fillProof,
    fillWineGallons: full?.barrel?.fillVolume ?? (batch as any).fillWineGallons,
    fillProofGallons: full?.barrel?.fillProofGallons ?? (batch as any).fillProofGallons,
    warehouseZone: full?.barrel?.warehouseZone ?? null,
    charLevel: full?.barrel?.charLevel ?? null,
    currentProofGallons: full?.barrel?.currentProofGallons ?? null,
    totalAgingDays: full?.barrel?.totalAgingDays ?? null,
    barrelStatus: full?.barrel?.status ?? null,
    // Flatten inventory record fields
    invCasesToDistributors: full?.inventoryRecord
      ? Object.values(full.inventoryRecord.casesToDistributors ?? {}).reduce((s: number, v: any) => s + Number(v), 0)
      : (batch as any).invCasesToDistributors,
    invCasesToRetail: full?.inventoryRecord
      ? Object.values(full.inventoryRecord.casesToRetail ?? {}).reduce((s: number, v: any) => s + Number(v), 0)
      : (batch as any).invCasesToRetail,
    invCasesMade: full?.inventoryRecord
      ? Object.values(full.inventoryRecord.casesMade ?? {}).reduce((s: number, v: any) => s + Number(v), 0)
      : (batch as any).invCasesMade,
    invBottlesMade: full?.inventoryRecord
      ? Object.values(full.inventoryRecord.bottlesMade ?? {}).reduce((s: number, v: any) => s + Number(v), 0)
      : (batch as any).invBottlesMade,
    invReportMonth: full?.inventoryRecord?.reportMonth ?? (batch as any).invReportMonth,
    invTaxesOwed: full?.inventoryRecord?.taxesOwed ?? (batch as any).invTaxesOwed,
    invAbv: full?.inventoryRecord?.averageAbvPercent ?? (batch as any).invAbv,
    invProofGallons: full?.inventoryRecord?.endingProofGallons ?? (batch as any).invProofGallons,
    invEndingUsGallons: full?.inventoryRecord?.endingUsGallons ?? (batch as any).invEndingUsGallons,
    invBeginningCases: full?.inventoryRecord?.beginningOfMonthCases ?? (batch as any).invBeginningCases,
    invEndingInventory: full?.inventoryRecord?.endingMonthInventory ?? (batch as any).invEndingInventory,
  };

  // Resolve all values — prefer inventory record (source of truth) over batch fields
  const distCases    = b.invCasesToDistributors ?? 0;
  const retailCases  = b.invCasesToRetail ?? 0;
  const totalSold    = distCases + retailCases;
  const casesMade    = b.invCasesMade || b.totalCases || 0;
  const bottlesMade  = b.invBottlesMade || (casesMade * 12) || 0;
  const proofGallons = b.invProofGallons || b.proofGallonsProcessed || b.proofGallonsProduced || null;
  const usGallons    = b.invEndingUsGallons || null;
  const exciseTax    = b.invTaxesOwed || batch.exciseTaxDue || null;
  const abv          = b.invAbv || null;
  const proof        = b.bottlingProof || (abv ? abv * 2 : null);
  const perBottle    = exciseTax && bottlesMade > 0 ? exciseTax / bottlesMade : null;
  const distPct      = totalSold > 0 ? Math.round((distCases / totalSold) * 100) : 0;
  const retailPct    = totalSold > 0 ? 100 - distPct : 0;

  const hasDistillation = !!(b.distillationProof || b.proofGallonsProduced || b.distillDate || b.stillType || b.gallonsDistilled);
  const hasBarreling    = !!(b.fillProof || b.fillWineGallons || b.fillDate || b.barrelSerialNumber);
  const hasAging        = !!(b.targetDumpDate || b.amountReceivedGallons != null || b.totalAgingDays || b.currentProofGallons);
  const hasBottling     = !!(b.bottlingDate || b.cases750ml != null || b.cases1000ml != null || b.cases1750ml != null);
  const loading         = !full;

  const reportLabel = b.invReportMonth
    ? new Date(b.invReportMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : fmt(batch.batchDate);

  return (
    <Dialog open onClose={onClose} title="" size="lg">
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e5e5e5]">
          <div>
            <p className="text-base font-bold text-[#0a0a0a]">{b.productName ?? batch.batchCode}</p>
            <p className="text-xs text-[#737373] mt-0.5 font-mono">{batch.batchCode} · {reportLabel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StagePill stage={batch.stage} />
            {loading && <span className="text-[10px] text-[#b0b0b0] animate-pulse">Loading…</span>}
          </div>
        </div>

        {/* ── Key metrics grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label="Total Cases"
            value={casesMade > 0 ? casesMade.toLocaleString() : "—"}
            sub={bottlesMade > 0 ? `${bottlesMade.toLocaleString()} bottles` : undefined}
          />
          <MetricCard
            label="Proof Gal (State)"
            value={proofGallons ? Number(proofGallons).toFixed(3) : "—"}
            sub={usGallons ? `${Number(usGallons).toFixed(3)} US gal (Federal)` : undefined}
          />
          <MetricCard
            label="Excise Tax"
            value={exciseTax ? fmtMoney(exciseTax)! : "—"}
            sub={perBottle ? `${fmtMoney(perBottle)}/bottle` : undefined}
            accent="text-[#0369a1]"
          />
          <MetricCard
            label="ABV / Proof"
            value={abv ? `${abv}% / ${proof}°` : proof ? `${proof}°` : "—"}
          />
        </div>

        {/* ── Distribution split ── */}
        {(distCases > 0 || retailCases > 0) && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-2">Distribution Channel</p>
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[#1d4ed8]/8 border border-[#1d4ed8]/20 px-3 py-2">
                  <p className="text-[10px] text-[#1d4ed8] font-semibold uppercase tracking-wide mb-0.5">Distributor</p>
                  <p className="text-xl font-bold text-[#1d4ed8]">{distCases.toLocaleString()}</p>
                  <p className="text-[10px] text-[#1d4ed8]/70">cases · {distPct}%</p>
                </div>
                <div className="rounded-md bg-[#be185d]/8 border border-[#be185d]/20 px-3 py-2">
                  <p className="text-[10px] text-[#be185d] font-semibold uppercase tracking-wide mb-0.5">Retail</p>
                  <p className="text-xl font-bold text-[#be185d]">{retailCases.toLocaleString()}</p>
                  <p className="text-[10px] text-[#be185d]/70">cases · {retailPct}%</p>
                </div>
              </div>
              {distCases > 0 && retailCases > 0 && (
                <div>
                  <div className="h-2.5 rounded-full bg-[#e5e7eb] overflow-hidden flex">
                    <div className="bg-[#1d4ed8] h-full transition-all" style={{ width: `${distPct}%` }} />
                    <div className="bg-[#db2777] h-full flex-1" />
                  </div>
                  <p className="text-[10px] text-[#737373] mt-1 text-right">
                    {totalSold.toLocaleString()} total cases sold
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Inventory position ── */}
        {(b.invBeginningCases != null || b.invEndingInventory != null) && (
          <Section title="Inventory Position">
            <DetailRow label="Beginning of Month" value={b.invBeginningCases != null ? `${b.invBeginningCases} cases` : null} />
            <DetailRow label="Cases Produced" value={casesMade > 0 ? `${casesMade} cases` : null} />
            <DetailRow label="Cases Sold" value={totalSold > 0 ? `${totalSold} cases` : null} />
            <DetailRow label="Ending Inventory" value={b.invEndingInventory != null ? `${b.invEndingInventory} cases` : null} />
          </Section>
        )}

        {/* ── Production stages (only if data exists) ── */}
        {hasDistillation && (
          <Section title="Distillation">
            <DetailRow label="Distill Date" value={fmt(b.distillDate)} />
            <DetailRow label="Still Type" value={b.stillType} />
            <DetailRow label="Distillation Proof" value={b.distillationProof ? `${b.distillationProof}°` : null} />
            <DetailRow label="Gallons Distilled" value={b.gallonsDistilled ? `${fmtNum(b.gallonsDistilled)} gal` : null} />
            <DetailRow label="Proof Gallons Produced" value={b.proofGallonsProduced ? `${fmtNum(b.proofGallonsProduced)} PG` : null} />
          </Section>
        )}

        {hasBarreling && (
          <Section title="Barreling">
            <DetailRow label="Barrel Serial #" value={b.barrelSerialNumber} />
            <DetailRow label="Fill Date" value={fmt(b.fillDate)} />
            <DetailRow label="Fill Number" value={b.fillNumber} />
            <DetailRow label="Container Type" value={b.containerType} />
            <DetailRow label="Char Level" value={b.charLevel} />
            <DetailRow label="Warehouse Zone" value={b.warehouseZone} />
            <DetailRow label="Fill Proof" value={b.fillProof ? `${b.fillProof}°` : null} />
            <DetailRow label="Fill Wine Gallons" value={b.fillWineGallons ? `${fmtNum(b.fillWineGallons)} gal` : null} />
            <DetailRow label="Fill Proof Gallons" value={b.fillProofGallons ? `${fmtNum(b.fillProofGallons)} PG` : null} />
          </Section>
        )}

        {hasAging && (
          <Section title="Aging">
            <DetailRow label="Days Aged" value={b.totalAgingDays ? `${b.totalAgingDays} days` : null} />
            <DetailRow label="Current Proof Gallons" value={b.currentProofGallons ? `${fmtNum(b.currentProofGallons)} PG` : null} />
            <DetailRow label="Barrel Status" value={b.barrelStatus} />
            <DetailRow label="Target Dump Date" value={fmt(b.targetDumpDate)} />
            <DetailRow label="Amount Received" value={b.amountReceivedGallons != null ? `${b.amountReceivedGallons} gal` : null} />
          </Section>
        )}

        {hasBottling && (
          <Section title="Bottling">
            <DetailRow label="Bottling Date" value={fmt(b.bottlingDate)} />
            <DetailRow label="Lot Number" value={b.lotNumber} />
            <DetailRow label="Proof at Bottling" value={b.bottlingProof ? `${b.bottlingProof}°` : null} />
            <DetailRow label="Wine Gallons Bottled" value={b.wineGallonsBottled ? `${b.wineGallonsBottled} gal` : null} />
            <DetailRow label="Proof Gallons Processed" value={b.proofGallonsProcessed ? `${fmtNum(b.proofGallonsProcessed)} PG` : null} />
            <DetailRow label="Cases 750 mL" value={b.cases750ml} />
            <DetailRow label="Cases 1 L" value={b.cases1000ml} />
            <DetailRow label="Cases 1.75 L" value={b.cases1750ml} />
          </Section>
        )}

        {/* ── Record metadata ── */}
        <Section title="Record Details">
          <DetailRow label="Batch Code" value={<span className="font-mono">{batch.batchCode}</span>} />
          <DetailRow label="Status" value={batch.status} />
          <DetailRow label="Spirit Type" value={b.spiritType} />
          <DetailRow label="Spirit Class" value={b.spiritClass} />
          <DetailRow label="Tax Class" value={batch.taxClass ? (TAX_CLASS_LABELS[batch.taxClass] ?? batch.taxClass) : null} />
          <DetailRow label="Notes" value={batch.notes} />
        </Section>
      </div>

      <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit Batch →</Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Production() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: batches = [] } = useQuery<BatchRow[]>({
    queryKey: ["/api/distilling/batch-records"],
    queryFn: () => apiRequest("/api/distilling/batch-records"),
  });

  const deleteBatch = useMutation({
    mutationFn: () =>
      apiRequest(`/api/distilling/batch-records/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      setDeleteTarget(null);
      toast.success("Batch deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const EXPORT_COLS = [
    // Identity
    { header: "batchCode",             key: "batchCode" },
    { header: "productName",           key: "productName" },
    { header: "stage",                 key: "stage" },
    { header: "status",                key: "status" },
    { header: "batchDate",             key: "batchDate" },
    { header: "spiritType",            key: "spiritType" },
    { header: "spiritClass",           key: "spiritClass" },
    { header: "notes",                 key: "notes" },
    // Distillation
    { header: "distillDate",           key: "distillDate" },
    { header: "stillType",             key: "stillType" },
    { header: "distillationProof",     key: "distillationProof" },
    { header: "proofGallonsProduced",  key: "proofGallonsProduced" },
    // Barreling
    { header: "fillNumber",            key: "fillNumber" },
    { header: "containerType",         key: "containerType" },
    { header: "fillDate",              key: "fillDate" },
    { header: "fillProof",             key: "fillProof" },
    { header: "fillWineGallons",       key: "fillWineGallons" },
    { header: "fillProofGallons",      key: "fillProofGallons" },
    // Aging
    { header: "targetDumpDate",        key: "targetDumpDate" },
    { header: "amountReceivedGallons", key: "amountReceivedGallons" },
    // Bottling
    { header: "bottlingDate",          key: "bottlingDate" },
    { header: "lotNumber",             key: "lotNumber" },
    { header: "bottlingProof",         key: "bottlingProof" },
    { header: "wineGallonsBottled",    key: "wineGallonsBottled" },
    { header: "proofGallonsProcessed", key: "proofGallonsProcessed" },
    { header: "cases750ml",            key: "cases750ml" },
    { header: "cases1000ml",           key: "cases1000ml" },
    { header: "cases1750ml",           key: "cases1750ml" },
    { header: "totalCases",            key: "totalCases" },
    { header: "taxClass",              key: "taxClass" },
    { header: "exciseTaxDue",          key: "exciseTaxDue" },
  ] as const;

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const rows = await parseImportFile(importFile);
      let ok = 0, fail = 0;
      for (const row of rows) {
        try {
          await apiRequest("/api/distilling/batch-records", {
            method: "POST",
            body: JSON.stringify({
              batchCode:             row.batchCode,
              stage:                 row.stage || "planning",
              batchDate:             row.batchDate || new Date().toISOString().split("T")[0],
              productName:           row.productName || undefined,
              spiritType:            row.spiritType || undefined,
              spiritClass:           row.spiritClass || undefined,
              notes:                 row.notes || undefined,
              distillDate:           row.distillDate || undefined,
              stillType:             row.stillType || undefined,
              distillationProof:     row.distillationProof ? +row.distillationProof : undefined,
              proofGallonsProduced:  row.proofGallonsProduced ? +row.proofGallonsProduced : undefined,
              fillNumber:            row.fillNumber || undefined,
              containerType:         row.containerType || undefined,
              fillDate:              row.fillDate || undefined,
              fillProof:             row.fillProof ? +row.fillProof : undefined,
              fillWineGallons:       row.fillWineGallons ? +row.fillWineGallons : undefined,
              fillProofGallons:      row.fillProofGallons ? +row.fillProofGallons : undefined,
              targetDumpDate:        row.targetDumpDate || undefined,
              amountReceivedGallons: row.amountReceivedGallons ? +row.amountReceivedGallons : undefined,
              bottlingDate:          row.bottlingDate || undefined,
              lotNumber:             row.lotNumber || undefined,
              bottlingProof:         row.bottlingProof ? +row.bottlingProof : undefined,
              wineGallonsBottled:    row.wineGallonsBottled ? +row.wineGallonsBottled : undefined,
              proofGallonsProcessed: row.proofGallonsProcessed ? +row.proofGallonsProcessed : undefined,
              cases750ml:            row.cases750ml ? +row.cases750ml : undefined,
              cases1000ml:           row.cases1000ml ? +row.cases1000ml : undefined,
              cases1750ml:           row.cases1750ml ? +row.cases1750ml : undefined,
              totalCases:            row.totalCases ? +row.totalCases : undefined,
              taxClass:              row.taxClass || undefined,
              exciseTaxDue:          row.exciseTaxDue ? +row.exciseTaxDue : undefined,
            }),
          });
          ok++;
        } catch { fail++; }
      }
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      setImportOpen(false);
      setImportFile(null);
      toast.success(`Imported ${ok} batch${ok !== 1 ? "es" : ""}${fail ? ` (${fail} failed)` : ""}`);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
    }
  }

  const STAGES = ["planning", "mash_fermentation", "distillation", "barreling", "aging", "bottling", "closed"] as const;
  const filtered = stageFilter === "all" ? batches : batches.filter(b => b.stage === stageFilter);

  return (
    <Layout>
      <PageHeader
        title="Production"
        subtitle={`${filtered.length} of ${batches.length} batch${batches.length !== 1 ? "es" : ""}`}
        actions={
          <>
            <div className="flex flex-wrap items-center gap-1 bg-white border border-[#e5e5e5] rounded-md p-0.5">
              <button
                onClick={() => setStageFilter("all")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${stageFilter === "all" ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
              >
                All
              </button>
              {STAGES.map(s => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${stageFilter === s ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => exportToCsv("production.csv", batches, EXPORT_COLS as any)}>
              <Download size={13} className="mr-1.5" /> Export
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={13} className="mr-1.5" /> Import
            </Button>
            <Button onClick={() => navigate("/production/new")}>+ New Batch</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Batch Code</Th>
                <Th>Product</Th>
                <Th>Date</Th>
                <Th className="hidden sm:table-cell">Dist / Retail</Th>
                <Th className="hidden md:table-cell">Proof Gal</Th>
                <Th className="hidden md:table-cell">Tax Due</Th>
                <Th>Stage</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[#737373] py-10">
                    {stageFilter === "all" ? "No batches yet — create one to get started" : `No batches in ${STAGE_LABELS[stageFilter]} stage`}
                  </Td>
                </Tr>
              ) : (
                filtered.map((b) => (
                  <Tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[#f7f7f7]"
                    onClick={() => navigate(`/production/${b.id}`)}
                  >
                    <Td className="font-mono font-medium text-[#0a0a0a]">{b.batchCode}</Td>
                    <Td className="text-[#737373]">{(b as any).productName ?? "—"}</Td>
                    <Td className="text-[#737373]">{fmt(b.batchDate)}</Td>
                    <Td className="hidden sm:table-cell text-xs">
                      {((b as any).invCasesToDistributors || (b as any).invCasesToRetail) ? (
                        <span>
                          <span className="text-[#1d4ed8] font-medium">{(b as any).invCasesToDistributors ?? 0}D</span>
                          {" / "}
                          <span className="text-[#be185d] font-medium">{(b as any).invCasesToRetail ?? 0}R</span>
                        </span>
                      ) : <span className="text-[#d1d5db]">—</span>}
                    </Td>
                    <Td className="hidden md:table-cell text-xs text-[#737373]">
                      {(b as any).invProofGallons ? `${Number((b as any).invProofGallons).toFixed(2)} PG` :
                       (b as any).proofGallonsProcessed ? `${fmtNum((b as any).proofGallonsProcessed)} PG` :
                       (b as any).proofGallonsProduced ? `${fmtNum((b as any).proofGallonsProduced)} PG` :
                       <span className="text-[#d1d5db]">—</span>}
                    </Td>
                    <Td className="hidden md:table-cell text-xs text-[#0369a1] font-medium">
                      {((b as any).exciseTaxDue || (b as any).invTaxesOwed) ?
                        `$${Number((b as any).exciseTaxDue || (b as any).invTaxesOwed).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                        <span className="text-[#d1d5db]">—</span>}
                    </Td>
                    <Td><StagePill stage={b.stage} /></Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/production/${b.id}`)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="Open batch"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                          title="Delete batch"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Batch">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to delete batch{" "}
              <span className="font-mono font-semibold">{deleteTarget.batchCode}</span>
              {(deleteTarget as any).productName && <> ({(deleteTarget as any).productName})</>}?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the batch and all associated workflow data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteBatch.mutate()}
                disabled={deleteBatch.isPending}
              >
                {deleteBatch.isPending ? "Deleting…" : "Delete Batch"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      {/* Import dialog */}
      <Dialog open={importOpen} onClose={() => { setImportOpen(false); setImportFile(null); }} title="Import Batches">
        <div className="space-y-4">
          <p className="text-xs text-[#737373]">
            Upload a CSV or XLSX file with columns: <span className="font-mono">batchCode, stage, batchDate</span> (required) and optional fields.
            Required: <span className="font-mono">batchCode, stage, batchDate</span>.
          </p>
          <button
            onClick={() => downloadBrandedTemplate("production")}
            className="text-xs text-[#0369a1] hover:underline"
          >
            Download branded template (.xlsx) →
          </button>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#737373] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#e5e5e5] file:text-xs file:font-medium file:bg-white hover:file:bg-[#f5f5f5] file:cursor-pointer"
          />
          {importFile && (
            <p className="text-xs text-[#737373]">Selected: <span className="font-medium text-[#0a0a0a]">{importFile.name}</span></p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }}>Cancel</Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
