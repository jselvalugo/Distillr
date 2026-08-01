import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Shield, Database, Settings2, AlertTriangle, Download, Upload, Image, User } from "lucide-react";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, getCsrfToken } from "../lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

const NAVY = "#0F1B42";

type PlatformConfig = {
  organizationName: string;
  organizationNameOverride: string | null;
  platformTagline: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  primaryAddress: string;
  timeZone: string;
  logoDataUrl: string | null;
  dspNumber: string | null;
  ein: string | null;
  dashboardColor: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldStatus({ value }: { value: string | null | undefined }) {
  const filled = !!(value?.trim());
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${filled ? "bg-[#22c55e]" : "bg-[#d1d5db]"}`} />
  );
}

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f0f0f0] bg-[#fafafa]">
        <p className="text-sm font-semibold text-[#0a0a0a]">{title}</p>
        {description && <p className="text-xs text-[#737373] mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FormRow({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-2 sm:gap-6 items-start py-3 border-b border-[#f7f7f7] last:border-0">
      <div className="pt-0.5">
        <label className="text-xs font-medium text-[#0a0a0a]">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <p className="text-[10px] text-[#737373] mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const EXPORT_TABLES = [
  { key: "batches",              label: "Production Batches",    desc: "Core batch workflow records",          module: "Production" },
  { key: "production_records",   label: "Production Records",    desc: "Mash & distillation logs",             module: "Production" },
  { key: "inventory_records",    label: "Inventory Records",     desc: "Bottling & inventory",                 module: "Production" },
  { key: "barrels",              label: "Barrels",               desc: "Barrel tracking and aging",            module: "Production" },
  { key: "barrel_events",        label: "Barrel Events",         desc: "Gauge readings, temp & dump records",  module: "Production" },
  { key: "inventory_items",      label: "Inventory Items",       desc: "Item catalog",                         module: "Inventory" },
  { key: "inventory_lots",       label: "Inventory Lots",        desc: "Stock lots",                           module: "Inventory" },
  { key: "inventory_movements",  label: "Inventory Movements",   desc: "Stock movement audit trail",           module: "Inventory" },
  { key: "clients",              label: "Clients",               desc: "Trading partners",                     module: "CRM" },
  { key: "sales_orders",         label: "Sales Orders",          desc: "Orders",                               module: "CRM" },
  { key: "compliance",           label: "Compliance",            desc: "Compliance records",                   module: "Compliance" },
  { key: "ttb_reports",          label: "TTB Reports",           desc: "Regulatory reports",                   module: "Compliance" },
  { key: "permits",              label: "Permits",               desc: "Bond & permit records",                module: "Compliance" },
  { key: "cola_registrations",   label: "COLA Registrations",    desc: "Label approvals",                      module: "Compliance" },
  { key: "state_excise_returns", label: "FL Excise Returns",     desc: "State excise filings",                 module: "Compliance" },
  { key: "properties",           label: "Properties",            desc: "Facilities",                           module: "Organization" },
  { key: "staff",                label: "Staff",                 desc: "Team members",                         module: "Organization" },
  { key: "equipment",            label: "Distillery Equipment",  desc: "Floor plan & still config",            module: "Organization" },
  { key: "label_records",        label: "Label Records",         desc: "Finished goods labels",                module: "Organization" },
  { key: "calculator_presets",   label: "Calculator Presets",    desc: "Saved calculator configs",             module: "System" },
  { key: "audit_logs",           label: "Audit Log",             desc: "System audit trail (read-only)",       module: "System" },
];

const MODULE_ORDER = ["Production", "Inventory", "CRM", "Compliance", "Organization", "System"];

function downloadCSV(tableKey: string) {
  const a = document.createElement("a");
  a.href = `/api/export/${tableKey}`;
  a.download = `${tableKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Organization Tab ─────────────────────────────────────────────────────────

function OrganizationTab({ config }: { config: PlatformConfig | undefined }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    organizationName: config?.organizationName ?? "",
    organizationNameOverride: config?.organizationNameOverride ?? "",
    platformTagline: config?.platformTagline ?? "",
    supportEmail: config?.supportEmail ?? "",
    supportPhone: config?.supportPhone ?? "",
    website: config?.website ?? "",
    primaryAddress: config?.primaryAddress ?? "",
    timeZone: config?.timeZone ?? "",
  });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest<PlatformConfig>("/api/platform-config", {
        method: "PATCH",
        body: JSON.stringify({
          organizationName: form.organizationName,
          organizationNameOverride: form.organizationNameOverride || null,
          platformTagline: form.platformTagline,
          supportEmail: form.supportEmail,
          supportPhone: form.supportPhone,
          website: form.website,
          primaryAddress: form.primaryAddress,
          timeZone: form.timeZone,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const configured = [
    form.organizationName, form.supportEmail, form.primaryAddress, form.timeZone
  ].filter(Boolean).length;

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-3xl">
      {/* Completion status */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#e5e5e5] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="text-xs text-[#737373]">Configuration completeness</div>
          <div className="flex gap-1">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-1.5 w-8 rounded-full ${i <= configured ? "bg-[#22c55e]" : "bg-[#e5e5e5]"}`} />
            ))}
          </div>
          <span className="text-xs font-medium text-[#0a0a0a]">{configured}/4 required fields</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-[#22c55e] font-medium">Saved</span>}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <SectionCard title="Legal Entity" description="Primary legal name used in all official documents, TTB filings, and regulatory submissions.">
        <FormRow label="Organization Name" required hint="Exact legal name as registered with TTB and state regulators.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.organizationName} />
            <Input value={form.organizationName} onChange={set("organizationName")} placeholder="e.g. Lugo's Craft Distillery LLC" className="flex-1" />
          </div>
        </FormRow>
        <FormRow label="DBA / Trade Name" hint="Doing-business-as name if different from legal name. Appears on labels and marketing.">
          <Input value={form.organizationNameOverride} onChange={set("organizationNameOverride")} placeholder="e.g. Lugo's Craft Spirits" />
        </FormRow>
        <FormRow label="Tagline" hint="Short descriptor shown in the app header and exported documents.">
          <Input value={form.platformTagline} onChange={set("platformTagline")} placeholder="e.g. Distillery operations and compliance" />
        </FormRow>
      </SectionCard>

      <SectionCard title="Contact Information" description="Primary contact details for operations, compliance correspondence, and customer communications.">
        <FormRow label="Operations Email" required hint="Used in TTB correspondence and compliance records.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.supportEmail} />
            <Input value={form.supportEmail} onChange={set("supportEmail")} type="email" placeholder="e.g. ops@lugoscraftdistillery.com" className="flex-1" />
          </div>
        </FormRow>
        <FormRow label="Phone Number" hint="Primary operations phone. Included in compliance documents.">
          <Input value={form.supportPhone} onChange={set("supportPhone")} type="tel" placeholder="e.g. (787) 555-0100" />
        </FormRow>
        <FormRow label="Website" hint="Distillery website URL.">
          <Input value={form.website} onChange={set("website")} type="url" placeholder="e.g. https://www.lugoscraftdistillery.com" />
        </FormRow>
      </SectionCard>

      <SectionCard title="Facility & Operations" description="Physical location and operational configuration.">
        <FormRow label="Primary Address" required hint="Registered distillery address used on TTB filings and state permits.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.primaryAddress} />
            <Input value={form.primaryAddress} onChange={set("primaryAddress")} placeholder="e.g. 123 Calle Principal, Bayamón, PR 00961" className="flex-1" />
          </div>
        </FormRow>
        <FormRow label="Time Zone" required hint="IANA timezone identifier — used for report timestamps and scheduling.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.timeZone} />
            <Input value={form.timeZone} onChange={set("timeZone")} placeholder="e.g. America/Puerto_Rico" className="flex-1" />
          </div>
        </FormRow>
      </SectionCard>
    </div>
  );
}

// ─── Branding Tab ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: "Navy",      hex: "#0F1B42" },
  { label: "Midnight",  hex: "#0a0a0a" },
  { label: "Slate",     hex: "#1e293b" },
  { label: "Indigo",    hex: "#312e81" },
  { label: "Forest",    hex: "#14532d" },
  { label: "Copper",    hex: "#7c2d12" },
  { label: "Crimson",   hex: "#7f1d1d" },
  { label: "Graphite",  hex: "#374151" },
];

function isValidHex(v: string) { return /^#[0-9a-fA-F]{6}$/.test(v); }

function BrandingTab({ config }: { config: PlatformConfig | undefined }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const currentColor = config?.dashboardColor ?? "#0F1B42";
  const [colorInput, setColorInput] = useState(currentColor);
  const [colorSaved, setColorSaved] = useState(false);

  const logoMut = useMutation({
    mutationFn: (body: { logoDataUrl: string }) =>
      apiRequest<PlatformConfig>("/api/platform-config", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setPreview(null); setPendingDataUrl(null);
      toast.success("Logo saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const colorMut = useMutation({
    mutationFn: (dashboardColor: string) =>
      apiRequest<PlatformConfig>("/api/platform-config", { method: "PATCH", body: JSON.stringify({ dashboardColor }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setColorSaved(true);
      setTimeout(() => setColorSaved(false), 2500);
      toast.success("Dashboard color updated — reload to see changes");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () => apiRequest<{ success: boolean }>("/api/platform-config/logo", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      toast.success("Logo removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleFile(file: File) {
    if (file.size > 512 * 1024) { toast.error("File too large — maximum 512 KB"); return; }
    const reader = new FileReader();
    reader.onload = () => { const d = reader.result as string; setPreview(d); setPendingDataUrl(d); };
    reader.readAsDataURL(file);
  }

  const currentLogo = config?.logoDataUrl;
  const previewColor = isValidHex(colorInput) ? colorInput : currentColor;

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-3xl">

      {/* Dashboard Color */}
      <SectionCard title="Dashboard Color" description="Primary color used for the dashboard nav bar, hero, and accents. Enter a hex code or choose a preset.">
        <div className="space-y-5">
          {/* Preview strip */}
          <div className="rounded-xl overflow-hidden border border-[#e5e5e5]">
            <div style={{ background: previewColor, height: 56 }} className="flex items-center px-4 gap-3">
              <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 18, color: "rgba(250,240,226,0.9)" }}>Distillr</span>
              <div className="flex-1" />
              <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="w-5 h-5 rounded-full bg-white/20" />)}
              </div>
            </div>
            <div className="px-4 py-2 bg-[#f9fafb] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: previewColor }} />
              <span className="text-[10px] text-[#737373] font-medium">Preview</span>
            </div>
          </div>

          {/* Hex input */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <input
                type="color"
                value={isValidHex(colorInput) ? colorInput : "#0F1B42"}
                onChange={(e) => setColorInput(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                title="Pick a color"
              />
              <div className="w-9 h-9 rounded-lg border border-[#e5e5e5] shadow-sm cursor-pointer" style={{ background: previewColor }} />
            </div>
            <Input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value)}
              placeholder="#0F1B42"
              className="font-mono w-32"
              maxLength={7}
            />
            <div className="flex items-center gap-2 ml-auto">
              {colorSaved && <span className="text-xs text-[#22c55e] font-medium">Saved</span>}
              <Button
                size="sm"
                disabled={!isValidHex(colorInput) || colorMut.isPending}
                onClick={() => colorMut.mutate(colorInput)}
              >
                {colorMut.isPending ? "Saving…" : "Apply Color"}
              </Button>
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-2">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(p => (
                <button
                  key={p.hex}
                  onClick={() => setColorInput(p.hex)}
                  title={p.label}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    colorInput === p.hex ? "border-[#0F1B42] bg-[#0F1B42]/5 text-[#0F1B42]" : "border-[#e5e5e5] text-[#525252] hover:border-[#d0d0d0]"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-sm" style={{ background: p.hex }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Logo */}
      <SectionCard title="Distillery Logo" description="Appears in the navigation bar, exported reports, and Word documents. PNG or SVG recommended.">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-3">Current Logo</p>
            {currentLogo ? (
              <div className="flex items-center gap-4">
                <div className="h-16 w-44 flex items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] p-2">
                  <img src={currentLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#22c55e] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> Logo active
                  </span>
                  <Button variant="outline" size="sm"
                    onClick={() => removeMut.mutate()} disabled={removeMut.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50">
                    {removeMut.isPending ? "Removing…" : "Remove"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 h-16 rounded-lg border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-4">
                <Image size={16} className="text-[#a3a3a3]" />
                <span className="text-xs text-[#a3a3a3]">No logo configured</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-3">
              {currentLogo ? "Replace Logo" : "Upload Logo"}
            </p>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-[#0F1B42] bg-[#0F1B42]/5"
                : preview ? "border-[#22c55e]/40 bg-green-50/30"
                : "border-[#e5e5e5] hover:border-[#0F1B42]/30"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {preview ? (
                <div className="space-y-2">
                  <img src={preview} alt="Preview" className="max-h-14 mx-auto object-contain" />
                  <p className="text-xs text-[#737373]">Click to choose a different file</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Image size={20} className="mx-auto text-[#a3a3a3] mb-2" />
                  <p className="text-sm font-medium text-[#737373]">Drop your logo here or click to browse</p>
                  <p className="text-xs text-[#a3a3a3]">PNG, JPG, SVG, WebP — max 512 KB</p>
                </div>
              )}
            </div>
            {preview && (
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={() => { if (pendingDataUrl) logoMut.mutate({ logoDataUrl: pendingDataUrl }); }} disabled={logoMut.isPending}>
                  {logoMut.isPending ? "Saving…" : "Save Logo"}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setPendingDataUrl(null); }}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Regulatory Tab ───────────────────────────────────────────────────────────

function RegulatoryTab({ config }: { config: PlatformConfig | undefined }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ dspNumber: config?.dspNumber ?? "", ein: config?.ein ?? "" });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value })); setSaved(false);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest<PlatformConfig>("/api/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ dspNumber: form.dspNumber || null, ein: form.ein || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-3xl">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#e5e5e5] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            form.dspNumber ? "bg-[#22c55e]/10 text-[#15803d]" : "bg-amber-50 text-amber-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${form.dspNumber ? "bg-[#22c55e]" : "bg-amber-400"}`} />
            {form.dspNumber ? "DSP registered" : "DSP number missing"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-[#22c55e] font-medium">Saved</span>}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <SectionCard title="TTB Distilled Spirits Plant" description="Federal registration details required on all TTB filings, monthly production reports, and COLA applications.">
        <FormRow label="DSP Permit Number" required hint="Distilled Spirits Plant permit (27 CFR § 19.91). Format: DSP-XX-NNNNN. Required on all TTB submissions.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.dspNumber} />
            <Input value={form.dspNumber} onChange={set("dspNumber")} placeholder="e.g. DSP-PR-20001" className="flex-1 font-mono" />
          </div>
        </FormRow>
        <FormRow label="Employer Identification Number (EIN)" hint="Federal tax ID used on TTB Form 5000.24 and IRS filings. Format: XX-XXXXXXX.">
          <div className="flex items-center gap-2">
            <FieldStatus value={form.ein} />
            <Input value={form.ein} onChange={set("ein")} placeholder="e.g. 66-1234567" className="flex-1 font-mono" />
          </div>
        </FormRow>
        <FormRow label="Permit Class" hint="Your DSP classification determines applicable regulations and production limits.">
          <div className="rounded-lg bg-[#f7f7f7] border border-[#e5e5e5] px-3 py-2 text-xs text-[#737373]">
            Craft Distiller — consult 27 CFR Part 19 for applicable limits
          </div>
        </FormRow>
      </SectionCard>

      <SectionCard title="Federal Reporting Standards" description="Reference values used in proof gallon and excise tax calculations across all production records.">
        <div className="space-y-0">
          {[
            { label: "Proof Gallon Definition", value: "1 wine gallon of spirits at 50% ABV (100 proof)", ref: "27 CFR § 19.1" },
            { label: "US Gallon (Wine Gallon)", value: "Federal reporting unit — actual liquid volume", ref: "Federal TTB" },
            { label: "Proof Gallon Calculation", value: "US Gallons × (ABV% / 50)", ref: "State excise" },
            { label: "Craft Tier 1 Rate", value: "$2.70 per proof gallon (≤100,000 PG/year)", ref: "26 USC § 5001" },
            { label: "Craft Tier 2 Rate", value: "$13.34 per proof gallon (100,001–22.1M PG)", ref: "26 USC § 5001" },
            { label: "Standard Rate", value: "$13.50 per proof gallon", ref: "26 USC § 5001" },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-start py-2.5 border-b border-[#f0f0f0] last:border-0">
              <div>
                <p className="text-xs font-medium text-[#0a0a0a]">{row.label}</p>
                <p className="text-[10px] text-[#a3a3a3] mt-0.5 font-mono">{row.ref}</p>
              </div>
              <p className="text-xs text-[#737373] text-right max-w-[240px]">{row.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Bottle Standards" description="Bottle size and case configuration used in proof gallon and inventory calculations.">
        <div className="space-y-0">
          {[
            { size: "750 mL", bottlesPerCase: 6, galPerCase: "1.1888", usePg: "galPerCase × proof / 100" },
            { size: "1 L",    bottlesPerCase: 6, galPerCase: "1.5850", usePg: "galPerCase × proof / 100" },
            { size: "1.75 L", bottlesPerCase: 6, galPerCase: "2.7738", usePg: "galPerCase × proof / 100" },
          ].map(row => (
            <div key={row.size} className="flex justify-between items-center py-2.5 border-b border-[#f0f0f0] last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs font-mono font-semibold text-[#0a0a0a]">{row.size}</span>
                <span className="text-xs text-[#737373]">{row.bottlesPerCase} bottles/case · {row.galPerCase} US gal/case</span>
              </div>
              <span className="text-[10px] text-[#a3a3a3] font-mono">{row.usePg}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const { data: counts } = useQuery<Record<string, number>>({
    queryKey: ["/api/export/counts"],
    queryFn: () => apiRequest<Record<string, number>>("/api/export/counts"),
    staleTime: 30_000,
  });

  function downloadAll() {
    const a = document.createElement("a");
    a.href = "/api/export/all.xlsx";
    a.download = `distillr-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const grouped = MODULE_ORDER.map(mod => ({
    module: mod,
    tables: EXPORT_TABLES.filter(t => t.module === mod),
  }));

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#e5e5e5] px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Data Export</p>
          <p className="text-xs text-[#737373] mt-0.5">Download any module as CSV or export the full dataset as Excel.</p>
        </div>
        <Button onClick={downloadAll}>
          <Download size={13} className="mr-1.5" /> Export All as Excel
        </Button>
      </div>

      {grouped.map(({ module, tables }) => (
        <SectionCard key={module} title={module} description={`${tables.length} table${tables.length !== 1 ? "s" : ""}`}>
          <div className="space-y-0 -mx-1">
            {tables.map(t => (
              <div key={t.key} className="flex items-center justify-between px-1 py-2 rounded-lg hover:bg-[#f7f7f7] transition-colors group">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#0a0a0a]">{t.label}</p>
                    <p className="text-[10px] text-[#737373]">{t.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-[#737373] min-w-[40px] text-right">
                    {counts ? (counts[t.key] ?? 0).toLocaleString() : "—"}
                    <span className="text-[10px] text-[#a3a3a3] ml-1">rows</span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => downloadCSV(t.key)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download size={11} className="mr-1" /> CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

type ImportRowResult = { sheet: string; table: string; inserted: number; updated: number; skipped: number; errors: string[] };
type ExciseRecord = { month: string; productName: string; abv: number; distCases: number; retailCases: number; totalCases: number; proofGallons: number; exciseTax: number };

const EXCISE_MONTH_MAP: Record<string, string> = {
  January:"01", February:"02", March:"03", April:"04", May:"05", June:"06",
  July:"07", August:"08", September:"09", October:"10", November:"11", December:"12",
};

async function parseExciseExcel(file: File): Promise<ExciseRecord[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const records: ExciseRecord[] = [];
  for (const ws of wb.worksheets) {
    const sheetName = ws.name.trim();
    if (sheetName === "Sheet1") continue;
    const parts = sheetName.split(" ");
    if (parts.length !== 2) continue;
    const monthNum = EXCISE_MONTH_MAP[parts[0]];
    if (!monthNum) continue;
    const month = `${parts[1]}-${monthNum}`;
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const rawName = String(row.getCell(1).value ?? "").trim();
      if (!rawName || rawName.toLowerCase().startsWith("total")) return;
      const distCases = Number(row.getCell(2).value ?? 0) || 0;
      const retailCases = Number(row.getCell(3).value ?? 0) || 0;
      const totalCases = Number(row.getCell(4).value ?? 0) || 0;
      const abv = Number(row.getCell(5).value ?? 0) || 0;
      const proofGallons = Number(row.getCell(6).value ?? 0) || 0;
      const exciseTax = Number(row.getCell(7).value ?? 0) || 0;
      if (totalCases === 0) return;
      records.push({ month, productName: rawName, abv, distCases, retailCases, totalCases, proofGallons, exciseTax });
    });
  }
  return records;
}

function ExciseImportCard() {
  const exciseRef = useRef<HTMLInputElement>(null);
  const [exciseFile, setExciseFile] = useState<File | null>(null);
  const [excisePreview, setExcisePreview] = useState<ExciseRecord[] | null>(null);
  const [exciseImporting, setExciseImporting] = useState(false);
  const [exciseResult, setExciseResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  async function handleExciseFile(f: File) {
    if (!f.name.endsWith(".xlsx")) { toast.error("Please upload an .xlsx file"); return; }
    setExciseFile(f); setExciseResult(null);
    try { setExcisePreview(await parseExciseExcel(f)); }
    catch (e: any) { toast.error("Failed to parse file: " + e.message); }
  }

  async function runExciseImport() {
    if (!excisePreview) return;
    setExciseImporting(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/admin/import-excise-product-data", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ records: excisePreview }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setExciseResult(json);
      toast.success(`Excise import complete — ${json.inserted} inserted, ${json.updated} updated`);
    } catch (e: any) { toast.error(e.message || "Import failed"); }
    finally { setExciseImporting(false); }
  }

  const byMonth: Record<string, number> = {};
  for (const r of excisePreview ?? []) byMonth[r.month] = (byMonth[r.month] ?? 0) + 1;

  return (
    <SectionCard title="Excise Tax Import" description="Upload your monthly excise tax Excel file. Each sheet is one month — rows with zero cases are skipped.">
      {!exciseResult ? (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-[#e5e5e5] rounded-xl p-8 text-center cursor-pointer hover:border-[#0a0a0a]/30 transition-colors"
            onClick={() => exciseRef.current?.click()}
          >
            <input ref={exciseRef} type="file" accept=".xlsx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExciseFile(f); }} />
            {exciseFile ? (
              <div>
                <p className="text-sm font-medium text-[#0a0a0a]">{exciseFile.name}</p>
                <p className="text-xs text-[#737373] mt-0.5">
                  {Object.keys(byMonth).length} months · {excisePreview?.length ?? 0} products — click to change
                </p>
              </div>
            ) : (
              <div>
                <Upload size={18} className="mx-auto text-[#a3a3a3] mb-2" />
                <p className="text-sm text-[#737373]">Drop Excise Tax .xlsx here or click to browse</p>
              </div>
            )}
          </div>
          {excisePreview && excisePreview.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373]">Months detected</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, count]) => (
                  <span key={month} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f0f0] text-[11px] font-medium text-[#0a0a0a]">
                    {new Date(month + "-02").toLocaleString("en-US",{month:"short",year:"numeric"})}
                    <span className="text-[#737373]">· {count}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={runExciseImport} disabled={exciseImporting}>
                  {exciseImporting ? "Importing…" : `Import ${excisePreview.length} Records`}
                </Button>
                <Button variant="outline" onClick={() => { setExciseFile(null); setExcisePreview(null); }}>Clear</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[#15803d]">{exciseResult.inserted}</p>
              <p className="text-xs text-[#16a34a] mt-0.5">Inserted</p>
            </div>
            <div className="rounded-lg bg-[#eff6ff] border border-[#bfdbfe] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[#1d4ed8]">{exciseResult.updated}</p>
              <p className="text-xs text-[#2563eb] mt-0.5">Updated</p>
            </div>
            <div className="rounded-lg bg-[#f7f7f7] border border-[#e5e5e5] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[#737373]">{exciseResult.skipped}</p>
              <p className="text-xs text-[#a3a3a3] mt-0.5">Skipped</p>
            </div>
          </div>
          <p className="text-xs text-[#737373]">Data is now visible in Production and Reports → Excise Tax Return for each imported month.</p>
          <Button variant="outline" size="sm" onClick={() => { setExciseFile(null); setExcisePreview(null); setExciseResult(null); }}>
            Import Another File
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f: File) {
    if (!f.name.endsWith(".xlsx")) { toast.error("Please upload an .xlsx file"); return; }
    setFile(f); setResults(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, []);

  async function runImport() {
    if (!file) return;
    setImporting(true);
    try {
      const csrfToken = await getCsrfToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST", credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResults(json.results);
      const total = json.results.reduce((s: number, r: ImportRowResult) => s + r.inserted, 0);
      toast.success(`Import complete — ${total} records inserted`);
    } catch (e: any) { toast.error(e.message || "Import failed"); }
    finally { setImporting(false); }
  }

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-3xl">
      <ExciseImportCard />

      <SectionCard title="Full Data Import" description="Upload the exported Excel template to bulk-import data. Rows with existing IDs are updated; new rows are inserted.">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/api/export/template.xlsx"; }}>
              <Download size={12} className="mr-1.5" /> Download Template
            </Button>
          </div>
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? "border-[var(--brand)] bg-[#0a0a0a]/5" : "border-[#e5e5e5] hover:border-[#0a0a0a]/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#0a0a0a]">{file.name}</p>
                <p className="text-xs text-[#737373]">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </div>
            ) : (
              <div>
                <Upload size={18} className="mx-auto text-[#a3a3a3] mb-2" />
                <p className="text-sm font-medium text-[#737373]">Drop your Excel file here or click to browse</p>
                <p className="text-xs text-[#a3a3a3] mt-1">Only .xlsx files — max 20 MB</p>
              </div>
            )}
          </div>
          {file && !results && (
            <div className="flex items-center gap-2">
              <Button onClick={runImport} disabled={importing}>
                {importing ? "Importing…" : "Import Data"}
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setResults(null); }}>Clear</Button>
            </div>
          )}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Import Results</p>
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setResults(null); }}>Import Another</Button>
              </div>
              <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                      {["Sheet","Inserted","Updated","Skipped","Notes"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#737373] uppercase tracking-wider first:text-left last:text-left text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {results.map(r => (
                      <tr key={r.sheet} className="hover:bg-[#fafafa]">
                        <td className="px-4 py-3 text-xs font-medium text-[#0a0a0a]">{r.sheet}</td>
                        <td className="px-4 py-3 text-xs text-right text-[#22c55e] font-medium">{r.inserted || "—"}</td>
                        <td className="px-4 py-3 text-xs text-right text-[#3b82f6] font-medium">{r.updated || "—"}</td>
                        <td className="px-4 py-3 text-xs text-right text-[#737373]">{r.skipped || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#737373]">
                          {r.errors.length > 0
                            ? <span className="text-red-600">{r.errors[0]}{r.errors.length > 1 ? ` (+${r.errors.length - 1} more)` : ""}</span>
                            : r.table === "—" ? <span className="text-amber-600">Unknown sheet</span>
                            : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab({ user }: { user: { email: string; role: string } | null }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const PHRASE = "delete all data";

  const resetMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/reset-all-data", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries(); setConfirm(""); setDone(true); toast.success("All operational data has been cleared."); },
    onError: (e: any) => toast.error(e.message ?? "Reset failed"),
  });

  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-3xl">
      <SectionCard title="Account & Session" description="Current session information.">
        <div className="space-y-0">
          {[
            { label: "Email", value: user?.email ?? "—" },
            { label: "Role", value: user?.role ?? "—" },
            { label: "Platform", value: "Distillr ERP" },
            { label: "Session", value: "Active" },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-[#f0f0f0] last:border-0">
              <span className="text-xs text-[#737373]">{row.label}</span>
              <span className="text-xs font-medium text-[#0a0a0a]">{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50/60 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Reset All Operational Data</p>
            <p className="text-xs text-red-600/80 mt-0.5">
              Permanently deletes all batches, barrels, inventory, sales orders, compliance records, staff, and reports.
              Your account, settings, and branding are preserved.
            </p>
          </div>
        </div>
        <div className="p-5">
          {done ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 font-medium">
              System cleared — you can start fresh.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#737373]">
                Type <span className="font-mono font-semibold text-red-600">{PHRASE}</span> to confirm:
              </p>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={PHRASE}
                className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#d4d4d4] focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
              />
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600 w-full"
                disabled={confirm !== PHRASE || resetMut.isPending}
                onClick={() => resetMut.mutate()}
              >
                {resetMut.isPending ? "Clearing…" : "Clear All Data"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

type Tab = "org-info" | "branding" | "regulatory" | "export" | "import" | "system";

const NAV_GROUPS = [
  {
    group: "Organization",
    icon: Building2,
    items: [
      { key: "org-info" as Tab, label: "Company Info" },
      { key: "branding" as Tab, label: "Branding" },
    ],
  },
  {
    group: "Regulatory",
    icon: Shield,
    items: [
      { key: "regulatory" as Tab, label: "TTB & Standards" },
    ],
  },
  {
    group: "Data Management",
    icon: Database,
    items: [
      { key: "export" as Tab, label: "Export" },
      { key: "import" as Tab, label: "Import" },
    ],
  },
  {
    group: "System",
    icon: Settings2,
    items: [
      { key: "system" as Tab, label: "Account & System" },
    ],
  },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("org-info");

  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest<PlatformConfig>("/api/platform-config"),
    staleTime: 60_000,
  });

  if (user && user.role !== "admin") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-4">
          <p className="text-sm font-semibold text-[#0a0a0a]">Admin Access Required</p>
          <p className="text-xs text-[#737373] max-w-xs">Settings are only available to administrators.</p>
        </div>
      </Layout>
    );
  }

  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === tab)?.label ?? "";

  return (
    <Layout>
      <PageHeader title="Settings" subtitle="Platform configuration — Admin only" />
      <div className="flex" style={{ minHeight: "calc(100vh - 8rem)" }}>

        {/* Sidebar */}
        <aside className="w-52 border-r border-[#e5e5e5] bg-white shrink-0 p-3 space-y-4">
          {NAV_GROUPS.map(({ group, icon: Icon, items }) => (
            <div key={group}>
              <div className="flex items-center gap-1.5 px-2 mb-1">
                <Icon size={11} className="text-[#a3a3a3]" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3]">{group}</p>
              </div>
              {items.map(item => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    tab === item.key
                      ? "text-white font-medium"
                      : "text-[#525252] hover:text-[#0a0a0a] hover:bg-[#f0f0f0]"
                  }`}
                  style={tab === item.key ? { background: NAVY } : {}}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 bg-[#f7f7f7] overflow-auto">
          {/* Breadcrumb */}
          <div className="px-5 sm:px-8 pt-4 pb-0">
            <p className="text-[10px] text-[#a3a3a3] uppercase tracking-widest font-medium">
              Settings · {activeLabel}
            </p>
          </div>

          {tab === "org-info"    && <OrganizationTab config={config} />}
          {tab === "branding"    && <BrandingTab config={config} />}
          {tab === "regulatory"  && <RegulatoryTab config={config} />}
          {tab === "export"      && <ExportTab />}
          {tab === "import"      && <ImportTab />}
          {tab === "system"      && <SystemTab user={user} />}
        </div>
      </div>
    </Layout>
  );
}
