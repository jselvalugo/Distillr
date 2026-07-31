import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FlaskConical, Package, Package2, ShoppingCart,
  Activity, Calendar, CheckCircle2, Archive,
  Gauge, ClipboardList, BarChart3, ArrowRight,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Bell, SlidersHorizontal, GripVertical,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { fmtNum } from "../lib/utils";
import type { DistilleryControlTowerSummary, Stats } from "@shared/schema";

type BatchRow = { id: number; batchCode: string; stage: string; status: string; productName: string | null; batchDate: string };
type PermitRow = { id: number; permitType: string; expirationDate: string | null; status: string; permitNumber: string | null };
type ColaRow = { id: number; productName: string; status: string; expiresAt: string | null };
type ExciseRow = { id: number; state: string; dueDate: string; status: string };
type CalEvent = { date: string; type: "batch" | "permit" | "excise" | "cola"; label: string; color: string; href: string; id: string };

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
const CREAM = "#FAF0E2";
const CREAM_ON_WHITE = "rgba(250,240,226,0.85)";
const CREAM_ON_DARK  = "rgba(250,240,226,0.55)";

// Glass style constants
const GLASS: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};
const GLASS_STRONG: React.CSSProperties = {
  background: "rgba(255,255,255,0.11)",
  border: "1px solid rgba(255,255,255,0.18)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};
const GLASS_HERO: React.CSSProperties = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.16)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

// ─── SVG Ring Progress ───────────────────────────────────────────────────────
function Ring({
  pct, size = 52, strokeW = 4, color = "#0a0a0a", bg = "rgba(255,255,255,0.1)",
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
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "rgba(255,255,255,0.1)" }}>
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
          <span className="text-[9px] text-white/50">{labelA} {total > 0 ? `${Math.round(pctA)}%` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-white/50">{labelB} {total > 0 ? `${Math.round(pctB)}%` : ""}</span>
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
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{children}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
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
      className={`relative rounded-xl p-5 overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
      style={GLASS}
    >
      {highlight && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: CREAM_ON_DARK }} />}

      {/* Icon top-right */}
      <div className="absolute top-4 right-4 opacity-15">
        <Icon size={28} color="white" />
      </div>

      <div className="flex items-end gap-3">
        {/* Ring */}
        <div className="relative shrink-0">
          <Ring pct={pct} size={52} color={color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white/35" style={{ transform: "none" }}>
              {pct > 0 ? `${Math.round(pct)}%` : ""}
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pb-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/35 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white tabular-nums leading-none">{value}</p>
          {sub && <p className="text-[10px] text-white/25 mt-1">{sub}</p>}
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
    <div className="flex flex-col items-center justify-center h-36 rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)" }}>
      <p className="text-sm font-medium text-white/40">No active batches</p>
      <button
        onClick={() => navigate("/production")}
        className="mt-2 text-xs font-semibold text-white/60 underline underline-offset-2 hover:text-white"
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
            className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-150 group"
            style={{ ...GLASS, transition: "background 0.15s ease" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono">{b.batchCode}</span>
                  {b.productName && <span className="text-xs text-white/40 hidden sm:block">· {b.productName}</span>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: color + "28", color }}>
                  {STAGE_LABEL[b.stage] ?? b.stage}
                </span>
              </div>
              <FillBar pct={pct} color={color} height={3} />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-white/25">Start</span>
                <span className="text-[9px] font-semibold" style={{ color }}>{pct}%</span>
                <span className="text-[9px] text-white/25">Complete</span>
              </div>
            </div>
            <ArrowRight size={14} className="text-white/25 group-hover:text-white/60 transition-colors shrink-0" />
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
    <div className="rounded-xl p-5 mb-2" style={GLASS}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-3">Stage Distribution — {total} active</p>
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
            <span className="text-[10px] text-white/60">{STAGE_LABEL[s]} <strong className="text-white">{counts[s]}</strong></span>
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
    <div className="rounded-xl p-4 space-y-2.5 mb-3" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-2">Permit Alerts</p>
      {alertList.map(p => {
        const urgency = p.days <= 0 ? "#ef4444" : p.days <= 30 ? "#f97316" : "#f59e0b";
        const urgencyPct = p.days <= 0 ? 100 : Math.max(10, 100 - (p.days / 90) * 100);
        return (
          <div key={p.id} className="space-y-1 cursor-pointer" onClick={() => navigate("/compliance-regulatory")}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-200">{p.permitType}{p.permitNumber ? ` — ${p.permitNumber}` : ""}</p>
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

// ─── Notification Center ──────────────────────────────────────────────────────
type Notification = {
  id: string;
  title: string;
  message: string;
  color: string;
  days: number;
  href: string;
};

function NotificationCenter({ permits, colas }: { permits: PermitRow[]; colas: ColaRow[] }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const today = new Date();

  // Build notifications from permits
  const notifications: Notification[] = [];

  for (const p of permits) {
    if (!p.expirationDate || p.status === "revoked") continue;
    const exp = new Date(p.expirationDate);
    const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    if (days > 90) continue;
    const color = days <= 0 ? "#ef4444" : days <= 30 ? "#f97316" : "#f59e0b";
    notifications.push({
      id: `permit-${p.id}`,
      title: p.permitType,
      message: days <= 0 ? "Expired" : `${days} days until expiry`,
      color,
      days,
      href: "/compliance-regulatory",
    });
  }

  // Build notifications from COLAs
  for (const c of colas) {
    if (!c.expiresAt) continue;
    const exp = new Date(c.expiresAt);
    const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    if (days > 90) continue;
    const color = days <= 0 ? "#ef4444" : days <= 30 ? "#f97316" : "#f59e0b";
    notifications.push({
      id: `cola-${c.id}`,
      title: `COLA: ${c.productName}`,
      message: days <= 0 ? "Expired" : `${days} days until expiry`,
      color,
      days,
      href: "/compliance-regulatory",
    });
  }

  // Sort by days ascending (most urgent first)
  notifications.sort((a, b) => a.days - b.days);

  const count = notifications.length;
  const badge = count > 9 ? "9+" : String(count);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-[8px] font-bold text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl overflow-hidden"
          style={GLASS_STRONG}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-xs font-bold text-white">Notifications</span>
            {count > 0 && (
              <span className="text-[10px] text-white/40">{count} active alert{count !== 1 ? "s" : ""}</span>
            )}
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 size={20} className="text-emerald-400/60" />
              <p className="text-xs text-white/40">All clear — no active alerts</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => { navigate(n.href); setOpen(false); }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: n.color + "25" }}
                  >
                    <Bell size={10} style={{ color: n.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80 truncate">{n.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: n.color }}>{n.message}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Embedded Distilling Calendar ────────────────────────────────────────────
const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function EmbeddedCalendar({
  batches, permits, colas, excise,
}: {
  batches: BatchRow[]; permits: PermitRow[]; colas: ColaRow[]; excise: ExciseRow[];
}) {
  const [, navigate] = useLocation();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [calYM, setCalYM] = useState(todayStr.slice(0, 7));

  const allEvents = useMemo<CalEvent[]>(() => {
    const today = new Date();
    const events: CalEvent[] = [];
    for (const b of batches) {
      if (!b.batchDate || b.stage === "closed") continue;
      events.push({ date: b.batchDate.slice(0, 10), type: "batch", label: b.batchCode, color: STAGE_COLORS[b.stage] ?? "#6b7280", href: `/production/${b.id}`, id: `batch-${b.id}` });
    }
    for (const p of permits) {
      if (!p.expirationDate || p.status === "revoked") continue;
      const days = Math.ceil((new Date(p.expirationDate).getTime() - today.getTime()) / 86400000);
      const color = days <= 0 ? "#ef4444" : days <= 30 ? "#f97316" : "#f59e0b";
      events.push({ date: p.expirationDate.slice(0, 10), type: "permit", label: p.permitType, color, href: "/compliance-regulatory", id: `permit-${p.id}` });
    }
    for (const e of excise) {
      if (!e.dueDate || e.status === "filed") continue;
      events.push({ date: e.dueDate.slice(0, 10), type: "excise", label: `${e.state} Excise Due`, color: "#a78bfa", href: "/reports", id: `excise-${e.id}` });
    }
    for (const c of colas) {
      if (!c.expiresAt) continue;
      events.push({ date: c.expiresAt.slice(0, 10), type: "cola", label: `COLA: ${c.productName}`, color: "#f472b6", href: "/compliance-regulatory", id: `cola-${c.id}` });
    }
    return events;
  }, [batches, permits, colas, excise]);

  const eventsByDate = useMemo<Record<string, CalEvent[]>>(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of allEvents) { (map[ev.date] ??= []).push(ev); }
    return map;
  }, [allEvents]);

  const upcoming = useMemo<CalEvent[]>(() => {
    const t = new Date(todayStr + "T00:00:00");
    const limit = new Date(t.getTime() + 30 * 86400000);
    return allEvents.filter(ev => { const d = new Date(ev.date + "T00:00:00"); return d >= t && d <= limit; }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);
  }, [allEvents, todayStr]);

  const [year, month] = calYM.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  function shiftCal(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setCalYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <>
      {/* Section header row */}
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Distilling Calendar</span>
          <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="hidden sm:flex items-center gap-3">
            {[{ label: "Batch", color: "#6366f1" }, { label: "Permit", color: "#f59e0b" }, { label: "Excise", color: "#a78bfa" }, { label: "COLA", color: "#f472b6" }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.color }} />
                <span className="text-[9px] text-white/35">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftCal(-1)} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"><ChevronLeft size={13} /></button>
          <span className="text-xs font-semibold text-white min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={() => shiftCal(1)} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"><ChevronRight size={13} /></button>
          <button
            onClick={() => setCalYM(todayStr.slice(0, 7))}
            className={`ml-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${calYM === todayStr.slice(0, 7) ? "bg-white/15 text-white" : "text-white/35 hover:text-white hover:bg-white/10"}`}
          >Today</button>
        </div>
      </div>

      {/* 2-col: grid + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        {/* Calendar grid */}
        <div className="rounded-xl overflow-hidden" style={GLASS}>
          <div className="grid grid-cols-7" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {CAL_DAYS.map(d => (
              <div key={d} className="py-2 text-center text-[9px] font-bold uppercase tracking-widest text-white/25">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const ci = i - firstDayOfWeek;
              const isCur = ci >= 0 && ci < daysInMonth;
              const dayNum = isCur ? ci + 1 : ci < 0 ? prevMonthDays + ci + 1 : ci - daysInMonth + 1;
              const dateStr = isCur ? `${calYM}-${String(dayNum).padStart(2, "0")}` : "";
              const isToday = dateStr === todayStr;
              const isWknd = i % 7 === 0 || i % 7 === 6;
              const cellEvs = dateStr ? (eventsByDate[dateStr] ?? []) : [];
              const extra = Math.max(0, cellEvs.length - 2);
              return (
                <div key={i} className="min-h-[80px] p-1.5" style={{ borderRight: i % 7 !== 6 ? "1px solid rgba(255,255,255,0.06)" : undefined, borderBottom: i < totalCells - 7 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                  <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-semibold mb-1 ${isToday ? "bg-white text-[#0a0a0a] font-bold" : isCur ? (isWknd ? "text-white/40" : "text-white/65") : "text-white/15"}`}>{dayNum}</span>
                  <div className="space-y-0.5">
                    {cellEvs.slice(0, 2).map(ev => (
                      <button key={ev.id} onClick={() => navigate(ev.href)} title={ev.label}
                        className="w-full text-left px-1 py-0.5 rounded text-[8px] font-semibold truncate block"
                        style={{ background: ev.color + "28", color: ev.color, border: `1px solid ${ev.color}35` }}
                      >{ev.label}</button>
                    ))}
                    {extra > 0 && <p className="text-[8px] text-white/25 px-0.5">+{extra} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-xl p-4" style={GLASS}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-3">Next 30 Days</p>
          {upcoming.length === 0 ? (
            <p className="text-[11px] text-white/30">No upcoming events</p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map(ev => (
                <button key={ev.id} onClick={() => navigate(ev.href)} className="w-full flex items-start gap-2 text-left group">
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-white/65 truncate group-hover:text-white transition-colors leading-tight">{ev.label}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Widget reorder shell ─────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  pipeline:        "Active Batch Pipeline",
  production:      "Production",
  bottling:        "Bottling & Inventory",
  sales_compliance:"Sales & Compliance",
  calendar:        "Distilling Calendar",
  quickaccess:     "Quick Access",
};
const DEFAULT_WIDGET_ORDER = ["pipeline", "production", "bottling", "sales_compliance", "calendar", "quickaccess"];
const WIDGET_ORDER_KEY = "distillr_widget_order";

function WidgetShell({
  id, editMode, onMove, isFirst, isLast, children,
}: {
  id: string; editMode: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  isFirst: boolean; isLast: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      {editMode && (
        <div
          className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg select-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={13} className="text-white/25" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">
              {SECTION_LABELS[id] ?? id}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onMove(id, -1)}
              disabled={isFirst}
              className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => onMove(id, 1)}
              disabled={isLast}
              className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    new Date().toISOString().slice(0, 7)
  );
  const [editMode, setEditMode] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_ORDER_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDGET_ORDER.length) return parsed;
      }
    } catch {}
    return DEFAULT_WIDGET_ORDER;
  });

  function moveWidget(id: string, dir: -1 | 1) {
    setWidgetOrder(prev => {
      const idx = prev.indexOf(id);
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }

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
  const { data: colas = [] } = useQuery<ColaRow[]>({
    queryKey: ["/api/cola"],
    queryFn: () => apiRequest("/api/cola"),
  });
  const { data: excise = [] } = useQuery<ExciseRow[]>({
    queryKey: ["/api/state-excise"],
    queryFn: () => apiRequest("/api/state-excise"),
  });
  const { data: platformConfig } = useQuery<{ dashboardColor: string | null }>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest("/api/platform-config"),
    staleTime: 60_000,
  });
  const heroBg = platformConfig?.dashboardColor ?? "#0F1B42";

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

  const monthLabel = selectedMonth
    ? new Date(selectedMonth + "-02").toLocaleString("en-US", { month: "long", year: "numeric" })
    : "All Time";

  const completed = Number(stats?.completed ?? 0);
  const totalBatches = allActiveBatches.length + completed;
  const completedPct = totalBatches > 0 ? (completed / totalBatches) * 100 : 0;

  return (
    <Layout>
      <div className="min-h-screen relative" style={{ background: heroBg }}>

        {/* ── Decorative blobs ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-25" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute -bottom-32 -left-32 w-[450px] h-[450px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #FAF0E2 0%, transparent 70%)", filter: "blur(80px)" }} />
        </div>

        <div className="relative" style={{ zIndex: 1 }}>
          {/* ── Hero ── */}
          <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Operations Overview</p>
                  <h1 className="text-3xl font-bold text-white leading-none">
                    {monthLabel}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <MonthNavigator value={selectedMonth} onChange={setSelectedMonth} />
                  <div className="w-px h-6 bg-white/15" />
                  <NotificationCenter permits={permits} colas={colas} />
                  <div className="w-px h-6 bg-white/15" />
                  <button
                    onClick={() => setEditMode(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      editMode ? "bg-white/15 text-white" : "text-white/40 hover:text-white hover:bg-white/10"
                    }`}
                    title="Customize layout"
                  >
                    <SlidersHorizontal size={12} />
                    <span className="hidden sm:block">{editMode ? "Done" : "Customize"}</span>
                  </button>
                </div>
              </div>

              {/* Hero KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Active Batches", value: allActiveBatches.length, sub: "in pipeline", icon: Activity, color: CREAM, pct: relPct(allActiveBatches.length, casesProduced, totalSold, proof), accent: true },
                  { label: "Proof Gallons", value: fmtNum(proof, 1), sub: "produced", icon: Gauge, color: "#818cf8", pct: relPct(proof, gallons) },
                  { label: "Cases Bottled", value: fmtNum(casesProduced, 0), sub: "this period", icon: Package, color: "#34d399", pct: relPct(casesProduced, totalSold) },
                  { label: "Cases Sold", value: fmtNum(totalSold, 0), sub: "fulfilled", icon: ShoppingCart, color: "#60a5fa", pct: relPct(totalSold, casesProduced) },
                ].map((k) => {
                  const Icon = k.icon;
                  return (
                    <div
                      key={k.label}
                      className="rounded-xl p-4 relative overflow-hidden"
                      style={GLASS_HERO}
                    >
                      {k.accent && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: CREAM_ON_DARK }} />}
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

          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-10">
            {widgetOrder.map((id, idx) => (
              <WidgetShell
                key={id}
                id={id}
                editMode={editMode}
                onMove={moveWidget}
                isFirst={idx === 0}
                isLast={idx === widgetOrder.length - 1}
              >
                {/* ── pipeline ── */}
                {id === "pipeline" && <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Active Batch Pipeline</span>
                      <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.08)" }} />
                      <span className="text-[10px] text-white/25">live — not filtered by month</span>
                    </div>
                    <button onClick={() => navigate("/production")} className="text-[11px] font-semibold text-white/40 hover:text-white transition-colors flex items-center gap-1">
                      View all <ArrowRight size={11} />
                    </button>
                  </div>
                  <StageDistribution batches={allBatches} />
                  <BatchPipeline batches={allBatches} />
                </>}

                {/* ── production ── */}
                {id === "production" && <>
                  <SectionLabel>Production</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard highlight label="Gallons Distilled" value={fmtNum(gallons, 1)} sub="US gallons" pct={relPct(gallons, proof, prodRecords * 10, scheduled * 10)} icon={FlaskConical} color={CREAM_ON_DARK} />
                    <MetricCard label="Proof Gallons" value={fmtNum(proof, 1)} sub="at proof" pct={relPct(proof, gallons)} icon={Gauge} color="#818cf8" />
                    <MetricCard label="Total Batches" value={batches.length || "—"} sub={selectedMonth ? "this month" : "all batches"} pct={relPct(batches.length, scheduled, inProgress)} icon={ClipboardList} color="#34d399" />
                    <MetricCard label="Scheduled Batches" value={scheduled || "—"} sub="in planning" pct={relPct(scheduled, inProgress, prodRecords)} icon={Calendar} color="#60a5fa" />
                  </div>
                  {gallons > 0 && proof > 0 && (
                    <div className="mt-3 rounded-xl px-5 py-3 flex items-center gap-4" style={GLASS}>
                      <div className="flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">Proof Efficiency</p>
                        <p className="text-xs text-white/60 mt-0.5"><span className="font-bold text-white">{fmtNum(proof / gallons, 2)}</span> proof gallons per gallon distilled</p>
                      </div>
                      <div className="flex-1">
                        <FillBar pct={Math.min((proof / gallons) * 50, 100)} color={CREAM_ON_DARK} height={6} />
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white tabular-nums">{Math.round((proof / gallons) * 100)}%</p>
                        <p className="text-[9px] text-white/35">of yield</p>
                      </div>
                    </div>
                  )}
                </>}

                {/* ── bottling ── */}
                {id === "bottling" && <>
                  <SectionLabel>Bottling & Inventory</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard highlight label="Cases Produced" value={fmtNum(casesProduced, 0)} sub="total cases" pct={relPct(casesProduced, bottles / 12)} icon={Package} color={CREAM_ON_DARK} />
                    <MetricCard label="Bottles Made" value={fmtNum(bottles, 0)} sub="units" pct={relPct(bottles / 12, casesProduced)} icon={Package2} color="#818cf8" />
                    <MetricCard label="Inventory Records" value={invRecords || "—"} sub="lot records" pct={relPct(invRecords, inProgress, scheduled)} icon={Archive} color="#34d399" />
                    <MetricCard label="Batches In Progress" value={inProgress || "—"} sub="active stages" pct={relPct(inProgress, scheduled, completed)} icon={Activity} color="#f472b6" />
                  </div>
                </>}

                {/* ── sales_compliance ── */}
                {id === "sales_compliance" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-3">
                      <SectionLabel>Sales & Inventory Position</SectionLabel>
                      <div className="rounded-xl p-5" style={GLASS}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-4">Case Summary</p>
                        <div className="grid grid-cols-3 gap-6 mb-4">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Bottled</p>
                            <p className="text-2xl font-bold text-white tabular-nums mt-1">{fmtNum(casesProduced, 0)}</p>
                            <p className="text-[10px] text-white/25">total cases</p>
                          </div>
                          <div>
                            <div className="flex items-end gap-1.5">
                              <ShoppingCart size={13} color="#60a5fa" />
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Sold</p>
                            </div>
                            <p className="text-2xl font-bold text-white tabular-nums mt-1">{fmtNum(totalSold, 0)}</p>
                            <p className="text-[10px] text-white/25">cases on orders</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">On Hand</p>
                            <p className="text-2xl font-bold text-white tabular-nums mt-1">{fmtNum(Math.max(0, casesProduced - totalSold), 0)}</p>
                            <p className="text-[10px] text-white/25">estimated remaining</p>
                          </div>
                        </div>
                        <FillBar pct={casesProduced > 0 ? (totalSold / casesProduced) * 100 : 0} color="#60a5fa" height={6} />
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[9px] text-white/25">0 cases sold</span>
                          <span className="text-[9px] text-white/50 font-semibold">{casesProduced > 0 ? `${Math.round((totalSold / casesProduced) * 100)}% sold` : "No production yet"}</span>
                          <span className="text-[9px] text-white/25">{fmtNum(casesProduced, 0)} bottled</span>
                        </div>
                      </div>
                      <div className="rounded-xl p-5" style={GLASS}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-4">Distribution Channel</p>
                        <div className="grid grid-cols-2 gap-6 mb-4">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-[#0369a1]" /><p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Distributor</p></div>
                            <p className="text-2xl font-bold text-white tabular-nums">{distCases > 0 ? fmtNum(distCases, 0) : "—"}</p>
                            <p className="text-[10px] text-white/25">cases</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-[#f472b6]" /><p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Retail</p></div>
                            <p className="text-2xl font-bold text-white tabular-nums">{retailCases > 0 ? fmtNum(retailCases, 0) : "—"}</p>
                            <p className="text-[10px] text-white/25">cases</p>
                          </div>
                        </div>
                        {(distCases > 0 || retailCases > 0) ? <SplitBar a={distCases} b={retailCases} colorA="#0369a1" colorB="#f472b6" labelA="Distributor" labelB="Retail" /> : <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <MetricCard label="Orders Fulfilled" value={fulfilled || "—"} sub="approved + fulfilled" pct={relPct(fulfilled, totalSold / 10)} icon={CheckCircle2} color="#34d399" />
                        <div className="rounded-xl p-5" style={GLASS}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-3">Production Totals</p>
                          <div className="space-y-3">
                            {[{ label: "Proof Gallons produced", value: fmtNum(proof, 1), pct: relPct(proof, gallons), color: "#818cf8" }, { label: "Wine Gallons barreled", value: fmtNum(gallons, 1), pct: relPct(gallons, proof), color: "#6366f1" }].map(item => (
                              <div key={item.label}>
                                <div className="flex justify-between mb-1"><span className="text-[9px] text-white/40">{item.label}</span><span className="text-[10px] font-bold text-white tabular-nums">{item.value}</span></div>
                                <FillBar pct={item.pct} color={item.color} height={4} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Compliance</SectionLabel>
                      <PermitAlert permits={permits} />
                      <div className="rounded-xl p-5 mb-3" style={GLASS}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-4">Batch Lifecycle</p>
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <Ring pct={completedPct} size={64} strokeW={5} color="white" />
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                              <span className="text-sm font-bold text-white leading-none">{completed}</span>
                              <span className="text-[7px] text-white/40 leading-none mt-0.5">closed</span>
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="flex justify-between mb-1"><span className="text-[9px] text-white/40">Active</span><span className="text-[10px] font-bold tabular-nums text-white">{activeBatches.length}</span></div>
                              <FillBar pct={totalBatches > 0 ? (activeBatches.length / totalBatches) * 100 : 0} color={CREAM_ON_DARK} height={4} />
                            </div>
                            <div>
                              <div className="flex justify-between mb-1"><span className="text-[9px] text-white/40">Completed</span><span className="text-[10px] font-bold tabular-nums text-white">{completed}</span></div>
                              <FillBar pct={completedPct} color="white" height={4} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => navigate("/compliance-regulatory")} className="rounded-xl p-4 text-left transition-all duration-200" style={GLASS} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Permits</p>
                          <p className="text-2xl font-bold text-white tabular-nums">{permits.length}</p>
                          <p className="text-[10px] text-white/25 mt-0.5">on file</p>
                        </button>
                        <button onClick={() => navigate("/reports")} className="rounded-xl p-4 text-left transition-all duration-200" style={GLASS} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">TTB Reports</p>
                          <BarChart3 size={22} className="text-white/60 mb-1" />
                          <p className="text-[10px] text-white/25">view filings</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── calendar ── */}
                {id === "calendar" && (
                  <EmbeddedCalendar batches={allBatches} permits={permits} colas={colas} excise={excise} />
                )}

                {/* ── quickaccess ── */}
                {id === "quickaccess" && <>
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
                        <button key={nav.href} onClick={() => navigate(nav.href)} className="rounded-xl p-4 text-left group transition-all duration-200" style={GLASS} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                          <Icon size={16} className="text-white/40 group-hover:text-white/60 transition-colors mb-2" />
                          <p className="text-sm font-semibold text-white">{nav.label}</p>
                          <p className="text-[11px] text-white/35 mt-0.5">{nav.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </>}
              </WidgetShell>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
