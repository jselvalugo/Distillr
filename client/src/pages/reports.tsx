import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Landmark,
  Layers,
  Loader2,
  Package,
  Printer,
  Receipt,
  ScrollText,
  ShoppingCart,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ReportCatalogEntry, ReportDocument, ReportKind } from "@shared/report-types";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { ReportDocumentView } from "../components/reports/report-document";
import { PeriodControl, PRESETS, selectionToQuery, type PeriodSelection } from "../components/reports/period-control";

const ICONS: Record<ReportKind, LucideIcon> = {
  "production-operations": FileText,
  "excise-tax": Receipt,
  "state-excise": Landmark,
  "batch-activity": Table2,
  "production-ledger": ScrollText,
  "barrel-inventory": Layers,
  "finished-goods": Package,
  sales: ShoppingCart,
};

const GROUP_ORDER = ["Compliance & Tax", "Production", "Inventory & Aging", "Sales"];
const GROUP_BLURB: Record<string, string> = {
  "Compliance & Tax": "What the TTB and the state need from you, laid out the way the forms ask for it.",
  Production: "What came off the still, went into wood and came out as bottles.",
  "Inventory & Aging": "What you hold today, in barrels and in cases.",
  Sales: "Who bought what, and for how much.",
};

function useCatalog() {
  return useQuery<{ reports: ReportCatalogEntry[] }>({
    queryKey: ["/api/reports"],
    queryFn: () => apiRequest("/api/reports"),
    staleTime: 5 * 60_000,
  });
}

// ── Catalog ────────────────────────────────────────────────────────────────

function ReportsHome() {
  const { data, isLoading } = useCatalog();
  const reports = data?.reports ?? [];
  return (
    <Layout>
      <div className="min-h-full bg-[#f7f7f8]">
        <div className="mx-auto max-w-[1120px] px-6 pb-16 pt-9">
          <div className="reports-reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a9a9a]">Reports</p>
              <h1 className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#0a0a0a]">Pick a report</h1>
              <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-[#5c5c63]">
                Every report is built from the batches, barrels, inventory and orders you've already recorded. Open one, choose a period, and
                download it as a PDF, Excel file or CSV — the download matches what's on screen.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[#737373]">
              <Loader2 size={14} className="animate-spin" /> Loading reports…
            </div>
          ) : (
            GROUP_ORDER.map((group, gi) => {
              const items = reports.filter((r) => r.group === group);
              if (!items.length) return null;
              return (
                <section key={group} className="reports-reveal mb-9" style={{ animationDelay: `${gi * 80}ms` }}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#0a0a0a]">{group}</h2>
                    <span className="h-px flex-1 bg-[#e5e5e7]" />
                    <p className="hidden text-[12px] text-[#8a8a8a] sm:block">{GROUP_BLURB[group]}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((r) => {
                      const Icon = ICONS[r.kind] ?? BarChart3;
                      return (
                        <Link
                          key={r.kind}
                          href={`/reports/${r.kind}`}
                          className="group relative flex flex-col rounded-2xl border border-[#e5e5e7] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)]/40 hover:shadow-[0_18px_40px_-24px_rgba(15,27,66,0.45)]"
                        >
                          <div className="flex items-start justify-between">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: "var(--brand)" }}>
                              <Icon size={18} strokeWidth={2} />
                            </span>
                            <ArrowUpRight size={16} className="text-[#c4c4c8] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </div>
                          <h3 className="mt-4 text-[15px] font-semibold leading-tight text-[#0a0a0a]">{r.title}</h3>
                          {r.formReference && <p className="mt-0.5 text-[11px] font-medium text-[var(--brand)]">{r.formReference}</p>}
                          <p className="mt-2 flex-1 text-[12.5px] leading-snug text-[#5c5c63]">{r.summary}</p>
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {r.useFor.map((u) => (
                              <span key={u} className="rounded-md bg-[#f3f3f5] px-2 py-0.5 text-[10.5px] font-medium text-[#5c5c63]">
                                {u}
                              </span>
                            ))}
                          </div>
                          <p className="mt-4 text-[10.5px] text-[#a3a3a3]">
                            {r.takesPeriod ? `Default period: ${PRESETS.find((p) => p.id === r.defaultRange)?.label.toLowerCase() ?? r.defaultRange}` : "As of today — no period"}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── Viewer ─────────────────────────────────────────────────────────────────

function parseSelection(search: string, fallback: string): PeriodSelection {
  const q = new URLSearchParams(search);
  const from = q.get("from");
  const to = q.get("to");
  if (from && to) return { from, to };
  return { preset: q.get("preset") ?? fallback };
}

function ReportSwitcher({ current, reports }: { current: ReportCatalogEntry; reports: ReportCatalogEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const Icon = ICONS[current.kind] ?? BarChart3;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-xl bg-[var(--brand)] py-1.5 pl-3 pr-2.5 text-white shadow-sm">
        <Icon size={13} className="text-white/70" />
        <span className="text-left">
          <span className="block text-[11.5px] font-semibold leading-tight">{current.title}</span>
          <span className="hidden text-[9.5px] leading-none text-white/50 xl:block">{current.formReference ?? current.group}</span>
        </span>
        <ChevronDown size={12} className={`ml-1 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white py-1.5 shadow-2xl">
          {GROUP_ORDER.map((g) => {
            const items = reports.filter((r) => r.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <p className="px-4 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-widest text-[#b0b0b0]">{g}</p>
                {items.map((r) => {
                  const I = ICONS[r.kind] ?? BarChart3;
                  const active = r.kind === current.kind;
                  return (
                    <Link
                      key={r.kind}
                      href={`/reports/${r.kind}`}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2 text-left transition-colors ${active ? "bg-[#f3f4f6]" : "hover:bg-[#f9f8f7]"}`}
                    >
                      <I size={13} className={active ? "text-[var(--brand)]" : "text-[#c3bfba]"} />
                      <span className="flex-1">
                        <span className="block text-xs font-medium text-[#0a0a0a]">{r.title}</span>
                        <span className="block text-[9.5px] text-[#a3a3a3]">{r.formReference ?? r.summary}</span>
                      </span>
                      {active && <Check size={11} className="text-[var(--brand)]" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportMenu({ kind, query, doc, entry }: { kind: ReportKind; query: string; doc: ReportDocument | undefined; entry: ReportCatalogEntry }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const download = (format: string) => {
    const a = document.createElement("a");
    a.href = `/api/reports/${kind}/export?format=${format}&${query}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
    toast.success(`Preparing your ${format.toUpperCase()}…`);
  };

  const wordExport = async (id: string) => {
    if (!doc) return;
    setBusy(id);
    try {
      const month = doc.period?.start.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
      const common = { month, proprietorName: doc.organization.name, dspNumber: doc.organization.dspNumber, address: doc.organization.address };
      if (id === "word-5110") {
        const { export5110Word } = await import("../lib/exportWord");
        await export5110Word({ ...common, summary: doc.extras?.ttb5110 as any });
      } else if (id === "word-5000") {
        const { export5000Word } = await import("../lib/exportWord");
        await export5000Word({ ...common, ein: doc.organization.ein, exciseByProduct: doc.extras?.ttb5000 as any });
      }
      toast.success("Word form downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the Word file");
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  // The Word TTB forms are monthly forms: only offer them for a single calendar month.
  const isSingleMonth = (() => {
    const p = doc?.period;
    if (!p) return false;
    const [y1, m1, d1] = p.start.split("-").map(Number);
    const [y2, m2, d2] = p.end.split("-").map(Number);
    return y1 === y2 && m1 === m2 && d1 === 1 && d2 === new Date(Date.UTC(y2, m2, 0)).getUTCDate();
  })();

  const items: Array<{ id: string; label: string; sub: string; icon: LucideIcon; run: () => void; disabled?: boolean }> = [
    { id: "pdf", label: "PDF", sub: "Print-ready, letter landscape", icon: FileText, run: () => download("pdf") },
    { id: "xlsx", label: "Excel workbook", sub: "One sheet per section, live numbers", icon: FileSpreadsheet, run: () => download("xlsx") },
    { id: "csv", label: "CSV", sub: "Raw values for accounting imports", icon: Table2, run: () => download("csv") },
    ...(entry.extraExports ?? []).map((x) => ({
      id: x.id,
      label: x.label.replace(/^Word — /, ""),
      sub: isSingleMonth ? "Word document, official form layout" : "Pick a single month to fill this form",
      icon: FileType,
      run: () => void wordExport(x.id),
      disabled: !isSingleMonth,
    })),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!doc}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#f7f7f7] disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export
        <ChevronDown size={11} className="text-[#a3a3a3]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white py-1.5 shadow-2xl">
          {items.map((it) => (
            <button key={it.id} onClick={it.run} disabled={it.disabled} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-45">
              <it.icon size={14} className="text-[#737373]" />
              <span>
                <span className="block text-xs font-medium text-[#0a0a0a]">{it.label}</span>
                <span className="block text-[10px] text-[#a3a3a3]">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportView({ kind }: { kind: ReportKind }) {
  const { data: catalog } = useCatalog();
  const [, navigate] = useLocation();
  const search = useSearch();
  const entry = catalog?.reports.find((r) => r.kind === kind);
  const selection = useMemo(() => parseSelection(search, entry?.defaultRange ?? "last-month"), [search, entry?.defaultRange]);
  const query = entry?.takesPeriod ? selectionToQuery(selection) : "";

  const { data: doc, isLoading, isFetching, error } = useQuery<ReportDocument>({
    queryKey: ["/api/reports", kind, query],
    queryFn: () => apiRequest(`/api/reports/${kind}${query ? `?${query}` : ""}`),
    enabled: !!entry,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const setSelection = (next: PeriodSelection) => navigate(`/reports/${kind}?${selectionToQuery(next)}`, { replace: true });

  if (catalog && !entry) {
    return (
      <Layout>
        <div className="p-10 text-sm text-[#737373]">
          That report doesn't exist.{" "}
          <Link href="/reports" className="text-[var(--brand)] underline">
            See all reports
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-full flex-col bg-[#f7f7f8]">
        {/* Toolbar */}
        <div className="report-toolbar sticky top-0 z-30 border-b border-[#e5e5e7] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-3 px-6 py-2.5">
            <Link href="/reports" className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#5c5c63] transition-colors hover:bg-[#f3f3f5] hover:text-[#0a0a0a]">
              <ArrowLeft size={13} /> <span className="hidden sm:inline">All reports</span>
            </Link>
            {entry && catalog && <ReportSwitcher current={entry} reports={catalog.reports} />}
            <div className="hidden h-6 w-px bg-[#e5e5e7] sm:block" />
            {entry?.takesPeriod ? (
              <PeriodControl value={selection} resolved={doc?.period ?? undefined} onChange={setSelection} />
            ) : (
              <span className="text-[11px] italic text-[#a3a3a3]">Snapshot as of today</span>
            )}
            <div className="flex-1" />
            {isFetching && !isLoading && <Loader2 size={13} className="animate-spin text-[#a3a3a3]" />}
            <button onClick={() => window.print()} title="Print" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#5c5c63] hover:bg-[#f7f7f7]">
              <Printer size={13} />
            </button>
            {entry && <ExportMenu kind={kind} query={query} doc={doc} entry={entry} />}
          </div>
        </div>

        <div className="flex-1 px-4 pb-16 pt-6 sm:px-6">
          {error ? (
            <div className="mx-auto max-w-[1120px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{(error as Error).message}</div>
          ) : isLoading || !doc ? (
            <div className="mx-auto max-w-[1120px] animate-pulse rounded-2xl border border-[#e3e3e6] bg-white p-8">
              <div className="h-6 w-1/3 rounded bg-[#eee]" />
              <div className="mt-3 h-3 w-1/4 rounded bg-[#f0f0f0]" />
              <div className="mt-8 grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-[#f3f3f5]" />
                ))}
              </div>
              <div className="mt-8 h-40 rounded-xl bg-[#f6f6f7]" />
            </div>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <ReportDocumentView doc={doc} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function Reports() {
  const [matchKind, params] = useRoute("/reports/:kind");
  if (matchKind && params?.kind) return <ReportView kind={params.kind as ReportKind} />;
  return <ReportsHome />;
}
