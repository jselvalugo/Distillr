import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../hooks/use-auth";
import { apiRequest, getCsrfToken } from "../lib/queryClient";

type PlatformConfig = {
  organizationName: string;
  organizationNameOverride: string | null;
  platformTagline: string;
  supportEmail: string;
  timeZone: string;
  logoDataUrl: string | null;
  dspNumber: string | null;
};

const EXPORT_TABLES = [
  { key: "batches", label: "Production Batches", desc: "Core batch workflow records" },
  { key: "barrels", label: "Barrels", desc: "Barrel tracking and aging" },
  { key: "barrel_events", label: "Barrel Events", desc: "Gauge readings, temperature & dump records" },
  { key: "production_records", label: "Production Records", desc: "Mash & distillation logs" },
  { key: "inventory_records", label: "Inventory Records", desc: "Bottling & inventory" },
  { key: "inventory_items", label: "Inventory Items", desc: "Item catalog" },
  { key: "inventory_lots", label: "Inventory Lots", desc: "Stock lots" },
  { key: "inventory_movements", label: "Inventory Movements", desc: "Stock movement audit trail" },
  { key: "compliance", label: "Compliance", desc: "Compliance records" },
  { key: "clients", label: "Clients", desc: "Trading partners" },
  { key: "properties", label: "Properties", desc: "Facilities" },
  { key: "sales_orders", label: "Sales Orders", desc: "Orders" },
  { key: "staff", label: "Staff", desc: "Team members" },
  { key: "ttb_reports", label: "TTB Reports", desc: "Regulatory reports" },
  { key: "audit_logs", label: "Audit Log", desc: "System audit trail (read-only)" },
  { key: "permits", label: "Permits", desc: "Bond & permit records" },
  { key: "cola_registrations", label: "COLA Registrations", desc: "Label approvals" },
  { key: "label_records", label: "Label Records", desc: "Finished goods labels" },
  { key: "state_excise_returns", label: "FL Excise Returns", desc: "State excise filings" },
  { key: "equipment", label: "Distillery Equipment", desc: "Floor plan equipment & still configuration" },
  { key: "calculator_presets", label: "Calculator Presets", desc: "Saved calculator configurations" },
];

type Tab = "branding" | "export" | "import" | "platform" | "danger";

function downloadCSV(tableKey: string) {
  const a = document.createElement("a");
  a.href = `/api/export/${tableKey}`;
  a.download = `${tableKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function BrandingTab({ config }: { config: PlatformConfig | undefined }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [orgNameInput, setOrgNameInput] = useState(config?.organizationNameOverride ?? "");

  const saveMut = useMutation({
    mutationFn: (body: { logoDataUrl?: string; organizationName?: string }) =>
      apiRequest<PlatformConfig>("/api/platform-config", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>("/api/platform-config/logo", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setPreview(null);
      setPendingDataUrl(null);
      toast.success("Logo removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error("File too large — maximum 512 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setPendingDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Current Logo */}
      <div>
        <h3 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-3">
          Current Logo
        </h3>
        <div className="border border-[#e5e5e5] rounded-md p-4 bg-white flex items-center gap-4">
          {config?.logoDataUrl ? (
            <>
              <img
                src={config.logoDataUrl}
                alt="Logo"
                className="max-h-16 object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeMut.mutate()}
                disabled={removeMut.isPending}
              >
                Remove Logo
              </Button>
            </>
          ) : (
            <span className="text-xs text-[#737373]">No logo uploaded</span>
          )}
        </div>
      </div>

      {/* Upload New Logo */}
      <div>
        <h3 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-3">
          Upload New Logo
        </h3>
        <div className="border border-[#e5e5e5] rounded-md p-4 bg-white space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Choose File
            </Button>
            <span className="text-xs text-[#737373]">Max 512 KB. PNG, JPG, SVG, or WebP.</span>
          </div>
          {preview && (
            <div className="space-y-2">
              <p className="text-xs text-[#737373]">Preview:</p>
              <img src={preview} alt="Preview" className="max-h-16 object-contain" />
              <Button
                size="sm"
                onClick={() => {
                  if (pendingDataUrl) saveMut.mutate({ logoDataUrl: pendingDataUrl });
                }}
                disabled={saveMut.isPending}
              >
                Save Logo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Organization Name */}
      <div>
        <h3 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-3">
          Organization Name
        </h3>
        <div className="border border-[#e5e5e5] rounded-md p-4 bg-white space-y-3">
          <p className="text-xs text-[#737373]">
            Override the name displayed in the navigation bar.
          </p>
          <div className="flex items-center gap-3 max-w-sm">
            <Input
              value={orgNameInput}
              onChange={(e) => setOrgNameInput(e.target.value)}
              placeholder="Your Distillery Name"
            />
            <Button
              size="sm"
              onClick={() => saveMut.mutate({ organizationName: orgNameInput })}
              disabled={saveMut.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Export Data</h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Download any table as CSV. Use the same column headers for mass import.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadAll}>
          Download All as Excel
        </Button>
      </div>

      <div className="border border-[#e5e5e5] rounded-md bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">
                Table
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">
                Description
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">
                Rows
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {EXPORT_TABLES.map((t, i) => (
              <tr
                key={t.key}
                className={i < EXPORT_TABLES.length - 1 ? "border-b border-[#e5e5e5]" : ""}
              >
                <td className="px-4 py-3 text-xs font-medium text-[#0a0a0a]">{t.label}</td>
                <td className="px-4 py-3 text-xs text-[#737373]">{t.desc}</td>
                <td className="px-4 py-3 text-xs text-right text-[#737373]">
                  {counts ? (counts[t.key] ?? 0) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => downloadCSV(t.key)}>
                    Download CSV
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformTab({ config }: { config: PlatformConfig | undefined }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    organizationName: config?.organizationName ?? "",
    tagline: config?.platformTagline ?? "",
    supportEmail: config?.supportEmail ?? "",
    timeZone: config?.timeZone ?? "",
    dspNumber: config?.dspNumber ?? "",
  });

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest<PlatformConfig>("/api/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ organizationName: form.organizationName, dspNumber: form.dspNumber || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/platform-config"] });
      toast.success("Platform settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[#0a0a0a]">Platform Settings</h3>
      <div className="border border-[#e5e5e5] rounded-md p-4 bg-white space-y-4 max-w-md">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#737373]">Organization Name</label>
          <Input
            value={form.organizationName}
            onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#737373]">DSP Permit Number</label>
          <Input
            value={form.dspNumber}
            onChange={(e) => setForm((f) => ({ ...f, dspNumber: e.target.value }))}
            placeholder="e.g. DSP-NY-20001"
          />
          <p className="text-[10px] text-[#a3a3a3]">Required on all TTB filings (27 CFR § 19.91)</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#737373]">Platform Tagline</label>
          <Input
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            disabled
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#737373]">Support Email</label>
          <Input
            value={form.supportEmail}
            onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            disabled
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#737373]">Time Zone</label>
          <Input
            value={form.timeZone}
            onChange={(e) => setForm((f) => ({ ...f, timeZone: e.target.value }))}
            disabled
          />
        </div>
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}

type ImportRowResult = {
  sheet: string;
  table: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type ExciseRecord = {
  month: string; productName: string; abv: number;
  distCases: number; retailCases: number; totalCases: number;
  proofGallons: number; exciseTax: number;
};

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
    setExciseFile(f);
    setExciseResult(null);
    try {
      const records = await parseExciseExcel(f);
      setExcisePreview(records);
    } catch (e: any) {
      toast.error("Failed to parse file: " + e.message);
    }
  }

  async function runExciseImport() {
    if (!excisePreview) return;
    setExciseImporting(true);
    try {
      const csrfToken2 = await getCsrfToken();
      const res = await fetch("/api/admin/import-excise-product-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken2 ? { "x-csrf-token": csrfToken2 } : {}) },
        body: JSON.stringify({ records: excisePreview }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setExciseResult(json);
      toast.success(`Excise import complete — ${json.inserted} inserted, ${json.updated} updated`);
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setExciseImporting(false);
    }
  }

  const byMonth: Record<string, number> = {};
  for (const r of excisePreview ?? []) {
    byMonth[r.month] = (byMonth[r.month] ?? 0) + 1;
  }

  return (
    <div className="border border-[#e5e5e5] rounded-xl bg-white overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#e5e5e5] bg-[#f7f7f7]">
        <p className="text-sm font-semibold text-[#0a0a0a]">Excise Tax Excel Import</p>
        <p className="text-xs text-[#737373] mt-0.5">
          Upload your monthly excise tax Excel file. Each sheet is a month — products with zero cases are skipped automatically.
        </p>
      </div>
      <div className="p-5 space-y-4">
        {!exciseResult ? (
          <>
            <div
              className="border-2 border-dashed border-[#e5e5e5] rounded-lg p-8 text-center cursor-pointer hover:border-[#0a0a0a]/30 transition-colors"
              onClick={() => exciseRef.current?.click()}
            >
              <input
                ref={exciseRef} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExciseFile(f); }}
              />
              {exciseFile ? (
                <div>
                  <p className="text-sm font-medium text-[#0a0a0a]">{exciseFile.name}</p>
                  <p className="text-xs text-[#737373] mt-0.5">{Object.keys(byMonth).length} months detected, {excisePreview?.length ?? 0} product rows — click to change</p>
                </div>
              ) : (
                <p className="text-sm text-[#737373]">Drop Excise Tax.xlsx here or click to browse</p>
              )}
            </div>
            {excisePreview && excisePreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Preview — months detected</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, count]) => (
                    <span key={month} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f0f0] text-[11px] font-medium text-[#0a0a0a]">
                      {new Date(month + "-02").toLocaleString("en-US",{month:"short",year:"numeric"})}
                      <span className="text-[#737373]">·{count}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={runExciseImport} disabled={exciseImporting}>
                    {exciseImporting ? "Importing…" : `Import ${excisePreview.length} Records`}
                  </Button>
                  <Button variant="outline" onClick={() => { setExciseFile(null); setExcisePreview(null); }}>Clear</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-6 text-center">
              <div><p className="text-2xl font-bold text-[#22c55e]">{exciseResult.inserted}</p><p className="text-xs text-[#737373]">Inserted</p></div>
              <div><p className="text-2xl font-bold text-[#3b82f6]">{exciseResult.updated}</p><p className="text-xs text-[#737373]">Updated</p></div>
              <div><p className="text-2xl font-bold text-[#a3a3a3]">{exciseResult.skipped}</p><p className="text-xs text-[#737373]">Skipped</p></div>
            </div>
            <p className="text-xs text-[#737373]">Data is now visible in Reports → Excise Tax Return for each imported month.</p>
            <Button variant="outline" size="sm" onClick={() => { setExciseFile(null); setExcisePreview(null); setExciseResult(null); }}>
              Import Another File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f: File) {
    if (!f.name.endsWith(".xlsx")) {
      toast.error("Please upload an .xlsx file");
      return;
    }
    setFile(f);
    setResults(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function runImport() {
    if (!file) return;
    setImporting(true);
    try {
      const csrfToken = await getCsrfToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResults(json.results);
      const totalInserted = json.results.reduce((s: number, r: ImportRowResult) => s + r.inserted, 0);
      const totalUpdated = json.results.reduce((s: number, r: ImportRowResult) => s + r.updated, 0);
      toast.success(`Import complete — ${totalInserted} inserted, ${totalUpdated} updated`);
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <ExciseImportCard />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Import Data from Excel</h3>
          <p className="text-xs text-[#737373] mt-0.5">
            Upload the exported Excel file (.xlsx). Each sheet maps to its table — rows with an existing ID will be updated, new rows will be inserted. The Audit Log sheet is read-only and will be skipped.
          </p>
        </div>
      </div>

      {/* Download template */}
      <div className="border border-[#e5e5e5] rounded-md p-4 bg-white flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[#0a0a0a]">Download Import Template</p>
          <p className="text-xs text-[#737373] mt-0.5">
            Download a blank template with all current fields and instructions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { window.location.href = "/api/export/template.xlsx"; }}>
          Download Import Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
          dragOver ? "border-[#0a0a0a] bg-[#0a0a0a]/5" : "border-[#e5e5e5] bg-white hover:border-[#0a0a0a]/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#0a0a0a]">{file.name}</p>
            <p className="text-xs text-[#737373]">{(file.size / 1024).toFixed(1)} KB — click to change</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#737373]">Drop your Excel file here or click to browse</p>
            <p className="text-xs text-[#a3a3a3]">Only .xlsx files are accepted (max 20 MB)</p>
          </div>
        )}
      </div>

      {file && !results && (
        <div className="flex items-center gap-3">
          <Button onClick={runImport} disabled={importing}>
            {importing ? "Importing…" : "Import Data"}
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setResults(null); }}>
            Clear
          </Button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Import Results</h4>
            <Button variant="outline" size="sm" onClick={() => { setFile(null); setResults(null); }}>
              Import Another File
            </Button>
          </div>
          <div className="border border-[#e5e5e5] rounded-md bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#f7f7f7]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">Sheet</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">Inserted</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">Updated</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">Skipped</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#737373] uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.sheet} className={i < results.length - 1 ? "border-b border-[#e5e5e5]" : ""}>
                    <td className="px-4 py-3 text-xs font-medium text-[#0a0a0a]">{r.sheet}</td>
                    <td className="px-4 py-3 text-xs text-right text-[#22c55e] font-medium">{r.inserted || "—"}</td>
                    <td className="px-4 py-3 text-xs text-right text-[#3b82f6] font-medium">{r.updated || "—"}</td>
                    <td className="px-4 py-3 text-xs text-right text-[#737373]">{r.skipped || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#737373]">
                      {r.errors.length > 0 ? (
                        <span className="text-red-600">{r.errors[0]}{r.errors.length > 1 ? ` (+${r.errors.length - 1} more)` : ""}</span>
                      ) : r.table === "—" ? (
                        <span className="text-amber-600">Unknown sheet</span>
                      ) : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerTab() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const resetMut = useMutation({
    mutationFn: () => apiRequest("/api/admin/reset-all-data", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries();
      setConfirm("");
      setDone(true);
      toast.success("All operational data has been cleared.");
    },
    onError: (e: any) => toast.error(e.message ?? "Reset failed"),
  });

  const PHRASE = "delete all data";

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Reset All Operational Data</p>
        <p className="text-xs text-[#737373]">
          Permanently deletes all batches, barrels, barrel events, inventory, sales orders, trading partners, compliance records, staff, permits, and reports.
          Your account, platform settings, and branding are preserved.
        </p>
      </div>

      {done ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 font-medium">
          Done — the system has been cleared. You can start fresh.
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-4">
          <p className="text-xs text-red-700 font-semibold uppercase tracking-wide">This cannot be undone.</p>
          <p className="text-xs text-red-600">
            Type <span className="font-mono font-bold">{PHRASE}</span> to confirm:
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={PHRASE}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-red-200 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <Button
            className="bg-red-600 hover:bg-red-700 text-white border-red-600 w-full"
            disabled={confirm !== PHRASE || resetMut.isPending}
            onClick={() => resetMut.mutate()}
          >
            {resetMut.isPending ? "Clearing data…" : "Clear All Data"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("branding");

  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest<PlatformConfig>("/api/platform-config"),
    staleTime: 60_000,
  });

  if (user && user.role !== "admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-[#737373] text-sm">
          Access restricted to administrators.
        </div>
      </Layout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "branding", label: "Branding" },
    { key: "export", label: "Data Export" },
    { key: "import", label: "Data Import" },
    { key: "platform", label: "Platform" },
    { key: "danger", label: "Danger Zone" },
  ];

  return (
    <Layout>
      <PageHeader
        title="Settings"
        subtitle="Platform configuration — Admin only"
      />
      <div className="flex" style={{ minHeight: "calc(100vh - 8rem)" }}>
        {/* Sidebar */}
        <aside className="w-44 border-r border-[#e5e5e5] bg-white p-3 space-y-0.5 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                t.key === "danger"
                  ? tab === "danger"
                    ? "bg-red-600 text-white"
                    : "text-red-500 hover:text-red-600 hover:bg-red-50"
                  : tab === t.key
                    ? "bg-[#0a0a0a] text-white"
                    : "text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f0f0f0]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 bg-[#f7f7f7]">
          {tab === "branding" && <BrandingTab config={config} />}
          {tab === "export" && <ExportTab />}
          {tab === "import" && <ImportTab />}
          {tab === "platform" && <PlatformTab config={config} />}
          {tab === "danger" && <DangerTab />}
        </div>
      </div>
    </Layout>
  );
}
