import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type PeriodSelection = { preset: string } | { from: string; to: string };

export const PRESETS: Array<{ id: string; label: string; short: string }> = [
  { id: "this-month", label: "This month", short: "This mo." },
  { id: "last-month", label: "Last month", short: "Last mo." },
  { id: "this-quarter", label: "This quarter", short: "This qtr" },
  { id: "last-quarter", label: "Last quarter", short: "Last qtr" },
  { id: "year-to-date", label: "Year to date", short: "YTD" },
  { id: "last-12-months", label: "Last 12 months", short: "12 mo." },
  { id: "last-year", label: "Last year", short: "Last yr" },
  { id: "all-time", label: "All time", short: "All" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function monthRange(y: number, m: number): { from: string; to: string } {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}
/** If the selection is exactly one calendar month, return it. */
function asMonth(sel: PeriodSelection, resolved?: { start: string; end: string }): { y: number; m: number } | null {
  const r = "from" in sel ? { start: sel.from, end: sel.to } : resolved;
  if (!r) return null;
  const a = r.start.split("-").map(Number);
  const b = r.end.split("-").map(Number);
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== 1) return null;
  if (b[2] !== new Date(Date.UTC(b[0], b[1], 0)).getUTCDate()) return null;
  return { y: a[0], m: a[1] };
}

export function selectionToQuery(sel: PeriodSelection): string {
  return "preset" in sel ? `preset=${sel.preset}` : `from=${sel.from}&to=${sel.to}`;
}

export function PeriodControl({
  value,
  resolved,
  onChange,
}: {
  value: PeriodSelection;
  /** The server-resolved range for the current selection (for month stepping). */
  resolved?: { start: string; end: string; label: string };
  onChange: (next: PeriodSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: resolved?.start ?? "", to: resolved?.end ?? "" });
  const ref = useRef<HTMLDivElement>(null);
  const month = asMonth(value, resolved);

  useEffect(() => {
    if (resolved) setDraft({ from: resolved.start, to: resolved.end });
  }, [resolved?.start, resolved?.end]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const step = (delta: number) => {
    if (!month) return;
    const d = new Date(Date.UTC(month.y, month.m - 1 + delta, 1));
    onChange(monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1));
  };

  const activePreset = "preset" in value ? value.preset : null;
  const presetLabel = "preset" in value ? PRESETS.find((p) => p.id === value.preset)?.label : null;
  // Month-sized presets read better as the month name; longer ones as the preset name.
  const label = presetLabel && !month ? presetLabel : resolved?.label ?? presetLabel ?? ("from" in value ? `${value.from} – ${value.to}` : "");

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <div className="hidden lg:flex items-center gap-1">
        {PRESETS.slice(0, 5).map((p, i) => (
          <button
            key={p.id}
            onClick={() => onChange({ preset: p.id })}
            className={`h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${i >= 2 && i < 4 ? "hidden 2xl:inline-flex" : "inline-flex"} ${
              activePreset === p.id
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[#e5e5e5] bg-white text-[#525252] hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a]"
            }`}
          >
            {p.short}
          </button>
        ))}
      </div>
      <div className="hidden lg:block h-5 w-px bg-[#e5e5e5] mx-1" />

      <button
        onClick={() => step(-1)}
        disabled={!month}
        title="Previous month"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#a3a3a3] transition-colors hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a] disabled:opacity-30"
      >
        <ChevronLeft size={13} />
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 min-w-[150px] items-center justify-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold transition-colors ${
          open ? "border-[var(--brand)]" : "border-[#e5e5e5] hover:border-[#0a0a0a]/40"
        }`}
      >
        <Calendar size={11} className="text-[#525252]" />
        <span className="truncate">{label}</span>
        <ChevronDown size={10} className={`text-[#a3a3a3] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <button
        onClick={() => step(1)}
        disabled={!month}
        title="Next month"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#a3a3a3] transition-colors hover:border-[#0a0a0a]/30 hover:text-[#0a0a0a] disabled:opacity-30"
      >
        <ChevronRight size={13} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[340px] rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-2xl">
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a3a3a3]">Quick ranges</p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange({ preset: p.id });
                  setOpen(false);
                }}
                className={`rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  activePreset === p.id ? "bg-[var(--brand)] font-semibold text-white" : "text-[#404040] hover:bg-[#f5f5f5]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-[#f0f0f0] pt-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a3a3a3]">Pick a month</p>
            <MonthGrid
              selected={month}
              onPick={(y, m) => {
                onChange(monthRange(y, m));
                setOpen(false);
              }}
            />
          </div>
          <div className="mt-3 border-t border-[#f0f0f0] pt-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a3a3a3]">Custom range</p>
            <div className="flex items-center gap-2 px-1">
              <input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="h-8 flex-1 rounded-lg border border-[#e5e5e5] px-2 text-xs" />
              <span className="text-xs text-[#a3a3a3]">to</span>
              <input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="h-8 flex-1 rounded-lg border border-[#e5e5e5] px-2 text-xs" />
              <button
                disabled={!draft.from || !draft.to || draft.from > draft.to}
                onClick={() => {
                  onChange({ from: draft.from, to: draft.to });
                  setOpen(false);
                }}
                className="h-8 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({ selected, onPick }: { selected: { y: number; m: number } | null; onPick: (y: number, m: number) => void }) {
  const now = new Date();
  const [year, setYear] = useState(selected?.y ?? now.getFullYear());
  const current = { y: now.getFullYear(), m: now.getMonth() + 1 };
  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setYear((y) => y - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-[#737373] hover:bg-[#f3f4f6]">
          <ChevronLeft size={12} />
        </button>
        <span className="text-xs font-bold">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-[#737373] hover:bg-[#f3f4f6]">
          <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MONTHS.map((mn, i) => {
          const m = i + 1;
          const isSel = selected?.y === year && selected.m === m;
          const isCur = current.y === year && current.m === m;
          const future = year > current.y || (year === current.y && m > current.m);
          return (
            <button
              key={mn}
              disabled={future}
              onClick={() => onPick(year, m)}
              className={`relative rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-30 ${
                isSel ? "bg-[var(--brand)] text-white" : isCur ? "bg-[#f3f4f6] font-semibold text-[#0a0a0a]" : "text-[#404040] hover:bg-[#f5f5f5]"
              }`}
            >
              {mn}
            </button>
          );
        })}
      </div>
    </div>
  );
}
