import { useState } from "react";
import { AlertTriangle, ChevronDown, HelpCircle } from "lucide-react";
import type { ReportDocument, ReportSection } from "@shared/report-types";
import { formatCell, formatDate, isNumericFormat } from "@shared/report-format";

/* The on-screen rendering of a ReportDocument. The PDF and Excel exports are
   produced from the same document on the server, so this is a faithful preview. */

function Kpis({ doc }: { doc: ReportDocument }) {
  if (!doc.kpis.length) return null;
  return (
    <div className="grid gap-3 border-b border-[#ebebeb] px-8 py-6" style={{ gridTemplateColumns: `repeat(${Math.min(doc.kpis.length, 5)}, minmax(0, 1fr))` }}>
      {doc.kpis.map((k, i) => (
        <div key={i} className="report-kpi relative rounded-xl border border-[#e8e8ea] bg-white px-4 pb-3 pt-4" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-[var(--brand)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a9a9a]">{k.label}</p>
          <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight tabular-nums text-[#0a0a0a]">{formatCell(k.value, k.format)}</p>
          {k.sub && <p className="mt-1.5 text-[11px] text-[#737373]">{k.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function Facts({ section }: { section: ReportSection }) {
  const facts = section.facts ?? [];
  const groups: Array<{ name: string; items: typeof facts }> = [];
  for (const f of facts) {
    const name = f.group ?? "";
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, items: [] };
      groups.push(g);
    }
    g.items.push(f);
  }
  return (
    <div className={`grid gap-x-10 gap-y-4 px-8 pb-5 ${groups.length > 1 ? "md:grid-cols-2" : ""}`}>
      {groups.map((g) => (
        <div key={g.name}>
          {g.name && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">{g.name}</p>}
          <dl>
            {g.items.map((f, i) => {
              const isTotal = f.emphasis && f.sign === "=";
              return (
                <div
                  key={i}
                  className={`flex items-baseline justify-between gap-4 py-[7px] text-[13px] ${
                    isTotal ? "mt-1 border-t-[1.5px] border-[#0a0a0a]" : "border-b border-[#f1f1f1]"
                  }`}
                >
                  <dt className={`flex min-w-0 items-baseline gap-2 ${f.emphasis ? "font-semibold text-[#0a0a0a]" : "text-[#5c5c63]"}`}>
                    {f.sign && <span className="w-3 shrink-0 font-mono text-[12px] text-[#0a0a0a]">{f.sign}</span>}
                    <span className="truncate">{f.label}</span>
                  </dt>
                  <dd className={`shrink-0 tabular-nums ${f.emphasis ? "text-[15px] font-bold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
                    {formatCell(f.value, f.format)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Table({ section }: { section: ReportSection }) {
  const { columns, rows, totals } = section;
  const align = (c: ReportSection["columns"][number]) => c.align ?? (isNumericFormat(c.format) ? "right" : "left");
  const alignClass = (a: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  if (!rows.length) {
    return (
      <div className="mx-8 mb-6 rounded-lg border border-dashed border-[#e3e3e3] bg-[#fafafa] px-4 py-5 text-center text-xs text-[#8a8a8a]">
        {section.emptyHint ?? "No data for this period."}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto px-8 pb-6">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-[#dedee2] bg-[#f6f6f7]">
            {columns.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-[#5c5c63] first:rounded-tl-md last:rounded-tr-md ${alignClass(align(c))}`} title={c.help}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.help && <HelpCircle size={10} className="text-[#b8b8be]" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={`border-b border-[#f0f0f2] ${ri % 2 ? "bg-[#fbfbfc]" : ""} hover:bg-[color-mix(in_srgb,var(--brand)_5%,white)]`}>
              {columns.map((c, ci) => {
                const a = align(c);
                const v = formatCell(r[c.key], c.format);
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-2 align-top ${alignClass(a)} ${a === "right" ? "tabular-nums" : ""} ${
                      ci === 0 ? "font-semibold text-[#0a0a0a]" : "text-[#4a4a50]"
                    } ${c.format === "list" ? "max-w-[280px] font-mono text-[11px] leading-snug" : "whitespace-nowrap"}`}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t-[1.5px] border-[#0a0a0a] bg-[#f6f6f7] font-semibold text-[#0a0a0a]">
              {columns.map((c) => {
                const a = align(c);
                const v = totals[c.key];
                return (
                  <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 ${alignClass(a)} ${a === "right" ? "tabular-nums" : ""}`}>
                    {v == null ? "" : formatCell(v, c.format)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Section({ section, index }: { section: ReportSection; index: number }) {
  return (
    <section className="report-section border-b border-[#ebebeb] last:border-b-0" style={{ animationDelay: `${120 + index * 70}ms` }}>
      <header className="flex items-start gap-3 px-8 pb-3 pt-6">
        {section.tag && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">{section.tag}</span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-[#0a0a0a]">{section.title}</h3>
          {section.description && <p className="mt-1 text-[12px] leading-snug text-[#737373]">{section.description}</p>}
        </div>
      </header>
      {section.facts?.length ? <Facts section={section} /> : null}
      {section.columns.length ? <Table section={section} /> : null}
      {section.notes?.length ? (
        <div className="px-8 pb-5 -mt-2">
          {section.notes.map((n, i) => (
            <p key={i} className="text-[11px] leading-snug text-[#9a9a9a]">
              {n}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ReportDocumentView({ doc }: { doc: ReportDocument }) {
  const [showMethod, setShowMethod] = useState(false);
  const dsp = doc.organization.dspNumber;
  const dspLabel = dsp ? (/^dsp/i.test(dsp) ? dsp : `DSP ${dsp}`) : null;

  return (
    <article className="report-paper mx-auto w-full max-w-[1120px] overflow-hidden rounded-2xl border border-[#e3e3e6] bg-white shadow-[0_30px_60px_-40px_rgba(15,27,66,0.35)]">
      {/* Document header */}
      <header className="relative px-8 pb-5 pt-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            {doc.organization.logoDataUrl && <img src={doc.organization.logoDataUrl} alt="" className="h-10 max-w-[120px] object-contain" />}
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold tracking-tight text-[#0a0a0a]">{doc.organization.name}</p>
              <p className="mt-0.5 text-[12px] text-[#5c5c63]">
                {[dspLabel, doc.organization.ein ? `EIN ${doc.organization.ein}` : null].filter(Boolean).join("  ·  ") || "Add your DSP number under Settings"}
              </p>
              {doc.organization.address && <p className="mt-0.5 text-[11px] text-[#9a9a9a]">{doc.organization.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="report-title text-[26px] font-bold leading-none tracking-tight text-[#0a0a0a]">{doc.title}</h2>
            <p className="mt-2 text-[13px] text-[#5c5c63]">
              {doc.formReference && <span className="font-medium text-[#0a0a0a]">{doc.formReference}</span>}
              {doc.formReference && "  ·  "}
              {doc.period?.label ?? "Point-in-time snapshot"}
            </p>
            <p className="mt-1 text-[11px] text-[#9a9a9a]">Generated {formatDate(doc.generatedAt.slice(0, 10))}</p>
          </div>
        </div>
        <div className="mt-5 h-[3px] w-full rounded-full bg-[var(--brand)]" />
      </header>

      {doc.warnings.length > 0 && (
        <div className="mx-8 mb-2 rounded-xl border border-[#f2dca8] bg-[#fffaec] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#b07a10]" />
            <div className="min-w-0 text-[12px] leading-snug text-[#7a5308]">
              <p className="font-semibold">Before you file</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {doc.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <Kpis doc={doc} />

      {doc.sections.map((s, i) => (
        <Section key={s.id} section={s} index={i} />
      ))}

      {doc.methodology.length > 0 && (
        <footer className="border-t border-[#ebebeb] bg-[#fafafa] px-8 py-4">
          <button onClick={() => setShowMethod((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0a0a0a]">
            <ChevronDown size={13} className={`transition-transform ${showMethod ? "rotate-180" : ""}`} />
            How this report is calculated
          </button>
          {showMethod && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-snug text-[#5c5c63]">
              {doc.methodology.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </footer>
      )}
    </article>
  );
}
