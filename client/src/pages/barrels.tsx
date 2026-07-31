import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Upload, Download } from "lucide-react";
import { exportToCsv, downloadBrandedTemplate, parseImportFile } from "../lib/csv";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt, fmtNum } from "../lib/utils";
import type { Barrel } from "@shared/schema";

const STATUSES = ["Filled", "Aging", "Ready", "Dumped", "Retired"] as const;

// ---------------------------------------------------------------------------
// Read-only detail helpers
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
// Barrel detail dialog (read-only)
// ---------------------------------------------------------------------------
function BarrelDetailDialog({ barrel, onClose, onEdit }: {
  barrel: Barrel;
  onClose: () => void;
  onEdit: () => void;
}) {
  const agingDays = barrel.totalAgingDays ?? null;
  const proofGallons = barrel.fillProofGallons != null
    ? `${fmtNum(barrel.fillProofGallons)} PG`
    : null;

  return (
    <Dialog open onClose={onClose} title={`Barrel ${barrel.serialNumber}`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

        <Section title="Identification">
          <DetailRow label="Serial Number" value={<span className="font-mono">{barrel.serialNumber}</span>} />
          <DetailRow label="Product" value={barrel.productName} />
          <DetailRow label="Status" value={statusBadge(barrel.status)} />
        </Section>

        <Section title="Fill Details">
          <DetailRow label="Fill Date" value={fmt(barrel.fillDate)} />
          <DetailRow label="Fill Proof" value={barrel.fillProof != null ? `${barrel.fillProof}°` : null} />
          <DetailRow label="Fill Volume" value={barrel.fillVolume != null ? `${fmtNum(barrel.fillVolume)} gal` : null} />
          <DetailRow label="Fill Proof Gallons" value={proofGallons} />
        </Section>

        {(barrel.warehouseZone || barrel.charLevel) && (
          <Section title="Storage">
            <DetailRow label="Warehouse Zone" value={barrel.warehouseZone} />
            <DetailRow label="Char Level" value={barrel.charLevel} />
          </Section>
        )}

        <Section title="Aging">
          <DetailRow label="Current Volume" value={barrel.currentVolume != null ? `${fmtNum(barrel.currentVolume)} gal` : null} />
          <DetailRow label="Aging Days" value={agingDays != null ? `${agingDays} days` : null} />
        </Section>

        {(barrel as any).notes && (
          <Section title="Notes">
            <div className="py-1.5 text-xs text-[#404040]">{(barrel as any).notes}</div>
          </Section>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit Barrel →</Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Barrels() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [viewTarget, setViewTarget] = useState<Barrel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Barrel | null>(null);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: barrels = [], isLoading } = useQuery<Barrel[]>({
    queryKey: ["/api/barrels"],
    queryFn: () => apiRequest("/api/barrels"),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/barrels/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/barrels"] });
      setDeleteTarget(null);
      toast.success("Barrel deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const EXPORT_COLS = [
    { header: "serialNumber",    key: "serialNumber" },
    { header: "productName",     key: "productName" },
    { header: "status",          key: "status" },
    { header: "fillDate",        key: "fillDate" },
    { header: "fillProof",       key: "fillProof" },
    { header: "fillVolume",      key: "fillVolume" },
    { header: "fillProofGallons",key: "fillProofGallons" },
    { header: "currentVolume",   key: "currentVolume" },
    { header: "warehouseZone",   key: "warehouseZone" },
    { header: "charLevel",       key: "charLevel" },
    { header: "totalAgingDays",  key: "totalAgingDays" },
    { header: "notes",           key: "notes" },
  ] as const;

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const rows = await parseImportFile(importFile);
      let ok = 0, fail = 0;
      for (const row of rows) {
        try {
          await apiRequest("/api/barrels", {
            method: "POST",
            body: JSON.stringify({
              serialNumber: row.serialNumber,
              status: (row.status as any) || "Filled",
              productName: row.productName || undefined,
              fillDate: row.fillDate || undefined,
              fillProof: row.fillProof ? +row.fillProof : undefined,
              fillVolume: row.fillVolume ? +row.fillVolume : undefined,
              fillProofGallons: row.fillProofGallons ? +row.fillProofGallons : undefined,
              currentVolume: row.currentVolume ? +row.currentVolume : undefined,
              warehouseZone: row.warehouseZone || undefined,
              charLevel: row.charLevel || undefined,
              totalAgingDays: row.totalAgingDays ? +row.totalAgingDays : undefined,
              notes: row.notes || undefined,
            }),
          });
          ok++;
        } catch { fail++; }
      }
      qc.invalidateQueries({ queryKey: ["/api/barrels"] });
      setImportOpen(false);
      setImportFile(null);
      toast.success(`Imported ${ok} barrel${ok !== 1 ? "s" : ""}${fail ? ` (${fail} failed)` : ""}`);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
    }
  }

  const filtered = barrels.filter(
    (b) =>
      b.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      (b.productName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Barrels"
        subtitle={`${barrels.length} barrel${barrels.length !== 1 ? "s" : ""} tracked`}
        actions={
          <>
            <Input
              placeholder="Search serial or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52"
            />
            <Button variant="outline" onClick={() => exportToCsv("barrels.csv", barrels, EXPORT_COLS as any)}>
              <Download size={13} className="mr-1.5" /> Export
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={13} className="mr-1.5" /> Import
            </Button>
            <Button onClick={() => navigate("/barrels/new")}>+ Add Barrel</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-[#737373]">Loading…</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Serial #</Th>
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Fill Date</Th>
                  <Th className="hidden md:table-cell">Fill Proof</Th>
                  <Th className="hidden md:table-cell">Fill Vol.</Th>
                  <Th className="hidden md:table-cell">Proof Gal.</Th>
                  <Th className="hidden md:table-cell">Curr. Vol.</Th>
                  <Th className="hidden md:table-cell">Zone</Th>
                  <Th className="hidden md:table-cell">Char</Th>
                  <Th className="hidden md:table-cell">Aging Days</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={12} className="text-center text-[#737373] py-10">
                      {search ? "No barrels match your search" : "No barrels yet — add your first barrel"}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((b) => (
                    <Tr
                      key={b.id}
                      className="cursor-pointer hover:bg-[#f7f7f7]"
                      onClick={() => setViewTarget(b)}
                    >
                      <Td className="font-mono font-medium text-[#0a0a0a]">{b.serialNumber}</Td>
                      <Td className="text-[#737373]">{b.productName ?? "—"}</Td>
                      <Td>{statusBadge(b.status)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{fmt(b.fillDate)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{fmtNum(b.fillProof)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{fmtNum(b.fillVolume)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{fmtNum(b.fillProofGallons)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{fmtNum(b.currentVolume)}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{b.warehouseZone ?? "—"}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{b.charLevel ?? "—"}</Td>
                      <Td className="text-[#737373] hidden md:table-cell">{b.totalAgingDays ?? "—"}</Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setViewTarget(b)}
                            className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            title="View details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => navigate(`/barrels/${b.id}/edit`)}
                            className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            title="Edit barrel"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                            title="Delete barrel"
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
          )}
        </div>
      </div>

      {/* Read-only detail dialog */}
      {viewTarget && (
        <BarrelDetailDialog
          barrel={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setViewTarget(null); navigate(`/barrels/${viewTarget.id}/edit`); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Barrel">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to delete barrel{" "}
              <span className="font-mono font-semibold">{deleteTarget.serialNumber}</span>
              {deleteTarget.productName && <> ({deleteTarget.productName})</>}?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the barrel record. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete Barrel"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      <Dialog open={importOpen} onClose={() => { setImportOpen(false); setImportFile(null); }} title="Import Barrels">
        <div className="space-y-4">
          <p className="text-xs text-[#737373]">
            Upload a CSV or XLSX file. Required columns: <span className="font-mono">serialNumber, status</span>.
          </p>
          <button
            onClick={() => downloadBrandedTemplate("barrels")}
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
