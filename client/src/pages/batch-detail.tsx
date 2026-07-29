import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { fmt, fmtNum } from "../lib/utils";
import type {
  DistillingBatchRecord,
  DistillingProductionRecord,
  InsertDistillingBatchRecord,
  InsertDistillingProductionRecord,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Barrel {
  id: string;
  serialNumber: string;
  fillDate: string | null;
  fillProof: number | null;
  fillVolume: number | null;
  fillProofGallons: number | null;
  warehouseZone: string | null;
  charLevel: string | null;
  productName: string | null;
  notes: string | null;
}

interface BarrelEvent {
  id: string;
  eventType: string;
  eventAt: string | null;
  volumeChange: number | null;
  proofAtEvent: number | null;
  outdoorTemp: number | null;
  wineGallons: number | null;
  notes: string | null;
}

interface InventoryRecord {
  id: string;
  productName: string | null;
  reportMonth: string | null;
  casesMade: Record<string, number> | null;
  casesToDistributors: Record<string, number> | null;
  casesToRetail: Record<string, number> | null;
  bottlesMade: Record<string, number> | null;
  cases_cased?: number | null;
  bottles_empty?: number | null;
  bottlingDate?: string | null;
}

type BatchWithTTB = DistillingBatchRecord & {
  productName?: string | null;
  barrelId?: string | null;
  spiritType?: string | null;
  spiritClass?: string | null;
  distillationProof?: number | null;
  proofGallonsProduced?: number | null;
  stillType?: string | null;
  fillNumber?: string | null;
  fillProof?: number | null;
  fillWineGallons?: number | null;
  fillProofGallons?: number | null;
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
  amountReceivedGallons?: number | null;
  targetDumpDate?: string | null;
};

interface BatchFull {
  batch: BatchWithTTB;
  productionRecord: DistillingProductionRecord | null;
  barrel: Barrel | null;
  inventoryRecord: InventoryRecord | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STAGES = [
  "planning",
  "mash_fermentation",
  "distillation",
  "barreling",
  "aging",
  "bottling",
  "closed",
] as const;

type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  planning: "Planning",
  mash_fermentation: "Mash & Fermentation",
  distillation: "Distillation",
  barreling: "Barreling",
  aging: "Aging",
  bottling: "Bottling",
  closed: "Closed",
};

const SPIRIT_TYPES = [
  { value: "rum", label: "Rum" },
  { value: "whiskey", label: "Whiskey" },
  { value: "vodka", label: "Vodka" },
  { value: "gin", label: "Gin" },
  { value: "brandy", label: "Brandy" },
  { value: "neutral_spirits", label: "Neutral Spirits" },
];

const TAX_CLASSES = [
  { value: "craft_tier1", label: "Craft Tier 1 — ≤100,000 PG ($2.70/PG)" },
  { value: "craft_tier2", label: "Craft Tier 2 — 100,001–22.1M PG ($13.34/PG)" },
  { value: "standard", label: "Standard Rate ($13.50/PG)" },
];

function calcExciseTax(proofGallons: number, taxClass: string): number {
  if (taxClass === "craft_tier1") return proofGallons * 2.70;
  if (taxClass === "craft_tier2") return proofGallons * 13.34;
  return proofGallons * 13.50;
}

// ---------------------------------------------------------------------------
// Stage Progress Bar
// ---------------------------------------------------------------------------
function StageProgressBar({ current }: { current: Stage }) {
  const currentIdx = STAGES.indexOf(current);
  const isClosed = current === "closed";
  const pct = STAGES.length > 1 ? Math.round((currentIdx / (STAGES.length - 1)) * 100) : 100;

  return (
    <div className="bg-white border-b border-[#e5e5e5]">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
            isClosed ? "bg-[#22c55e] text-white" : "bg-[#0a0a0a] text-white"
          }`}>
            {isClosed ? "✓" : currentIdx + 1}
          </span>
          <div>
            <p className="text-[10px] text-[#737373] font-medium uppercase tracking-wider leading-none mb-0.5">Current Stage</p>
            <p className="text-sm font-bold text-[#0a0a0a] leading-none">{STAGE_LABELS[current]}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-[#737373]">{pct}%</span>
          <p className="text-[10px] text-[#a3a3a3]">Step {currentIdx + 1} / {STAGES.length}</p>
        </div>
      </div>

      {/* Progress track */}
      <div className="px-6 pb-3">
        <div className="h-1.5 bg-[#e5e5e5] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isClosed ? "bg-[#22c55e]" : "bg-[#0a0a0a]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step nodes */}
      <div className="px-4 pb-4">
        <div className="flex justify-between">
          {STAGES.map((stage, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={stage} className="flex flex-col items-center gap-1 min-w-0 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  done ? "bg-[#22c55e] text-white" :
                  active ? "bg-[#0a0a0a] text-white" :
                  "bg-[#e5e5e5] text-[#a3a3a3]"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-[8px] text-center leading-tight px-0.5 max-w-[52px] ${
                  active ? "text-[#0a0a0a] font-bold" :
                  done ? "text-[#22c55e] font-medium" :
                  "text-[#a3a3a3]"
                }`}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TTB Info Box
// ---------------------------------------------------------------------------
function TtbInfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#fffbeb] border border-[#fde68a] rounded-md px-3 py-2 text-xs text-[#92400e]">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculated Field Display
// ---------------------------------------------------------------------------
function CalcField({ label, value, subNote }: { label: string; value: string | null; subNote?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#737373] mb-1">{label}</label>
      <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded p-2 text-sm font-semibold text-[#0369a1]">
        {value ?? "—"}
      </div>
      {subNote && <p className="text-[10px] text-[#a3a3a3] mt-0.5">{subNote}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planning Form
// ---------------------------------------------------------------------------
function PlanningForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch } = data;
  const [form, setForm] = useState({
    batchCode: batch.batchCode ?? "",
    productName: batch.productName ?? "",
    spiritType: batch.spiritType ?? "",
    spiritClass: batch.spiritClass ?? "",
    batchDate: batch.batchDate ?? "",
    notes: batch.notes ?? "",
  });

  function buildPayload() {
    return {
      batchCode: form.batchCode,
      productName: form.productName || null,
      spiritType: form.spiritType || null,
      spiritClass: form.spiritClass || null,
      batchDate: form.batchDate,
      notes: form.notes || null,
    };
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildPayload()),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Planning info saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildPayload()),
      });
      return apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ productName: form.productName }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Advanced to Mash & Fermentation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Batch Code *</label>
          <Input
            value={form.batchCode}
            onChange={(e) => setForm((f) => ({ ...f, batchCode: e.target.value }))}
            placeholder="e.g. RUM-2026-001"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Product Name</label>
          <Input
            value={form.productName}
            onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
            placeholder="e.g. Libertalia Rum"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Spirit Type *</label>
          <Select
            value={form.spiritType}
            onChange={(e) => setForm((f) => ({ ...f, spiritType: e.target.value }))}
          >
            <option value="">— Select spirit type —</option>
            {SPIRIT_TYPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Spirit Class / Type</label>
          <Input
            value={form.spiritClass}
            onChange={(e) => setForm((f) => ({ ...f, spiritClass: e.target.value }))}
            placeholder="e.g. Dark Rum, Bourbon, Rye"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Batch Date *</label>
          <Input
            type="date"
            value={form.batchDate}
            onChange={(e) => setForm((f) => ({ ...f, batchDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
          {advance.isPending ? "Advancing…" : "Advance to Mash & Fermentation →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mash & Fermentation Form
// ---------------------------------------------------------------------------
function MashForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch, productionRecord: pr } = data;
  const [form, setForm] = useState({
    mashDate: pr?.mashDate ?? new Date().toISOString().slice(0, 10),
    mashVolumeWineGallons: "",
    gallonsMolasses: String(pr?.gallonsMolasses ?? ""),
    lbsSugar: String(pr?.lbsSugar ?? ""),
    libertaliaYeastPackets: String(pr?.libertaliaYeastPackets ?? "0"),
    riskeyYeastPackets: String(pr?.riskeyYeastPackets ?? "0"),
    yeastDate: pr?.yeastDate ?? "",
    fermentationStart: "",
    fermentationEnd: "",
    estFinalAbv: "",
    notes: pr?.notes ?? "",
  });

  const savePr = useMutation({
    mutationFn: async () => {
      const body: Partial<InsertDistillingProductionRecord> & Record<string, unknown> = {
        mashDate: form.mashDate,
        gallonsMolasses: parseFloat(form.gallonsMolasses) || 0,
        lbsSugar: parseFloat(form.lbsSugar) || 0,
        libertaliaYeastPackets: parseInt(form.libertaliaYeastPackets) || 0,
        riskeyYeastPackets: parseInt(form.riskeyYeastPackets) || 0,
        yeastDate: form.yeastDate || null,
        notes: form.notes || null,
        batchRecordId: batch.id,
        distillDate: pr?.distillDate || form.mashDate,
        gallonsDistilled: pr?.gallonsDistilled ?? 0,
        percentageDistilled: pr?.percentageDistilled ?? 0,
        proofOfGallons: pr?.proofOfGallons ?? 0,
      };
      let prId = batch.productionRecordId;
      if (prId) {
        await apiRequest(`/api/distilling/production-records/${prId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await apiRequest<{ id: string }>("/api/distilling/production-records", {
          method: "POST",
          body: JSON.stringify(body),
        });
        prId = created.id;
        await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
          method: "PATCH",
          body: JSON.stringify({ productionRecordId: prId }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Mash data saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async () => {
      await savePr.mutateAsync();
      return apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Advanced to Distillation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <TtbInfoBox>
        ℹ️ TTB requires tracking of all raw materials used in production per 27 CFR § 19.582
      </TtbInfoBox>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Mash Date *</label>
          <Input
            type="date"
            value={form.mashDate}
            onChange={(e) => setForm((f) => ({ ...f, mashDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Mash Volume (wine gallons)</label>
          <Input
            type="number"
            step="0.01"
            value={form.mashVolumeWineGallons}
            onChange={(e) => setForm((f) => ({ ...f, mashVolumeWineGallons: e.target.value }))}
            placeholder="Total liquid volume"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Molasses (gallons)</label>
          <Input
            type="number"
            step="0.01"
            value={form.gallonsMolasses}
            onChange={(e) => setForm((f) => ({ ...f, gallonsMolasses: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Cane Sugar (lbs)</label>
          <Input
            type="number"
            step="0.01"
            value={form.lbsSugar}
            onChange={(e) => setForm((f) => ({ ...f, lbsSugar: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Libertalia Yeast Packets</label>
          <Input
            type="number"
            min="0"
            value={form.libertaliaYeastPackets}
            onChange={(e) => setForm((f) => ({ ...f, libertaliaYeastPackets: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Riskey Yeast Packets</label>
          <Input
            type="number"
            min="0"
            value={form.riskeyYeastPackets}
            onChange={(e) => setForm((f) => ({ ...f, riskeyYeastPackets: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Yeast Pitch Date</label>
          <Input
            type="date"
            value={form.yeastDate}
            onChange={(e) => setForm((f) => ({ ...f, yeastDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Fermentation Start</label>
          <Input
            type="date"
            value={form.fermentationStart}
            onChange={(e) => setForm((f) => ({ ...f, fermentationStart: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Fermentation End</label>
          <Input
            type="date"
            value={form.fermentationEnd}
            onChange={(e) => setForm((f) => ({ ...f, fermentationEnd: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Est. Final ABV (%)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.estFinalAbv}
            onChange={(e) => setForm((f) => ({ ...f, estFinalAbv: e.target.value }))}
            placeholder="0–100"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional fermentation notes"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={() => savePr.mutate()} disabled={savePr.isPending}>
          {savePr.isPending ? "Saving…" : "Save"}
        </Button>
        <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
          {advance.isPending ? "Advancing…" : "Advance to Distillation →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distillation Form
// ---------------------------------------------------------------------------
function DistillationForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch, productionRecord: pr } = data;
  const [form, setForm] = useState({
    distillDate: pr?.distillDate ?? new Date().toISOString().slice(0, 10),
    stillType: batch.stillType ?? "",
    wineGallonsProduced: String(pr?.gallonsDistilled ?? ""),
    distillationProof: String(batch.distillationProof ?? ""),
    lowWinesVolume: "",
    heartsVolume: "",
    notes: pr?.notes ?? "",
  });

  const wineGal = parseFloat(form.wineGallonsProduced);
  const proof = parseFloat(form.distillationProof);
  const proofGallons = wineGal && proof ? ((wineGal * proof) / 100).toFixed(2) : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!batch.productionRecordId) throw new Error("Mash record not found — complete mash stage first");
      const pgProduced = proofGallons ? parseFloat(proofGallons) : null;
      await apiRequest(`/api/distilling/production-records/${batch.productionRecordId}`, {
        method: "PATCH",
        body: JSON.stringify({
          distillDate: form.distillDate,
          gallonsDistilled: wineGal || 0,
          percentageDistilled: proof ? proof / 2 : 0,
          proofOfGallons: pgProduced ?? 0,
          notes: form.notes || null,
        }),
      });
      await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          distillationProof: proof || null,
          proofGallonsProduced: pgProduced,
          stillType: form.stillType || null,
          distillDate: form.distillDate || null,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Distillation data saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Advanced to Barreling");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <TtbInfoBox>
        ℹ️ Proof Gallons Produced is reported on TTB Form 5110.40, Part I (Spirits Produced)
      </TtbInfoBox>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Date of Distillation *</label>
          <Input
            type="date"
            value={form.distillDate}
            onChange={(e) => setForm((f) => ({ ...f, distillDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Still Type</label>
          <Select
            value={form.stillType}
            onChange={(e) => setForm((f) => ({ ...f, stillType: e.target.value }))}
          >
            <option value="">— Select still type —</option>
            <option value="pot">Pot Still</option>
            <option value="column">Column Still</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Wine Gallons Produced *</label>
          <Input
            type="number"
            step="0.01"
            value={form.wineGallonsProduced}
            onChange={(e) => setForm((f) => ({ ...f, wineGallonsProduced: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Proof at Distillation *</label>
          <Input
            type="number"
            step="0.1"
            max="190"
            value={form.distillationProof}
            onChange={(e) => setForm((f) => ({ ...f, distillationProof: e.target.value }))}
          />
          <p className="text-[10px] text-[#a3a3a3] mt-0.5">Must be ≤ 190 proof per TTB regulations</p>
        </div>
        <div>
          <CalcField
            label="Proof Gallons Produced"
            value={proofGallons}
            subNote="= wine gallons × proof / 100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Low Wines (wine gallons)</label>
          <Input
            type="number"
            step="0.01"
            value={form.lowWinesVolume}
            onChange={(e) => setForm((f) => ({ ...f, lowWinesVolume: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Hearts / New Make (wine gallons)</label>
          <Input
            type="number"
            step="0.01"
            value={form.heartsVolume}
            onChange={(e) => setForm((f) => ({ ...f, heartsVolume: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
          {advance.isPending ? "Advancing…" : "Advance to Barreling →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barreling Form
// ---------------------------------------------------------------------------
function BarrelingForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch, barrel } = data;
  const [form, setForm] = useState({
    fillNumber: batch.fillNumber ?? "",
    containerType: batch.containerType ?? "",
    serialNumber: barrel?.serialNumber ?? "",
    fillDate: barrel?.fillDate ?? new Date().toISOString().slice(0, 10),
    fillProof: String(batch.fillProof ?? barrel?.fillProof ?? ""),
    fillWineGallons: String(batch.fillWineGallons ?? barrel?.fillVolume ?? ""),
    charLevel: barrel?.charLevel ?? "#2",
    warehouseLocation: "",
    warehouseZone: barrel?.warehouseZone ?? "",
    notes: barrel?.notes ?? "",
  });

  const wg = parseFloat(form.fillWineGallons);
  const fp = parseFloat(form.fillProof);
  const fillProofGallons = wg && fp ? ((wg * fp) / 100).toFixed(2) : null;

  const saveBarrel = useMutation({
    mutationFn: async () => {
      const fpg = fillProofGallons ? parseFloat(fillProofGallons) : null;
      // PATCH batch with TTB fill fields
      await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fillNumber: form.fillNumber || null,
          fillProof: fp || null,
          fillWineGallons: wg || null,
          fillProofGallons: fpg,
          containerType: form.containerType || null,
          fillDate: form.fillDate || null,
        }),
      });
      // Create/update barrel record
      const body = {
        serialNumber: form.serialNumber,
        fillDate: form.fillDate || null,
        fillProof: fp || null,
        fillVolume: wg || null,
        fillProofGallons: fpg,
        warehouseZone: form.warehouseZone || null,
        charLevel: form.charLevel || null,
        notes: form.notes || null,
        status: "Aging",
        originBatchId: batch.id,
        productName: batch.productName || null,
      };
      let barrelId = batch.barrelId as string | null | undefined;
      if (barrelId) {
        await apiRequest(`/api/barrels/${barrelId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await apiRequest<{ id: string }>("/api/barrels", {
          method: "POST",
          body: JSON.stringify(body),
        });
        barrelId = created.id;
        await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
          method: "PATCH",
          body: JSON.stringify({ barrelId }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Barrel saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async () => {
      await saveBarrel.mutateAsync();
      const latestBatch = await apiRequest<{ batch: BatchWithTTB }>(
        `/api/distilling/batch-records/${batch.id}/full`
      );
      return apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ barrelId: latestBatch.batch.barrelId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Advanced to Aging");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <TtbInfoBox>
        ℹ️ Fill Proof Gallons Deposited to Bond is reported on TTB Form 5110.40, Part II (Spirits Deposited)
      </TtbInfoBox>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Fill Number *</label>
          <Input
            value={form.fillNumber}
            onChange={(e) => setForm((f) => ({ ...f, fillNumber: e.target.value }))}
            placeholder="TTB fill number / container ID"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Container Type</label>
          <Select
            value={form.containerType}
            onChange={(e) => setForm((f) => ({ ...f, containerType: e.target.value }))}
          >
            <option value="">— Select container —</option>
            <option value="new_oak_barrel">New Oak Barrel (required for Bourbon)</option>
            <option value="used_barrel">Used Oak Barrel</option>
            <option value="tank">Stainless Tank</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Container Serial Number</label>
          <Input
            value={form.serialNumber}
            onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
            placeholder="e.g. BARREL-001"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Date of Fill *</label>
          <Input
            type="date"
            value={form.fillDate}
            onChange={(e) => setForm((f) => ({ ...f, fillDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Proof at Fill *</label>
          <Input
            type="number"
            step="0.1"
            value={form.fillProof}
            onChange={(e) => setForm((f) => ({ ...f, fillProof: e.target.value }))}
          />
          {(batch.spiritType === "whiskey") && (
            <p className="text-[10px] text-[#a3a3a3] mt-0.5">Bourbon/Rye must enter barrel at ≤ 125 proof (27 CFR § 5.22)</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Wine Gallons Filled *</label>
          <Input
            type="number"
            step="0.01"
            value={form.fillWineGallons}
            onChange={(e) => setForm((f) => ({ ...f, fillWineGallons: e.target.value }))}
          />
        </div>
        <div>
          <CalcField
            label="Proof Gallons Deposited to Bond"
            value={fillProofGallons}
            subNote="= wine gallons × fill proof / 100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Char Level</label>
          <Select
            value={form.charLevel}
            onChange={(e) => setForm((f) => ({ ...f, charLevel: e.target.value }))}
          >
            <option value="#1">#1</option>
            <option value="#2">#2</option>
            <option value="#3">#3</option>
            <option value="#4">#4</option>
            <option value="N/A">N/A</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Warehouse Location</label>
          <Input
            value={form.warehouseLocation}
            onChange={(e) => setForm((f) => ({ ...f, warehouseLocation: e.target.value }))}
            placeholder="e.g. Warehouse A"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Storage Zone / Rack</label>
          <Input
            value={form.warehouseZone}
            onChange={(e) => setForm((f) => ({ ...f, warehouseZone: e.target.value }))}
            placeholder="e.g. Zone A, Rack 3"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional barrel notes"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={() => saveBarrel.mutate()} disabled={saveBarrel.isPending}>
          {saveBarrel.isPending ? "Saving…" : "Save Barrel"}
        </Button>
        <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
          {advance.isPending ? "Advancing…" : "Advance to Aging →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aging Form
// ---------------------------------------------------------------------------
type AgingTab = "gauge" | "temperature" | "dump";

function AgingForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch, barrel } = data;
  const barrelId = batch.barrelId as string | null;
  const [activeTab, setActiveTab] = useState<AgingTab>("gauge");

  const today = new Date().toISOString().slice(0, 10);
  const [targetDumpDate, setTargetDumpDate] = useState((batch as any).targetDumpDate ?? "");
  const [gauge, setGauge] = useState({ gaugeDate: today, currentProof: "", currentWineGallons: "", notes: "" });
  const [tempLog, setTempLog] = useState({ tempDate: today, outdoorTemp: "", notes: "" });
  const [dump, setDump] = useState({ dumpDate: today, amountReceived: "", proofAtDump: "", notes: "" });

  const { data: events = [] } = useQuery<BarrelEvent[]>({
    queryKey: [`/api/barrels/${barrelId}/events`],
    queryFn: () => apiRequest(`/api/barrels/${barrelId}/events`),
    enabled: !!barrelId,
  });

  const fillPg = batch.fillProofGallons ?? (barrel?.fillProofGallons ?? null);
  const fillWg = batch.fillWineGallons ?? barrel?.fillVolume ?? null;
  const fillProof = batch.fillProof ?? barrel?.fillProof ?? null;
  const fillAbv = fillProof ? fillProof / 2 : null;

  // Latest gauge reading
  const latestGauge = events.filter(e => e.eventType === "gauge").at(0);
  const latestWg = latestGauge?.wineGallons ?? fillWg;
  const latestPrf = latestGauge?.proofAtEvent ?? fillProof;
  const latestPg = latestWg && latestPrf ? (latestWg * latestPrf / 100) : null;
  const currentAbv = latestPrf ? latestPrf / 2 : null;
  const angelSharePg = fillPg != null && latestPg != null ? fillPg - latestPg : null;

  // Gauge calcs
  const gWg = parseFloat(gauge.currentWineGallons);
  const gPrf = parseFloat(gauge.currentProof);
  const gPg = gWg && gPrf ? (gWg * gPrf / 100).toFixed(2) : null;
  const gAngel = fillPg != null && gPg ? (fillPg - parseFloat(gPg)).toFixed(2) : null;

  // Expected remaining days
  const daysRemaining = targetDumpDate
    ? Math.ceil((new Date(targetDumpDate).getTime() - Date.now()) / 86400000)
    : null;

  const saveTargetDate = useMutation({
    mutationFn: () => apiRequest(`/api/distilling/batch-records/${batch.id}`, {
      method: "PATCH",
      body: JSON.stringify({ targetDumpDate: targetDumpDate || null }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] }); toast.success("Target date saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const logGauge = useMutation({
    mutationFn: () => apiRequest(`/api/barrels/${barrelId}/events`, {
      method: "POST",
      body: JSON.stringify({ eventType: "gauge", eventAt: gauge.gaugeDate, volumeChange: 0, proofAtEvent: gPrf || null, wineGallons: gWg || null, notes: gauge.notes || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/barrels/${barrelId}/events`] });
      setGauge({ gaugeDate: today, currentProof: "", currentWineGallons: "", notes: "" });
      toast.success("Gauge reading logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logTemp = useMutation({
    mutationFn: () => apiRequest(`/api/barrels/${barrelId}/events`, {
      method: "POST",
      body: JSON.stringify({ eventType: "temperature", eventAt: tempLog.tempDate, volumeChange: 0, outdoorTemp: parseFloat(tempLog.outdoorTemp) || null, notes: tempLog.notes || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/barrels/${barrelId}/events`] });
      setTempLog({ tempDate: today, outdoorTemp: "", notes: "" });
      toast.success("Temperature logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logDump = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/barrels/${barrelId}/events`, {
        method: "POST",
        body: JSON.stringify({ eventType: "dump", eventAt: dump.dumpDate, volumeChange: -(parseFloat(dump.amountReceived) || 0), proofAtEvent: parseFloat(dump.proofAtDump) || null, wineGallons: parseFloat(dump.amountReceived) || null, notes: dump.notes || null }),
      });
      await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amountReceivedGallons: parseFloat(dump.amountReceived) || null }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/barrels/${barrelId}/events`] });
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      setDump({ dumpDate: today, amountReceived: "", proofAtDump: "", notes: "" });
      toast.success("Dump recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: () => apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] }); toast.success("Advanced to Bottling"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const gaugeEvents = events.filter(e => e.eventType === "gauge");
  const tempEvents = events.filter(e => e.eventType === "temperature");
  const dumpEvents = events.filter(e => e.eventType === "dump");

  const TABS: { key: AgingTab; label: string }[] = [
    { key: "gauge", label: "Gauge Readings" },
    { key: "temperature", label: "Outdoor Temperature" },
    { key: "dump", label: "Dump Day" },
  ];

  return (
    <div className="space-y-5">
      <TtbInfoBox>
        ℹ️ Gauge records support TTB bonded storage balance calculations (Form 5110.40, Part III)
      </TtbInfoBox>

      {/* Aging Summary */}
      <div className="bg-[#f7f7f7] rounded-xl border border-[#e5e5e5] p-4">
        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Aging Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-[#737373]">Product</p>
            <p className="text-sm font-semibold text-[#0a0a0a]">{batch.productName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Barrel</p>
            <p className="text-sm font-mono font-medium">{barrel?.serialNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Amount Aging</p>
            <p className="text-sm font-semibold">{fmtNum(latestWg)} <span className="text-xs text-[#737373]">wine gal</span></p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Current ABV%</p>
            <p className="text-sm font-semibold">{currentAbv ? `${currentAbv.toFixed(1)}%` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Fill Date</p>
            <p className="text-sm font-medium">{fmt(barrel?.fillDate ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Entry Proof Gallons</p>
            <p className="text-sm font-medium">{fmtNum(fillPg)} PG</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Current Proof Gallons</p>
            <p className="text-sm font-semibold text-[#0369a1]">{latestPg ? latestPg.toFixed(2) : "—"} PG</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Angel's Share</p>
            <p className="text-sm font-semibold text-[#c9933a]">{angelSharePg ? angelSharePg.toFixed(2) : "—"} PG</p>
          </div>
        </div>
        {/* Target dump date */}
        <div className="border-t border-[#e5e5e5] pt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#737373] mb-1">Expected Aging Completion (Target Dump Date)</label>
            <Input type="date" value={targetDumpDate} onChange={(e) => setTargetDumpDate(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={() => saveTargetDate.mutate()} disabled={saveTargetDate.isPending}>
            Save
          </Button>
          {daysRemaining !== null && (
            <div className="text-right">
              <p className="text-xs text-[#737373]">Days remaining</p>
              <p className={`text-lg font-bold ${daysRemaining < 0 ? "text-red-600" : daysRemaining < 30 ? "text-[#c9933a]" : "text-[#0a0a0a]"}`}>
                {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e5e5e5]">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-transparent text-[#737373] hover:text-[#0a0a0a]"}`}>
            {t.label}
            {t.key === "temperature" && tempEvents.length > 0 && <span className="ml-1 text-[10px] bg-[#f0f0f0] rounded-full px-1">{tempEvents.length}</span>}
            {t.key === "gauge" && gaugeEvents.length > 0 && <span className="ml-1 text-[10px] bg-[#f0f0f0] rounded-full px-1">{gaugeEvents.length}</span>}
            {t.key === "dump" && dumpEvents.length > 0 && <span className="ml-1 text-[10px] bg-green-100 text-green-700 rounded-full px-1">✓</span>}
          </button>
        ))}
      </div>

      {/* Gauge Tab */}
      {activeTab === "gauge" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Gauge Date</label>
              <Input type="date" value={gauge.gaugeDate} onChange={(e) => setGauge(g => ({ ...g, gaugeDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Current Proof (°)</label>
              <Input type="number" step="0.1" value={gauge.currentProof} onChange={(e) => setGauge(g => ({ ...g, currentProof: e.target.value }))} placeholder="e.g. 118.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Current Wine Gallons</label>
              <Input type="number" step="0.01" value={gauge.currentWineGallons} onChange={(e) => setGauge(g => ({ ...g, currentWineGallons: e.target.value }))} placeholder="e.g. 50.2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Current ABV%</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] text-sm text-[#737373]">
                {gPrf ? `${(gPrf / 2).toFixed(1)}%` : "—"}
              </div>
            </div>
            {gPg && <div><CalcField label="Current Proof Gallons" value={gPg} subNote="wine gal × proof / 100" /></div>}
            {gAngel && <div><CalcField label="Δ Angel's Share (PG lost)" value={gAngel} subNote="fill PG − current PG" /></div>}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
              <Input value={gauge.notes} onChange={(e) => setGauge(g => ({ ...g, notes: e.target.value }))} placeholder="Observation notes…" />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => logGauge.mutate()} disabled={logGauge.isPending || !barrelId || !gauge.currentProof}>
            {logGauge.isPending ? "Logging…" : "Log Gauge Reading"}
          </Button>

          {gaugeEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#0a0a0a] mb-2">Gauge History</p>
              <div className="overflow-hidden rounded-lg border border-[#e5e5e5]">
                <table className="w-full text-xs">
                  <thead className="bg-[#f7f7f7]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Date</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Proof °</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">ABV%</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Wine Gal</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Proof Gal</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaugeEvents.map((ev, i) => {
                      const pg = ev.wineGallons && ev.proofAtEvent ? (ev.wineGallons * ev.proofAtEvent / 100).toFixed(2) : "—";
                      return (
                        <tr key={ev.id} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                          <td className="px-3 py-2 font-medium">{fmt(ev.eventAt)}</td>
                          <td className="px-3 py-2">{fmtNum(ev.proofAtEvent)}</td>
                          <td className="px-3 py-2">{ev.proofAtEvent ? `${(ev.proofAtEvent / 2).toFixed(1)}%` : "—"}</td>
                          <td className="px-3 py-2">{fmtNum(ev.wineGallons)}</td>
                          <td className="px-3 py-2 font-semibold text-[#0369a1]">{pg}</td>
                          <td className="px-3 py-2 text-[#737373] truncate max-w-[120px]">{ev.notes ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temperature Tab */}
      {activeTab === "temperature" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Date</label>
              <Input type="date" value={tempLog.tempDate} onChange={(e) => setTempLog(t => ({ ...t, tempDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Outdoor Temperature (°F)</label>
              <Input type="number" step="0.1" value={tempLog.outdoorTemp} onChange={(e) => setTempLog(t => ({ ...t, outdoorTemp: e.target.value }))} placeholder="e.g. 82.5" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
              <Input value={tempLog.notes} onChange={(e) => setTempLog(t => ({ ...t, notes: e.target.value }))} placeholder="Weather conditions, humidity…" />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => logTemp.mutate()} disabled={logTemp.isPending || !barrelId || !tempLog.outdoorTemp}>
            {logTemp.isPending ? "Logging…" : "Log Temperature"}
          </Button>

          {tempEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#0a0a0a] mb-2">Temperature Log</p>
              <div className="overflow-hidden rounded-lg border border-[#e5e5e5]">
                <table className="w-full text-xs">
                  <thead className="bg-[#f7f7f7]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Date</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Temp °F</th>
                      <th className="text-left px-3 py-2 text-[#737373] font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempEvents.map((ev, i) => (
                      <tr key={ev.id} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                        <td className="px-3 py-2 font-medium">{fmt(ev.eventAt)}</td>
                        <td className="px-3 py-2 font-semibold">{ev.outdoorTemp != null ? `${ev.outdoorTemp}°F` : "—"}</td>
                        <td className="px-3 py-2 text-[#737373]">{ev.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dump Day Tab */}
      {activeTab === "dump" && (
        <div className="space-y-4">
          {dumpEvents.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-xs text-green-800">
              ✓ Dump recorded on {fmt(dumpEvents[0].eventAt)} — {fmtNum(dumpEvents[0].wineGallons)} gal received at {fmtNum(dumpEvents[0].proofAtEvent)}° proof
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Dump Date</label>
              <Input type="date" value={dump.dumpDate} onChange={(e) => setDump(d => ({ ...d, dumpDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Amount Received (wine gal)</label>
              <Input type="number" step="0.01" value={dump.amountReceived} onChange={(e) => setDump(d => ({ ...d, amountReceived: e.target.value }))} placeholder="e.g. 47.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Proof at Dump (°)</label>
              <Input type="number" step="0.1" value={dump.proofAtDump} onChange={(e) => setDump(d => ({ ...d, proofAtDump: e.target.value }))} placeholder="e.g. 115.0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">ABV% at Dump</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] text-sm text-[#737373]">
                {dump.proofAtDump ? `${(parseFloat(dump.proofAtDump) / 2).toFixed(1)}%` : "—"}
              </div>
            </div>
            {fillWg && dump.amountReceived && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-[#92400e] mb-1">Product Lost (Delta)</p>
                <div className="flex gap-6 text-xs text-[#92400e]">
                  <span>Filled: {fmtNum(fillWg)} gal</span>
                  <span>Received: {dump.amountReceived} gal</span>
                  <span className="font-bold">Lost: {(fillWg - parseFloat(dump.amountReceived)).toFixed(2)} gal ({(((fillWg - parseFloat(dump.amountReceived)) / fillWg) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
              <Input value={dump.notes} onChange={(e) => setDump(d => ({ ...d, notes: e.target.value }))} placeholder="Barrel condition, color, aroma notes…" />
            </div>
          </div>
          <Button size="sm" onClick={() => logDump.mutate()} disabled={logDump.isPending || !barrelId || !dump.amountReceived}>
            {logDump.isPending ? "Recording…" : "Record Dump"}
          </Button>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-[#e5e5e5]">
        <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
          {advance.isPending ? "Advancing…" : "Advance to Bottling →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottling Form
// ---------------------------------------------------------------------------
const BOTTLE_SIZES = [
  { key: "750", label: "750 mL", galPerCase: 1.19, bottlesPerCase: 6 },
  { key: "1000", label: "1 L", galPerCase: 1.585, bottlesPerCase: 6 },
  { key: "1750", label: "1.75 L", galPerCase: 2.774, bottlesPerCase: 6 },
] as const;

type SizeKey = typeof BOTTLE_SIZES[number]["key"];

interface SizeState {
  casesBottled: string;
  casesCased: string;
  emptyBottles: string;
  toDistributor: string;
  toRetail: string;
}

function makeSizeDefaults(): Record<SizeKey, SizeState> {
  return {
    "750":  { casesBottled: "", casesCased: "", emptyBottles: "", toDistributor: "", toRetail: "" },
    "1000": { casesBottled: "", casesCased: "", emptyBottles: "", toDistributor: "", toRetail: "" },
    "1750": { casesBottled: "", casesCased: "", emptyBottles: "", toDistributor: "", toRetail: "" },
  };
}

function toIsoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function BottlingForm({ data }: { data: BatchFull }) {
  const qc = useQueryClient();
  const { batch, inventoryRecord: inv } = data;

  const [form, setForm] = useState({
    bottlingDate: batch.bottlingDate ?? new Date().toISOString().slice(0, 10),
    lotNumber: batch.lotNumber ?? "",
    bottlingProof: String(batch.bottlingProof ?? ""),
    taxClass: batch.taxClass ?? "craft_tier1",
  });

  const [sizes, setSizes] = useState<Record<SizeKey, SizeState>>(() => {
    const d = makeSizeDefaults();
    // Restore cases bottled from batch record
    if (batch.cases750ml) d["750"].casesBottled = String(batch.cases750ml);
    if (batch.cases1000ml) d["1000"].casesBottled = String(batch.cases1000ml);
    if (batch.cases1750ml) d["1750"].casesBottled = String(batch.cases1750ml);
    // Restore distribution + casing data from inventory record
    if (inv) {
      const cm = inv.casesMade ?? {};
      const cd = inv.casesToDistributors ?? {};
      const cr = inv.casesToRetail ?? {};
      const bm = inv.bottlesMade ?? {};
      if (cm["750ml"] != null) d["750"].casesBottled = String(cm["750ml"]);
      if (cm["1000ml"] != null) d["1000"].casesBottled = String(cm["1000ml"]);
      if (cm["1750ml"] != null) d["1750"].casesBottled = String(cm["1750ml"]);
      if (bm["750ml"] != null) d["750"].emptyBottles = String(Math.max(0, (cm["750ml"] ?? 0) * 6 - (bm["750ml"] ?? 0)));
      if (bm["1000ml"] != null) d["1000"].emptyBottles = String(Math.max(0, (cm["1000ml"] ?? 0) * 6 - (bm["1000ml"] ?? 0)));
      if (bm["1750ml"] != null) d["1750"].emptyBottles = String(Math.max(0, (cm["1750ml"] ?? 0) * 6 - (bm["1750ml"] ?? 0)));
      if (cd["750ml"] != null) d["750"].toDistributor = String(cd["750ml"]);
      if (cd["1000ml"] != null) d["1000"].toDistributor = String(cd["1000ml"]);
      if (cd["1750ml"] != null) d["1750"].toDistributor = String(cd["1750ml"]);
      if (cr["750ml"] != null) d["750"].toRetail = String(cr["750ml"]);
      if (cr["1000ml"] != null) d["1000"].toRetail = String(cr["1000ml"]);
      if (cr["1750ml"] != null) d["1750"].toRetail = String(cr["1750ml"]);
      // Restore cases cased (split total proportionally if only total stored)
      if (inv.cases_cased) {
        const total = (cm["750ml"] ?? 0) + (cm["1000ml"] ?? 0) + (cm["1750ml"] ?? 0);
        if (total > 0) {
          d["750"].casesCased = String(Math.round(inv.cases_cased * (cm["750ml"] ?? 0) / total));
          d["1000"].casesCased = String(Math.round(inv.cases_cased * (cm["1000ml"] ?? 0) / total));
          d["1750"].casesCased = String(Math.round(inv.cases_cased * (cm["1750ml"] ?? 0) / total));
        }
      }
    }
    return d;
  });

  const updateSize = (key: SizeKey, field: keyof SizeState, val: string) =>
    setSizes(s => ({ ...s, [key]: { ...s[key], [field]: val } }));

  const bottlingProof = parseFloat(form.bottlingProof) || 0;
  const abv = bottlingProof / 2;

  const sizeCalcs = BOTTLE_SIZES.map(sz => {
    const s = sizes[sz.key];
    const casesBottled = parseInt(s.casesBottled) || 0;
    const casesCased = parseInt(s.casesCased) || 0;
    const emptyBottles = parseInt(s.emptyBottles) || 0;
    const toDistributor = parseInt(s.toDistributor) || 0;
    const toRetail = parseInt(s.toRetail) || 0;
    const bottlesMade = Math.max(0, casesBottled * sz.bottlesPerCase - emptyBottles);
    const wgBottled = casesBottled * sz.galPerCase;
    const pgBottled = bottlingProof ? wgBottled * bottlingProof / 100 : 0;
    const distPg = toDistributor * sz.galPerCase * abv * 2 / 100;
    const retailPg = toRetail * sz.galPerCase * abv * 2 / 100;
    const endingCases = casesCased - toDistributor - toRetail;
    const endingWg = Math.max(endingCases, 0) * sz.galPerCase;
    const endingPg = bottlingProof ? endingWg * bottlingProof / 100 : 0;
    return { ...sz, casesBottled, casesCased, emptyBottles, toDistributor, toRetail, bottlesMade, wgBottled, pgBottled, distPg, retailPg, endingCases, endingWg, endingPg };
  });

  const totals = {
    casesBottled: sizeCalcs.reduce((a, s) => a + s.casesBottled, 0),
    casesCased: sizeCalcs.reduce((a, s) => a + s.casesCased, 0),
    emptyBottles: sizeCalcs.reduce((a, s) => a + s.emptyBottles, 0),
    toDistributor: sizeCalcs.reduce((a, s) => a + s.toDistributor, 0),
    toRetail: sizeCalcs.reduce((a, s) => a + s.toRetail, 0),
    wgBottled: sizeCalcs.reduce((a, s) => a + s.wgBottled, 0),
    pgBottled: sizeCalcs.reduce((a, s) => a + s.pgBottled, 0),
    distPg: sizeCalcs.reduce((a, s) => a + s.distPg, 0),
    retailPg: sizeCalcs.reduce((a, s) => a + s.retailPg, 0),
    endingCases: sizeCalcs.reduce((a, s) => a + s.endingCases, 0),
    endingWg: sizeCalcs.reduce((a, s) => a + s.endingWg, 0),
    endingPg: sizeCalcs.reduce((a, s) => a + s.endingPg, 0),
  };

  const taxablePG = totals.distPg + totals.retailPg;
  const taxOwed = taxablePG > 0 ? calcExciseTax(taxablePG, form.taxClass) : 0;
  const taxRate = form.taxClass === "craft_tier1" ? 2.70 : form.taxClass === "craft_tier2" ? 13.34 : 13.50;

  const amountReceived = batch.amountReceivedGallons;
  const wgLost = amountReceived != null ? amountReceived - totals.wgBottled : null;
  const pctLost = wgLost != null && amountReceived ? (wgLost / amountReceived * 100) : null;

  const save = useMutation({
    mutationFn: async () => {
      const pgProcessed = bottlingProof ? totals.wgBottled * bottlingProof / 100 : null;
      await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          bottlingDate: form.bottlingDate || null,
          bottlingProof: bottlingProof || null,
          wineGallonsBottled: totals.wgBottled || null,
          proofGallonsProcessed: pgProcessed,
          cases750ml: sizeCalcs[0].casesBottled || null,
          cases1000ml: sizeCalcs[1].casesBottled || null,
          cases1750ml: sizeCalcs[2].casesBottled || null,
          totalCases: totals.casesBottled || null,
          lotNumber: form.lotNumber || null,
          exciseTaxDue: taxOwed || null,
          taxClass: form.taxClass || null,
        }),
      });

      const invBody = {
        reportWeek: toIsoWeek(form.bottlingDate || new Date().toISOString().slice(0, 10)),
        batchRecordId: batch.id,
        linkedBarrelId: batch.barrelId || null,
        productName: batch.productName || null,
        beginningOfWeekCases: 0,
        currentWeekInventory: totals.casesBottled,
        endingWeekInventory: totals.endingCases,
        endingUsGallons: totals.endingWg,
        endingProofGallons: totals.endingPg,
        casesMade: {
          total: totals.casesBottled,
          "750ml": sizeCalcs[0].casesBottled,
          "1000ml": sizeCalcs[1].casesBottled,
          "1750ml": sizeCalcs[2].casesBottled,
        },
        casesToDistributors: {
          "750ml": sizeCalcs[0].toDistributor,
          "1000ml": sizeCalcs[1].toDistributor,
          "1750ml": sizeCalcs[2].toDistributor,
        },
        casesToRetail: {
          "750ml": sizeCalcs[0].toRetail,
          "1000ml": sizeCalcs[1].toRetail,
          "1750ml": sizeCalcs[2].toRetail,
        },
        bottlesMade: {
          "750ml": Math.max(0, sizeCalcs[0].bottlesMade),
          "1000ml": Math.max(0, sizeCalcs[1].bottlesMade),
          "1750ml": Math.max(0, sizeCalcs[2].bottlesMade),
        },
        cases_cased: totals.casesCased,
        bottles_empty: totals.emptyBottles,
        amount_received_gallons: amountReceived ?? null,
        amount_lost_gallons: wgLost ?? null,
        taxes_owed: taxOwed,
      };

      let invId = batch.inventoryRecordId;
      if (invId) {
        await apiRequest(`/api/distilling/inventory-records/${invId}`, {
          method: "PATCH",
          body: JSON.stringify(invBody),
        });
      } else {
        const created = await apiRequest<{ id: string }>("/api/distilling/inventory-records", {
          method: "POST",
          body: JSON.stringify(invBody),
        });
        invId = created.id;
        await apiRequest(`/api/distilling/batch-records/${batch.id}`, {
          method: "PATCH",
          body: JSON.stringify({ inventoryRecordId: invId }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/distilling/batch-records/${batch.id}/full`] });
      toast.success("Bottling data saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [, navigate] = useLocation();

  const advance = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      const latestBatch = await apiRequest<{ batch: BatchWithTTB & { inventoryRecordId?: string } }>(
        `/api/distilling/batch-records/${batch.id}/full`
      );
      return apiRequest(`/api/distilling/batch-records/${batch.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ inventoryRecordId: latestBatch.batch.inventoryRecordId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      toast.success("Batch closed — production complete!");
      navigate("/barrels");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <TtbInfoBox>
        ℹ️ Proof Gallons Processed reported on TTB Form 5110.40, Part IV. Excise Tax (per proof gallon removed from bond) reported on Form 5000.24.
      </TtbInfoBox>

      {/* Spirit Received from Dump */}
      {amountReceived != null && (
        <div className="rounded-lg border border-[#e5e5e5] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Spirit Received from Dump</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#737373]">Received (wine gal)</p>
              <p className="font-semibold text-[#0a0a0a]">{amountReceived.toFixed(2)} gal</p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">Bottled (wine gal)</p>
              <p className="font-semibold text-[#0369a1]">{totals.wgBottled.toFixed(2)} gal</p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">Lost (delta)</p>
              <p className={`font-semibold ${wgLost != null && wgLost > 0 ? "text-amber-600" : "text-[#0a0a0a]"}`}>
                {wgLost != null ? `${wgLost.toFixed(2)} gal (${pctLost?.toFixed(1)}% loss)` : "—"}
              </p>
            </div>
          </div>
          {wgLost != null && wgLost > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
              Loss delta: {wgLost.toFixed(2)} gal ({pctLost?.toFixed(1)}% of received). Normal bottling loss is typically 0.5–2%.
            </div>
          )}
        </div>
      )}

      {/* Bottling Details */}
      <div className="rounded-lg border border-[#e5e5e5] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Bottling Details</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Date of Bottling *</label>
            <Input type="date" value={form.bottlingDate} onChange={(e) => setForm(f => ({ ...f, bottlingDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Lot Number *</label>
            <Input value={form.lotNumber} onChange={(e) => setForm(f => ({ ...f, lotNumber: e.target.value }))} placeholder="For label compliance" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Proof at Bottling *</label>
            <Input type="number" step="0.1" value={form.bottlingProof} onChange={(e) => setForm(f => ({ ...f, bottlingProof: e.target.value }))} placeholder="e.g. 90.0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">ABV%</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] text-sm text-[#737373]">
              {bottlingProof ? `${abv.toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Report Week</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] text-sm text-[#737373]">
              {form.bottlingDate ? toIsoWeek(form.bottlingDate) : "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Tax Class *</label>
            <Select
              value={form.taxClass}
              onChange={(e) => setForm(f => ({ ...f, taxClass: e.target.value }))}
            >
              {TAX_CLASSES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Cases of 6 Breakdown */}
      <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
        <div className="bg-[#f7f7f7] px-4 py-2 border-b border-[#e5e5e5]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Cases of 6 — Production Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#fafafa] border-b border-[#e5e5e5]">
              <tr>
                <th className="text-left px-3 py-2 text-[#737373] font-medium w-24">Size</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Empty Bottles</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Cases Bottled</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Bottles Made</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Cases Cased</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Wine Gal</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Proof Gal</th>
              </tr>
            </thead>
            <tbody>
              {BOTTLE_SIZES.map((sz, i) => {
                const sc = sizeCalcs[i];
                const s = sizes[sz.key];
                return (
                  <tr key={sz.key} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                    <td className="px-3 py-2 font-medium text-[#0a0a0a]">{sz.label}</td>
                    <td className="px-2 py-1">
                      <Input type="number" min="0" value={s.emptyBottles}
                        onChange={(e) => updateSize(sz.key, "emptyBottles", e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" min="0" value={s.casesBottled}
                        onChange={(e) => updateSize(sz.key, "casesBottled", e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-[#0369a1]">{sc.bottlesMade > 0 ? sc.bottlesMade : "—"}</td>
                    <td className="px-2 py-1">
                      <Input type="number" min="0" value={s.casesCased}
                        onChange={(e) => updateSize(sz.key, "casesCased", e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center text-[#737373]">{sc.wgBottled > 0 ? sc.wgBottled.toFixed(2) : "—"}</td>
                    <td className="px-2 py-2 text-center font-semibold text-[#0369a1]">{sc.pgBottled > 0 ? sc.pgBottled.toFixed(3) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#f0f0f0] font-semibold border-t border-[#e5e5e5]">
                <td className="px-3 py-2">Totals</td>
                <td className="px-2 py-2 text-center">{totals.emptyBottles || "—"}</td>
                <td className="px-2 py-2 text-center">{totals.casesBottled || "—"}</td>
                <td className="px-2 py-2 text-center text-[#0369a1]">{totals.casesBottled * 6 - totals.emptyBottles || "—"}</td>
                <td className="px-2 py-2 text-center">{totals.casesCased || "—"}</td>
                <td className="px-2 py-2 text-center">{totals.wgBottled > 0 ? totals.wgBottled.toFixed(2) : "—"}</td>
                <td className="px-2 py-2 text-center text-[#0369a1]">{totals.pgBottled > 0 ? totals.pgBottled.toFixed(3) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution */}
      <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
        <div className="bg-[#f7f7f7] px-4 py-2 border-b border-[#e5e5e5]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Distribution (Cases of 6)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#fafafa] border-b border-[#e5e5e5]">
              <tr>
                <th className="text-left px-3 py-2 text-[#737373] font-medium w-24">Size</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">To Distributor</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Dist PG</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">To Retail</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Retail PG</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Ending Cases</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Ending WG</th>
                <th className="text-center px-2 py-2 text-[#737373] font-medium">Ending PG</th>
              </tr>
            </thead>
            <tbody>
              {BOTTLE_SIZES.map((sz, i) => {
                const sc = sizeCalcs[i];
                const s = sizes[sz.key];
                return (
                  <tr key={sz.key} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                    <td className="px-3 py-2 font-medium text-[#0a0a0a]">{sz.label}</td>
                    <td className="px-2 py-1">
                      <Input type="number" min="0" value={s.toDistributor}
                        onChange={(e) => updateSize(sz.key, "toDistributor", e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center text-[#0369a1] font-medium">{sc.distPg > 0 ? sc.distPg.toFixed(3) : "—"}</td>
                    <td className="px-2 py-1">
                      <Input type="number" min="0" value={s.toRetail}
                        onChange={(e) => updateSize(sz.key, "toRetail", e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto" />
                    </td>
                    <td className="px-2 py-2 text-center text-[#0369a1] font-medium">{sc.retailPg > 0 ? sc.retailPg.toFixed(3) : "—"}</td>
                    <td className="px-2 py-2 text-center font-semibold">{sc.endingCases >= 0 ? sc.endingCases : <span className="text-red-500">{sc.endingCases}</span>}</td>
                    <td className="px-2 py-2 text-center text-[#737373]">{sc.endingWg > 0 ? sc.endingWg.toFixed(2) : "—"}</td>
                    <td className="px-2 py-2 text-center font-semibold text-[#0369a1]">{sc.endingPg > 0 ? sc.endingPg.toFixed(3) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#f0f0f0] font-semibold border-t border-[#e5e5e5]">
                <td className="px-3 py-2">Totals</td>
                <td className="px-2 py-2 text-center">{totals.toDistributor || "—"}</td>
                <td className="px-2 py-2 text-center text-[#0369a1]">{totals.distPg > 0 ? totals.distPg.toFixed(3) : "—"}</td>
                <td className="px-2 py-2 text-center">{totals.toRetail || "—"}</td>
                <td className="px-2 py-2 text-center text-[#0369a1]">{totals.retailPg > 0 ? totals.retailPg.toFixed(3) : "—"}</td>
                <td className="px-2 py-2 text-center">{totals.endingCases}</td>
                <td className="px-2 py-2 text-center">{totals.endingWg > 0 ? totals.endingWg.toFixed(2) : "—"}</td>
                <td className="px-2 py-2 text-center text-[#0369a1]">{totals.endingPg > 0 ? totals.endingPg.toFixed(3) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[10px] text-[#737373] border-t border-[#e5e5e5]">
          PG formula: cases × gal/case × ABV% × 2 / 100 (D×1.19×E×2/100 for 750 mL)
        </div>
      </div>

      {/* Ending Inventory + Tax Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#e5e5e5] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Ending Inventory</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#737373] text-xs">Ending Cases</span>
              <span className="font-semibold">{totals.endingCases}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#737373] text-xs">Ending US Gallons</span>
              <span className="font-semibold">{totals.endingWg.toFixed(2)} gal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#737373] text-xs">Ending Proof Gallons</span>
              <span className="font-semibold text-[#0369a1]">{totals.endingPg.toFixed(3)} PG</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-[#0369a1]/20 bg-[#f0f9ff] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0369a1]">Excise Tax Summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#0369a1] text-xs">Tax Class</span>
              <span className="font-medium text-[#0369a1] text-xs">{TAX_CLASSES.find(t => t.value === form.taxClass)?.label ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#0369a1] text-xs">Taxable PG (Dist + Retail)</span>
              <span className="font-semibold text-[#0369a1]">{taxablePG.toFixed(3)} PG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#0369a1] text-xs">Rate</span>
              <span className="font-semibold text-[#0369a1]">${taxRate.toFixed(2)}/PG</span>
            </div>
            <div className="flex justify-between border-t border-[#0369a1]/20 pt-1 mt-1">
              <span className="text-[#0369a1] text-xs font-semibold">Excise Tax Due</span>
              <span className="text-lg font-bold text-[#0369a1]">
                ${taxOwed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#e5e5e5]">
        <Button onClick={() => advance.mutate()} disabled={advance.isPending || !form.bottlingProof}>
          {advance.isPending ? "Closing…" : "Close Batch →"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Closed Summary
// ---------------------------------------------------------------------------
function ClosedSummary({ data }: { data: BatchFull }) {
  const { batch, productionRecord: pr } = data;
  return (
    <div className="space-y-4">
      <div className="bg-[#22c55e]/8 border border-[#22c55e]/20 rounded-lg p-4">
        <p className="text-sm font-semibold text-[#15803d] mb-1">Batch Complete</p>
        <p className="text-xs text-[#737373]">This batch has been closed. All stages are complete.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-2">Batch Overview</p>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-[#737373]">Batch Code</p><p className="text-sm font-medium font-mono">{batch.batchCode}</p></div>
          <div><p className="text-xs text-[#737373]">Product</p><p className="text-sm font-medium">{batch.productName ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">Spirit Type</p><p className="text-sm font-medium capitalize">{batch.spiritType ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">Spirit Class</p><p className="text-sm font-medium">{batch.spiritClass ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">Batch Date</p><p className="text-sm font-medium">{fmt(batch.batchDate)}</p></div>
          {pr && <div><p className="text-xs text-[#737373]">Distill Date</p><p className="text-sm font-medium">{fmt(pr.distillDate)}</p></div>}
          {batch.bottlingDate && <div><p className="text-xs text-[#737373]">Bottling Date</p><p className="text-sm font-medium">{fmt(batch.bottlingDate)}</p></div>}
        </div>
      </div>

      <div className="border-t border-[#e5e5e5] pt-3">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-2">TTB Production Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#737373]">Proof Gallons Produced</p>
            <p className="text-sm font-semibold text-[#0369a1]">{fmtNum(batch.proofGallonsProduced)} PG</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Fill Proof Gallons Deposited</p>
            <p className="text-sm font-semibold text-[#0369a1]">{fmtNum(batch.fillProofGallons)} PG</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Proof Gallons Processed</p>
            <p className="text-sm font-semibold text-[#0369a1]">{fmtNum(batch.proofGallonsProcessed)} PG</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Lot Number</p>
            <p className="text-sm font-medium font-mono">{batch.lotNumber ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e5e5e5] pt-3">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-2">Tax Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#737373]">Tax Class</p>
            <p className="text-sm font-medium">{
              batch.taxClass
                ? ({ craft_tier1: "Craft Tier 1 ($2.70/PG)", craft_tier2: "Craft Tier 2 ($13.34/PG)", standard: "Standard ($13.50/PG)" }[batch.taxClass] ?? batch.taxClass)
                : "—"
            }</p>
          </div>
          <div>
            <p className="text-xs text-[#737373]">Excise Tax Due</p>
            <p className="text-sm font-semibold text-[#0369a1]">
              {batch.exciseTaxDue != null
                ? `$${batch.exciseTaxDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e5e5e5] pt-3">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-2">Cases Produced</p>
        <div className="grid grid-cols-4 gap-3">
          <div><p className="text-xs text-[#737373]">750 mL</p><p className="text-sm font-medium">{batch.cases750ml ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">1 L</p><p className="text-sm font-medium">{batch.cases1000ml ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">1.75 L</p><p className="text-sm font-medium">{batch.cases1750ml ?? "—"}</p></div>
          <div><p className="text-xs text-[#737373]">Total</p><p className="text-sm font-semibold">{batch.totalCases ?? "—"}</p></div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function BatchDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = params.id;

  const { data, isLoading, error } = useQuery<BatchFull>({
    queryKey: [`/api/distilling/batch-records/${id}/full`],
    queryFn: () => apiRequest(`/api/distilling/batch-records/${id}/full`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-sm text-[#737373]">Loading…</div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-sm text-red-500">
          Failed to load batch.
        </div>
      </Layout>
    );
  }

  const { batch } = data;
  const currentStage = batch.stage as Stage;

  const renderCurrentForm = () => {
    switch (currentStage) {
      case "planning": return <PlanningForm data={data} />;
      case "mash_fermentation": return <MashForm data={data} />;
      case "distillation": return <DistillationForm data={data} />;
      case "barreling": return <BarrelingForm data={data} />;
      case "aging": return <AgingForm data={data} />;
      case "bottling": return <BottlingForm data={data} />;
      case "closed": return <ClosedSummary data={data} />;
      default: return null;
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-[#e5e5e5]">
        <button
          onClick={() => navigate("/production")}
          className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors flex items-center gap-1"
        >
          ← Back to Production
        </button>
        <span className="text-[#e5e5e5]">|</span>
        <h1 className="text-sm font-semibold text-[#0a0a0a]">
          {batch.batchCode}
          {batch.productName ? ` · ${batch.productName}` : ""}
        </h1>
      </div>

      {/* Stage Progress Bar */}
      <StageProgressBar current={currentStage} />

      <div className="p-6 space-y-4">
        {/* Current Stage Form */}
        {currentStage !== "closed" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[#0a0a0a] mb-4">
              {STAGE_LABELS[currentStage]}
            </h2>
            {renderCurrentForm()}
          </div>
        )}

        {currentStage === "closed" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[#0a0a0a] mb-4">Batch Summary</h2>
            {renderCurrentForm()}
          </div>
        )}

      </div>
    </Layout>
  );
}
