import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Layout } from "./layout";
import { Button } from "./ui/button";

interface Crumb { label: string; href?: string }

interface FormLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs: Crumb[];
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  saveLabel?: string;
  children: ReactNode;
  aside?: ReactNode;
}

export function FormLayout({
  title, subtitle, breadcrumbs, onSave, onCancel, saving, saveLabel = "Save", children, aside,
}: FormLayoutProps) {
  const [, navigate] = useLocation();
  const cancel = onCancel ?? (() => navigate(breadcrumbs[breadcrumbs.length - 2]?.href ?? "/"));

  return (
    <Layout>
      <div className="min-h-screen bg-[#f7f7f7] flex flex-col">
        {/* ── Page header ── */}
        <div className="bg-white border-b border-[#e5e5e5] px-6 py-4 shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-3">
            <button
              onClick={cancel}
              className="flex items-center gap-1 text-[#737373] hover:text-[#0a0a0a] transition-colors"
            >
              <ArrowLeft size={13} />
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={11} className="text-[#d0d0d0]" />}
                {crumb.href && i < breadcrumbs.length - 1 ? (
                  <button
                    onClick={() => navigate(crumb.href!)}
                    className="text-[11px] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-[#0a0a0a]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#0a0a0a]">{title}</h1>
              {subtitle && <p className="text-xs text-[#737373] mt-0.5">{subtitle}</p>}
            </div>
            {/* Header actions — visible on desktop */}
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="outline" onClick={cancel} disabled={saving}>Cancel</Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : saveLabel}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 px-6 py-6">
          {aside ? (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">{children}</div>
              <div className="space-y-5">{aside}</div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">{children}</div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-[#e5e5e5] px-6 py-3 flex items-center justify-end gap-3 shrink-0 sm:hidden">
          <Button variant="outline" onClick={cancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : saveLabel}</Button>
        </div>
      </div>
    </Layout>
  );
}

// ── Reusable form building blocks ──────────────────────────────────────────

export function FormSection({
  title, subtitle, children,
}: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          {title && <p className="text-sm font-semibold text-[#0a0a0a]">{title}</p>}
          {subtitle && <p className="text-xs text-[#737373] mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function FormGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
      {children}
    </div>
  );
}

export function Field({
  label, required, hint, children, span,
}: { label: string; required?: boolean; hint?: string; children: ReactNode; span?: "full" }) {
  return (
    <div className={span === "full" ? "col-span-full" : ""}>
      <label className="block text-xs font-medium text-[#404040] mb-1.5">
        {label}
        {required && <span className="text-[#c9933a] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[#a3a3a3] mt-1">{hint}</p>}
    </div>
  );
}

export function InfoCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#f7f7f7] border border-[#e5e5e5] rounded-xl p-4 text-xs text-[#737373] space-y-2">
      {children}
    </div>
  );
}
