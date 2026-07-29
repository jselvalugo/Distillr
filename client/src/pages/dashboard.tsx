import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FlaskConical, Package, Package2, Truck, ShoppingCart,
  Activity, Calendar, CheckCircle2, Archive, Droplets,
  Gauge, ClipboardList, BarChart3, ArrowRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { fmtNum } from "../lib/utils";
import type { DistilleryControlTowerSummary, Stats } from "@shared/schema";

type BatchRow = { id: number; batchCode: string; stage: string; status: string; productName: string | null; batchDate: string };
type PermitRow = { id: number; permitType: string; expirationDate: string | null; status: string; permitNumber: string | null };

const STAGE_STEP: Record<string, number> = {
  planning: 1, mash_fermentation: 2, distillation: 3,
  barreling: 4, aging: 5, bottling: 6, closed: 7,
};
const STAGE_LABEL: Record<string, string> = {
  planning: "Planning", mash_fermentation: "Mash & Ferment", distillation: "Distillation",
  barreling: "Barreling", aging: "Aging", bottling: "Bottling", closed: "Closed",
};
const STAGE_COLORS: Record<string, string> = {
  planning: "#6366f1", mash_fermentation: "#8b5cf6", distillation: "#d97706",
  barreling: "#0369a1", aging: "#15803d", bottling: "#b45309", closed: "#6b7280",
};
const AMBER = "#c9933a";

// ─── SVG Ring Progress ───────────────────────────────────────────────────────
function Ring({
  pct, size = 52, strokeW = 4, color = "#0a0a0a", bg = "#f0f0f0",
}: {
  pct: number; size?: number; strokeW?: number; color?: string; bg?: string;
}) {
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const offset = circ * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={strokeW} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

// ─── Mini horizontal fill bar ────────────────────────────────────────────────
function FillBar({ pct, color = "#0a0a0a", height = 4 }: { pct: number; color?: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "#f0f0f0" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </div>
  );
}

// ─── Stacked proportion bar (distributor vs retail) ──────────────────────────
function SplitBar({ a, b, colorA, colorB, labelA, labelB }: { a: number; b: number; colorA: string; colorB: string; labelA: string; labelB: string }) {
  const total = a + b;
  const pctA = total > 0 ? (a / total) * 100 : 50;
  const pctB = 100 - pctA;
  return (
    <div className="space-y-1.5">
      <div className="flex w-full h-2 rounded-full overflow-hidden">
        <div style={{ width: `${pctA}%`, background: colorA, transition: "width 0.8s ease" }} />
        <div style={{ width: `${pctB}%`, background: colorB, transition: "width 0.8s ease" }} />
      </div>
      <div className="flex justify-between">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: colorA }} />
          <span className="text-[9px] text-[#a3a3a3]">{labelA} {total > 0 ? `${Math.round(pctA)}%` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-[#a3a3a3]">{labelB} {total > 0 ? `${Math.round(pctB)}%` : ""}</span>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: colorB }} />
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#737373]">{children}</span>
      <div className="flex-1 h-px bg-[#e5e5e5]" />
    </div>
  );
}

// ─── Metric card with ring + icon ─────────────────────────────────────────────
function MetricCard({
  label, value, sub, pct = 0, icon: Icon, color = "#0a0a0a",
  highlight = false, onClick,
}: {
  label: string; value: string | number; sub?: string; pct?: number;
  icon: React.ElementType; color?: string; highlight?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white border border-[#e5e5e5] rounded-xl p-5 overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:border-[#d0d0d0]" : ""}`}
    >
      {highlight && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: AMBER }} />}

      {/* Icon top-right */}
      <div className="absolute top-4 right-4 opacity-10">
        <Icon size={28} color="#0a0a0a" />
      </div>

      <div className="flex items-end gap-3">
        {/* Ring */}
        <div className="relative shrink-0">
          <Ring pct={pct} size={52} color={color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-bold text-[#a3a3a3]" style={{ transform: "none" }}>
              {pct > 0 ? `${Math.round(pct)}%` : ""}
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pb-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">{label}</p>
          <p className="text-2xl font-bold text-[#0a0a0a] tabular-nums leading-none">{value}</p>
          {sub && <p className="text-[10px] text-[#c0c0c0] mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Batch pipeline ───────────────────────────────────────────────────────────
function BatchPipeline({ batches }: { batches: BatchRow[] }) {
  const [, navigate] = useLocation();
  const active = batches.filter(b => b.stage !== "closed").slice(0, 6);

  if (!active.length) return (
    <div className="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-[#e0e0e0] bg-white">
      <p className="text-sm font-medium text-[#b0b0b0]">No active batches</p>
      <button
        onClick={() => navigate("/production")}
        className="mt-2 text-xs font-semibold text-[#0a0a0a] underline underline-offset-2 hover:text-[#404040]"
      >
        Create one in Production →
      </button>
    </div>
  );

  return (
    <div className="grid gap-2">
      {active.map((b) => {
        const step = STAGE_STEP[b.stage] ?? 1;
        const pct = Math.round(((step - 1) / 6) * 100);
        const color = STAGE_COLORS[b.stage] ?? "#6b7280";
        return (
          <div
            key={b.id}
            onClick={() => navigate(`/production/${b.id}`)}
            className="flex items-center gap-4 p-4 rounded-xl bg-white border border-[#e5e5e5] hover:border-[#c8c8c8] hover:shadow-sm cursor-pointer transition-all duration-150 group"
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0a0a0a] font-mono">{b.batchCode}</span>
                  {b.productName && <span className="text-xs text-[#a3a3a3] hidden sm:block">· {b.productName}</span>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
                  {STAGE_LABEL[b.stage] ?? b.stage}
                </span>
              </div>
              <FillBar pct={pct} color={color} height={3} />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[#d0d0d0]">Start</span>
                <span className="text-[9px] font-semibold" style={{ color }}>{pct}%</span>
                <span className="text-[9px] text-[#d0d0d0]">Complete</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-[#d0d0d0] group-hover:text-[#0a0a0a] transition-colors shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ─── Stage distribution bar (mini stacked) ───────────────────────────────────
function StageDistribution({ batches }: { batches: BatchRow[] }) {
  const active = batches.filter(b => b.stage !== "closed");
  if (!active.length) return null;

  const counts: Record<string, number> = {};
  for (const b of active) counts[b.stage] = (counts[b.stage] ?? 0) + 1;
  const total = active.length;

  const stages = ["planning", "mash_fermentation", "distillation", "barreling", "aging", "bottling"];
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 mb-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0] mb-3">Stage Distribution — {total} active</p>
      <div className="flex w-full h-3 rounded-full overflow-hidden gap-0.5">
        {stages.map(s => {
          const pct = ((counts[s] ?? 0) / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={s} style={{ width: `${pct}%`, background: STAGE_COLORS[s], transition: "width 0.8s ease", borderRadius: 999 }} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {stages.filter(s => counts[s]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLORS[s] }} />
            <span className="text-[10px] text-[#737373]">{STAGE_LABEL[s]} <strong className="text-[#0a0a0a]">{counts[s]}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Permit alert ─────────────────────────────────────────────────────────────
function PermitAlert({ permits }: { permits: PermitRow[] }) {
  const [, navigate] = useLocation();
  const today = new Date();
  const alertList = permits
    .filter(p => p.expirationDate && p.status !== "revoked")
    .map(p => {
      const exp = new Date(p.expirationDate!);
      const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      return { ...p, days };
    })
    .filter(p => p.days <= 90)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  if (!alertList.length) return null;

  return (
    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 space-y-2.5 mb-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#92400e] mb-2">Permit Alerts</p>
      {alertList.map(p => {
        const urgency = p.days <= 0 ? "#ef4444" : p.days <= 30 ? "#f97316" : "#f59e0b";
        const urgencyPct = p.days <= 0 ? 100 : Math.max(10, 100 - (p.days / 90) * 100);
        return (
          <div key={p.id} className="space-y-1 cursor-pointer" onClick={() => navigate("/compliance-regulatory")}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#78350f]">{p.permitType}{p.permitNumber ? ` — ${p.permitNumber}` : ""}</p>
              <span className="text-[9px] font-bold" style={{ color: urgency }}>
                {p.days <= 0 ? "EXPIRED" : `${p.days}d left`}
              </span>
            </div>
            <FillBar pct={urgencyPct} color={urgency} height={3} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Month navigator ─────────────────────────────────────────────────────────
function MonthNavigator({
  value, onChange,
}: {
  value: string | null;
  onChange: (m: string | null) => void;
}) {
  const currentYM = new Date().toISOString().slice(0, 7);

  function shift(delta: number) {
    const base = value ?? currentYM;
    const [y, m] = base.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const label = value
    ? new Date(value + "-02").toLocaleString("en-US", { month: "long", year: "numeric" })
    : "All Time";

  const isCurrentMonth = value === currentYM;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => shift(-1)}
        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-sm font-semibold text-white min-w-[130px] text-center">{label}</span>
      <button
        onClick={() => shift(1)}
        disabled={isCurrentMonth || !value}
        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronRight size={14} />
      </button>
      <div className="w-px h-4 bg-white/15 mx-1" />
      <button
        onClick={() => onChange(value ? null : currentYM)}
        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors ${
          !value
            ? "bg-white/15 text-white"
            : "text-white/40 hover:text-white hover:bg-white/10"
        }`}
      >
        {value ? "All Time" : "By Month"}
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    new Date().toISOString().slice(0, 7)
  );

  const towerUrl = selectedMonth
    ? `/api/distilling/control-tower?month=${selectedMonth}`
    : "/api/distilling/control-tower";

  const { data: tower } = useQuery<DistilleryControlTowerSummary>({
    queryKey: ["/api/distilling/control-tower", selectedMonth],
    queryFn: () => apiRequest(towerUrl),
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("/api/stats"),
  });
  const { data: allBatches = [] } = useQuery<BatchRow[]>({
    queryKey: ["/api/distilling/batch-records"],
    queryFn: () => apiRequest("/api/distilling/batch-records"),
  });
  const { data: permits = [] } = useQuery<PermitRow[]>({
    queryKey: ["/api/permits"],
    queryFn: () => apiRequest("/api/permits"),
  });

  // Filter batches for pipeline/stage display by selected month
  const batches = selectedMonth
    ? allBatches.filter(b => b.batchDate?.startsWith(selectedMonth))
    : allBatches;

  // Always show currently active batches in the live pipeline (not month-filtered)
  const activeBatches = batches.filter(b => b.stage !== "closed");
  const allActiveBatches = allBatches.filter(b => b.stage !== "closed");

  // Relative percentages for rings (within each section group)
  function relPct(val: number | undefined | null, ...others: (number | undefined | null)[]) {
    const n = Number(val ?? 0);
    const max = Math.max(n, ...others.map(v => Number(v ?? 0)));
    return max > 0 ? (n / max) * 100 : 0;
  }

  const gallons = Number(tower?.produced?.gallonsDistilled ?? 0);
  const proof = Number(tower?.produced?.proofGallons ?? 0);
  const prodRecords = Number(tower?.produced?.recordCount ?? 0);
  const scheduled = Number(stats?.scheduled ?? 0);

  const casesProduced = Number(tower?.bottled?.casesMade ?? 0);
  const bottles = Number(tower?.bottled?.bottlesMade ?? 0);
  const invRecords = Number(tower?.bottled?.inventoryRecordCount ?? 0);
  const inProgress = Number(stats?.inProgress ?? 0);

  const totalSold = Number(tower?.sold?.totalCases ?? 0);
  const distCases = Number(tower?.sold?.distributorCases ?? 0);
  const retailCases = Number(tower?.sold?.retailCases ?? 0);
  const fulfilled = Number(tower?.sold?.salesOrdersApprovedOrFulfilled ?? 0);

  const endCases = Number(tower?.inventory?.endingMonthInventory ?? 0);
  const endGallons = Number(tower?.inventory?.endingUsGallons ?? 0);
  const endProof = Number(tower?.inventory?.endingProofGallons ?? 0);

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + "-02").toLocaleString("en-US", { month: "long", year: "numeric" })
    : "All Time";

  const completed = Number(stats?.completed ?? 0);
  const totalBatches = allActiveBatches.length + completed;
  const completedPct = totalBatches > 0 ? (completed / totalBatches) * 100 : 0;

  return (
    <Layout>
      <div className="min-h-screen bg-[#f7f7f7]">

        {/* ── Hero ── */}
        <div className="bg-[#0a0a0a] px-8 pt-8 pb-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Operations Overview</p>
                <h1 className="text-3xl font-bold text-white leading-none">
                  {monthLabel}
                </h1>
              </div>
              <MonthNavigator value={selectedMonth} onChange={setSelectedMonth} />
            </div>

            {/* Hero KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Batches", value: allActiveBatches.length, sub: "in pipeline", icon: Activity, color: AMBER, pct: relPct(allActiveBatches.length, casesProduced, totalSold, proof), accent: true },
                { label: "Proof Gallons", value: fmtNum(proof, 1), sub: "produced", icon: Gauge, color: "#818cf8", pct: relPct(proof, gallons) },
                { label: "Cases Bottled", value: fmtNum(casesProduced, 0), sub: "this period", icon: Package, color: "#34d399", pct: relPct(casesProduced, totalSold) },
                { label: "Cases Sold", value: fmtNum(totalSold, 0), sub: "fulfilled", icon: ShoppingCart, color: "#60a5fa", pct: relPct(totalSold, casesProduced) },
              ].map((k) => {
                const Icon = k.icon;
                return (
                  <div
                    key={k.label}
                    className="rounded-xl p-4 relative overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${k.accent ? AMBER + "50" : "rgba(255,255,255,0.08)"}` }}
                  >
                    {k.accent && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: AMBER }} />}
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold leading-tight">{k.label}</p>
                      <Icon size={14} color={k.color} opacity={0.7} />
                    </div>
                    <div className="flex items-end gap-2">
                      <p className="text-3xl font-bold text-white tabular-nums leading-none">{k.value}</p>
                      {k.pct > 0 && (
                        <div className="mb-0.5">
                          <Ring pct={k.pct} size={32} strokeW={3} color={k.color} bg="rgba(255,255,255,0.1)" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-white/25 mt-1.5">{k.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 space-y-10">

          {/* ── Batch Pipeline ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#737373]">Active Batch Pipeline</span>
                <div className="h-px bg-[#e5e5e5] w-8" />
                <span className="text-[10px] text-[#b0b0b0]">live — not filtered by month</span>
              </div>
              <button
                onClick={() => navigate("/production")}
                className="text-[11px] font-semibold text-[#737373] hover:text-[#0a0a0a] transition-colors flex items-center gap-1"
              >
                View all <ArrowRight size={11} />
              </button>
            </div>
            <StageDistribution batches={allBatches} />
            <BatchPipeline batches={allBatches} />
          </section>

          {/* ── Production ── */}
          <section>
            <SectionLabel>Production</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard highlight label="Gallons Distilled" value={fmtNum(gallons, 1)} sub="US gallons" pct={relPct(gallons, proof, prodRecords * 10, scheduled * 10)} icon={FlaskConical} color={AMBER} />
              <MetricCard label="Proof Gallons" value={fmtNum(proof, 1)} sub="at proof" pct={relPct(proof, gallons)} icon={Gauge} color="#818cf8" />
              <MetricCard label="Total Batches" value={batches.length || "—"} sub={selectedMonth ? "this month" : "all batches"} pct={relPct(batches.length, scheduled, inProgress)} icon={ClipboardList} color="#34d399" />
              <MetricCard label="Scheduled Batches" value={scheduled || "—"} sub="in planning" pct={relPct(scheduled, inProgress, prodRecords)} icon={Calendar} color="#60a5fa" />
            </div>
            {/* Proof efficiency callout */}
            {gallons > 0 && proof > 0 && (
              <div className="mt-3 bg-white border border-[#e5e5e5] rounded-xl px-5 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0]">Proof Efficiency</p>
                  <p className="text-xs text-[#404040] mt-0.5">
                    <span className="font-bold text-[#0a0a0a]">{fmtNum(proof / gallons, 2)}</span> proof gallons per gallon distilled
                  </p>
                </div>
                <div className="flex-1">
                  <FillBar pct={Math.min((proof / gallons) * 50, 100)} color={AMBER} height={6} />
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#0a0a0a] tabular-nums">{Math.round((proof / gallons) * 100)}%</p>
                  <p className="text-[9px] text-[#b0b0b0]">of yield</p>
                </div>
              </div>
            )}
          </section>

          {/* ── Bottling & Inventory ── */}
          <section>
            <SectionLabel>Bottling & Inventory</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard highlight label="Cases Produced" value={fmtNum(casesProduced, 0)} sub="total cases" pct={relPct(casesProduced, bottles / 12)} icon={Package} color={AMBER} />
              <MetricCard label="Bottles Made" value={fmtNum(bottles, 0)} sub="units" pct={relPct(bottles / 12, casesProduced)} icon={Package2} color="#818cf8" />
              <MetricCard label="Inventory Records" value={invRecords || "—"} sub="lot records" pct={relPct(invRecords, inProgress, scheduled)} icon={Archive} color="#34d399" />
              <MetricCard label="Batches In Progress" value={inProgress || "—"} sub="active stages" pct={relPct(inProgress, scheduled, completed)} icon={Activity} color="#f472b6" />
            </div>
          </section>

          {/* ── Sales + Compliance ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Sales */}
            <div className="lg:col-span-2 space-y-3">
              <SectionLabel>Sales & Inventory Position</SectionLabel>

              {/* Cases summary card */}
              <div className="bg-white border border-[#e5e5e5] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0]">Case Summary</p>
                </div>
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#b0b0b0]">Bottled</p>
                    <p className="text-2xl font-bold text-[#0a0a0a] tabular-nums mt-1">{fmtNum(casesProduced, 0)}</p>
                    <p className="text-[10px] text-[#c0c0c0]">total cases</p>
                  </div>
                  <div>
                    <div className="flex items-end gap-1.5">
                      <ShoppingCart size={13} color="#0369a1" />
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#b0b0b0]">Sold</p>
                    </div>
                    <p className="text-2xl font-bold text-[#0a0a0a] tabular-nums mt-1">{fmtNum(totalSold, 0)}</p>
                    <p className="text-[10px] text-[#c0c0c0]">cases on orders</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#b0b0b0]">On Hand</p>
                    <p className="text-2xl font-bold text-[#0a0a0a] tabular-nums mt-1">{fmtNum(Math.max(0, casesProduced - totalSold), 0)}</p>
                    <p className="text-[10px] text-[#c0c0c0]">estimated remaining</p>
                  </div>
                </div>
                <FillBar
                  pct={casesProduced > 0 ? (totalSold / casesProduced) * 100 : 0}
                  color="#0369a1"
                  height={6}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-[#c0c0c0]">0 cases sold</span>
                  <span className="text-[9px] text-[#737373] font-semibold">
                    {casesProduced > 0 ? `${Math.round((totalSold / casesProduced) * 100)}% sold` : "No production yet"}
                  </span>
                  <span className="text-[9px] text-[#c0c0c0]">{fmtNum(casesProduced, 0)} bottled</span>
                </div>
              </div>

              {/* Orders fulfilled + proof/gallons */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Orders Fulfilled" value={fulfilled || "—"} sub="approved + fulfilled" pct={relPct(fulfilled, totalSold / 10)} icon={CheckCircle2} color="#34d399" />
                <div className="bg-white border border-[#e5e5e5] rounded-xl p-5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0] mb-3">Production Totals</p>
                  <div className="space-y-3">
                    {[
                      { label: "Proof Gallons produced", value: fmtNum(proof, 1), pct: relPct(proof, gallons), color: "#818cf8" },
                      { label: "Wine Gallons barreled", value: fmtNum(gallons, 1), pct: relPct(gallons, proof), color: "#6366f1" },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[9px] text-[#b0b0b0]">{item.label}</span>
                          <span className="text-[10px] font-bold text-[#0a0a0a] tabular-nums">{item.value}</span>
                        </div>
                        <FillBar pct={item.pct} color={item.color} height={4} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance */}
            <div>
              <SectionLabel>Compliance</SectionLabel>
              <PermitAlert permits={permits} />

              {/* Batch lifecycle card */}
              <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 mb-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0] mb-4">Batch Lifecycle</p>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <Ring pct={completedPct} size={64} strokeW={5} color="#0a0a0a" />
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-sm font-bold text-[#0a0a0a] leading-none">{completed}</span>
                      <span className="text-[7px] text-[#b0b0b0] leading-none mt-0.5">closed</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] text-[#b0b0b0]">Active</span>
                        <span className="text-[10px] font-bold tabular-nums">{activeBatches.length}</span>
                      </div>
                      <FillBar pct={totalBatches > 0 ? (activeBatches.length / totalBatches) * 100 : 0} color={AMBER} height={4} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] text-[#b0b0b0]">Completed</span>
                        <span className="text-[10px] font-bold tabular-nums">{completed}</span>
                      </div>
                      <FillBar pct={completedPct} color="#0a0a0a" height={4} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/compliance-regulatory")}
                  className="rounded-xl p-4 bg-white border border-[#e5e5e5] hover:border-[#d0d0d0] hover:shadow-sm transition-all text-left group"
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0] mb-2">Permits</p>
                  <p className="text-2xl font-bold text-[#0a0a0a] tabular-nums">{permits.length}</p>
                  <p className="text-[10px] text-[#c0c0c0] mt-0.5">on file</p>
                </button>
                <button
                  onClick={() => navigate("/reports")}
                  className="rounded-xl p-4 bg-white border border-[#e5e5e5] hover:border-[#d0d0d0] hover:shadow-sm transition-all text-left group"
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#b0b0b0] mb-2">TTB Reports</p>
                  <BarChart3 size={22} className="text-[#0a0a0a] mb-1" />
                  <p className="text-[10px] text-[#c0c0c0]">view filings</p>
                </button>
              </div>
            </div>
          </div>

          {/* ── Quick Access ── */}
          <section>
            <SectionLabel>Quick Access</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Production", sub: "Manage batches", href: "/production", icon: FlaskConical },
                { label: "Barrels", sub: "Aging & tracking", href: "/barrels", icon: Archive },
                { label: "Inventory", sub: "Lots & items", href: "/inventory", icon: Package },
                { label: "Sales Orders", sub: "Clients & orders", href: "/sales-orders", icon: ShoppingCart },
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <button
                    key={nav.href}
                    onClick={() => navigate(nav.href)}
                    className="rounded-xl p-4 bg-white border border-[#e5e5e5] hover:bg-[#0a0a0a] hover:border-[#0a0a0a] hover:shadow-md transition-all duration-200 text-left group"
                  >
                    <Icon size={16} className="text-[#a3a3a3] group-hover:text-white/50 transition-colors mb-2" />
                    <p className="text-sm font-semibold text-[#0a0a0a] group-hover:text-white transition-colors">{nav.label}</p>
                    <p className="text-[11px] text-[#a3a3a3] group-hover:text-white/40 transition-colors mt-0.5">{nav.sub}</p>
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </Layout>
  );
}
