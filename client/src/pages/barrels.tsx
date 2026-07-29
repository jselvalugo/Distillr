import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
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
                  <Th>Fill Date</Th>
                  <Th>Fill Proof</Th>
                  <Th>Fill Vol.</Th>
                  <Th>Proof Gal.</Th>
                  <Th>Curr. Vol.</Th>
                  <Th>Zone</Th>
                  <Th>Char</Th>
                  <Th>Aging Days</Th>
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
                      <Td className="text-[#737373]">{fmt(b.fillDate)}</Td>
                      <Td className="text-[#737373]">{fmtNum(b.fillProof)}</Td>
                      <Td className="text-[#737373]">{fmtNum(b.fillVolume)}</Td>
                      <Td className="text-[#737373]">{fmtNum(b.fillProofGallons)}</Td>
                      <Td className="text-[#737373]">{fmtNum(b.currentVolume)}</Td>
                      <Td className="text-[#737373]">{b.warehouseZone ?? "—"}</Td>
                      <Td className="text-[#737373]">{b.charLevel ?? "—"}</Td>
                      <Td className="text-[#737373]">{b.totalAgingDays ?? "—"}</Td>
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
    </Layout>
  );
}
