import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { fmt, fmtNum } from "../lib/utils";
import type { DistillingBatchRecord } from "@shared/schema";

// ---------------------------------------------------------------------------
// Tax class labels (mirrors batch-detail.tsx TAX_CLASSES)
// ---------------------------------------------------------------------------
const TAX_CLASS_LABELS: Record<string, string> = {
  craft_tier1: "Craft Tier 1 — ≤100,000 PG ($2.70/PG)",
  craft_tier2: "Craft Tier 2 — 100,001–22.1M PG ($13.34/PG)",
  standard: "Standard Rate ($13.50/PG)",
};

// ---------------------------------------------------------------------------
// Stage pill
// ---------------------------------------------------------------------------
const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  mash_fermentation: "Mash & Fermentation",
  distillation: "Distillation",
  barreling: "Barreling",
  aging: "Aging",
  bottling: "Bottling",
  closed: "Closed",
};

const STAGE_STEP: Record<string, number> = {
  planning: 1, mash_fermentation: 2, distillation: 3, barreling: 4,
  aging: 5, bottling: 6, closed: 7,
};

function StagePill({ stage }: { stage: string }) {
  const step = STAGE_STEP[stage] ?? 1;
  const label = STAGE_LABELS[stage] ?? stage;
  const isClosed = stage === "closed";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
      isClosed ? "bg-[#22c55e]/10 text-[#16a34a]" : "bg-[#0a0a0a]/8 text-[#0a0a0a]"
    }`}>
      <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
        isClosed ? "bg-[#22c55e] text-white" : "bg-[#0a0a0a] text-white"
      }`}>{step}</span>
      {label}
      <span className="text-[#737373] font-normal">· {step}/7</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BatchRow = DistillingBatchRecord & {
  productName?: string | null;
  spiritType?: string | null;
  spiritClass?: string | null;
  fillProof?: number | null;
  fillWineGallons?: number | null;
  fillProofGallons?: number | null;
  proofGallonsProduced?: number | null;
  distillationProof?: number | null;
  stillType?: string | null;
  fillNumber?: string | null;
  containerType?: string | null;
  bottlingDate?: string | null;
  bottlingProof?: number | null;
  wineGallonsBottled?: number | null;
  proofGallonsProcessed?: number | null;
  cases750ml?: number | null;
  cases1000ml?: number | null;
  cases1750ml?: number | null;
  totalCases?: number | null;
  lotNumber?: string | null;
  taxClass?: string | null;
  exciseTaxDue?: number | null;
  targetDumpDate?: string | null;
  amountReceivedGallons?: number | null;
  distillDate?: string | null;
  fillDate?: string | null;
};

// ---------------------------------------------------------------------------
// Read-only detail row helper
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
// Read-only batch detail dialog
// ---------------------------------------------------------------------------
function BatchDetailDialog({ batch, onClose, onEdit }: {
  batch: BatchRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const totalCases = (batch.cases750ml ?? 0) + (batch.cases1000ml ?? 0) + (batch.cases1750ml ?? 0);

  return (
    <Dialog open onClose={onClose} title={`${batch.batchCode} — Batch Record`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

        <Section title="Batch Overview">
          <DetailRow label="Batch Code" value={<span className="font-mono">{batch.batchCode}</span>} />
          <DetailRow label="Product" value={(batch as any).productName} />
          <DetailRow label="Batch Date" value={fmt(batch.batchDate)} />
          <DetailRow label="Spirit Type" value={(batch as any).spiritType} />
          <DetailRow label="Spirit Class" value={(batch as any).spiritClass} />
          <DetailRow label="Stage" value={<StagePill stage={batch.stage} />} />
          <DetailRow label="Notes" value={batch.notes} />
        </Section>

        {((batch as any).distillationProof || (batch as any).proofGallonsProduced || (batch as any).distillDate || (batch as any).stillType) && (
          <Section title="Distillation">
            <DetailRow label="Distill Date" value={fmt((batch as any).distillDate)} />
            <DetailRow label="Still Type" value={(batch as any).stillType} />
            <DetailRow label="Distillation Proof" value={(batch as any).distillationProof ? `${(batch as any).distillationProof}°` : null} />
            <DetailRow label="Proof Gallons Produced" value={fmtNum((batch as any).proofGallonsProduced) ? `${fmtNum((batch as any).proofGallonsProduced)} PG` : null} />
          </Section>
        )}

        {((batch as any).fillProof || (batch as any).fillWineGallons || (batch as any).fillDate) && (
          <Section title="Barreling">
            <DetailRow label="Fill Date" value={fmt((batch as any).fillDate)} />
            <DetailRow label="Fill Number" value={(batch as any).fillNumber} />
            <DetailRow label="Container Type" value={(batch as any).containerType} />
            <DetailRow label="Fill Proof" value={(batch as any).fillProof ? `${(batch as any).fillProof}°` : null} />
            <DetailRow label="Fill Wine Gallons" value={(batch as any).fillWineGallons ? `${(batch as any).fillWineGallons} gal` : null} />
            <DetailRow label="Fill Proof Gallons" value={(batch as any).fillProofGallons ? `${(batch as any).fillProofGallons} PG` : null} />
          </Section>
        )}

        {((batch as any).targetDumpDate || (batch as any).amountReceivedGallons) && (
          <Section title="Aging">
            <DetailRow label="Target Dump Date" value={fmt((batch as any).targetDumpDate)} />
            <DetailRow label="Amount Received" value={(batch as any).amountReceivedGallons ? `${(batch as any).amountReceivedGallons} gal` : null} />
          </Section>
        )}

        {((batch as any).bottlingDate || (batch as any).cases750ml || (batch as any).cases1000ml || (batch as any).cases1750ml) && (
          <Section title="Bottling">
            <DetailRow label="Bottling Date" value={fmt((batch as any).bottlingDate)} />
            <DetailRow label="Lot Number" value={(batch as any).lotNumber} />
            <DetailRow label="Proof at Bottling" value={(batch as any).bottlingProof ? `${(batch as any).bottlingProof}°` : null} />
            <DetailRow label="Wine Gallons Bottled" value={(batch as any).wineGallonsBottled ? `${(batch as any).wineGallonsBottled} gal` : null} />
            <DetailRow label="Proof Gallons Processed" value={(batch as any).proofGallonsProcessed ? `${(batch as any).proofGallonsProcessed} PG` : null} />
            <DetailRow label="Cases 750 mL" value={(batch as any).cases750ml} />
            <DetailRow label="Cases 1 L" value={(batch as any).cases1000ml} />
            <DetailRow label="Cases 1.75 L" value={(batch as any).cases1750ml} />
            <DetailRow label="Total Cases" value={totalCases > 0 ? totalCases : null} />
          </Section>
        )}

        {(batch.exciseTaxDue != null || batch.taxClass) && (
          <Section title="Tax">
            <DetailRow
              label="Tax Class"
              value={batch.taxClass ? (TAX_CLASS_LABELS[batch.taxClass] ?? batch.taxClass) : null}
            />
            <DetailRow label="Excise Tax Due" value={
              batch.exciseTaxDue != null ? (
                <span className="font-semibold text-[#0369a1]">
                  ${Number(batch.exciseTaxDue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : null
            } />
          </Section>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit Batch →</Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Production() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [viewTarget, setViewTarget] = useState<BatchRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null);

  const { data: batches = [] } = useQuery<BatchRow[]>({
    queryKey: ["/api/distilling/batch-records"],
    queryFn: () => apiRequest("/api/distilling/batch-records"),
  });

  const deleteBatch = useMutation({
    mutationFn: () =>
      apiRequest(`/api/distilling/batch-records/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      setDeleteTarget(null);
      toast.success("Batch deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        title="Production"
        subtitle="Distilling batch pipeline"
        actions={<Button onClick={() => navigate("/production/new")}>+ New Batch</Button>}
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Batch Code</Th>
                <Th>Product</Th>
                <Th>Date</Th>
                <Th>Stage</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {batches.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[#737373] py-10">
                    No batches yet — create one to get started
                  </Td>
                </Tr>
              ) : (
                batches.map((b) => (
                  <Tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[#f7f7f7]"
                    onClick={() => setViewTarget(b)}
                  >
                    <Td className="font-mono font-medium text-[#0a0a0a]">{b.batchCode}</Td>
                    <Td className="text-[#737373]">{(b as any).productName ?? "—"}</Td>
                    <Td className="text-[#737373]">{fmt(b.batchDate)}</Td>
                    <Td><StagePill stage={b.stage} /></Td>
                    <Td>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => setViewTarget(b)}>
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/production/${b.id}`)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setDeleteTarget(b)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      {/* Read-only detail dialog */}
      {viewTarget && (
        <BatchDetailDialog
          batch={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setViewTarget(null); navigate(`/production/${viewTarget.id}`); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Batch">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to delete batch{" "}
              <span className="font-mono font-semibold">{deleteTarget.batchCode}</span>
              {(deleteTarget as any).productName && <> ({(deleteTarget as any).productName})</>}?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the batch and all associated workflow data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteBatch.mutate()}
                disabled={deleteBatch.isPending}
              >
                {deleteBatch.isPending ? "Deleting…" : "Delete Batch"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Layout>
  );
}
