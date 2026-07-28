import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import type { DistillingBatchRecord } from "@shared/schema";

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
  planning: 1,
  mash_fermentation: 2,
  distillation: 3,
  barreling: 4,
  aging: 5,
  bottling: 6,
  closed: 7,
};

function StagePill({ stage }: { stage: string }) {
  const step = STAGE_STEP[stage] ?? 1;
  const label = STAGE_LABELS[stage] ?? stage;
  const isClosed = stage === "closed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        isClosed
          ? "bg-[#22c55e]/10 text-[#16a34a]"
          : "bg-[#0a0a0a]/8 text-[#0a0a0a]"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
          isClosed ? "bg-[#22c55e] text-white" : "bg-[#0a0a0a] text-white"
        }`}
      >
        {step}
      </span>
      {label}
      <span className="text-[#737373] font-normal">· {step}/7</span>
    </span>
  );
}

const emptyBatch = {
  batchCode: "",
  batchDate: new Date().toISOString().slice(0, 10),
  productName: "",
  notes: "",
};

export default function Production() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState(emptyBatch);

  const { data: batches = [] } = useQuery<DistillingBatchRecord[]>({
    queryKey: ["/api/distilling/batch-records"],
    queryFn: () => apiRequest("/api/distilling/batch-records"),
  });

  const createBatch = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest<DistillingBatchRecord>("/api/distilling/batch-records", {
        method: "POST",
        body: JSON.stringify({
          batchCode: d.batchCode,
          batchDate: d.batchDate,
          productName: d.productName || null,
          notes: d.notes || null,
          stage: "planning",
          status: "Draft",
        }),
      }),
    onSuccess: (created: DistillingBatchRecord) => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      setOpenNew(false);
      setForm(emptyBatch);
      toast.success("Batch created");
      navigate(`/production/${created.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        title="Production"
        subtitle="Distilling batch pipeline"
        actions={
          <Button onClick={() => navigate("/production/new")}>+ New Batch</Button>
        }
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
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {batches.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[#737373] py-10">
                    No batches yet — create one to get started
                  </Td>
                </Tr>
              ) : (
                batches.map((b) => (
                  <Tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[#f7f7f7]"
                    onClick={() => navigate(`/production/${b.id}`)}
                  >
                    <Td className="font-mono font-medium text-[#0a0a0a]">{b.batchCode}</Td>
                    <Td className="text-[#737373]">{(b as any).productName ?? "—"}</Td>
                    <Td className="text-[#737373]">{fmt(b.batchDate)}</Td>
                    <Td>
                      <StagePill stage={b.stage} />
                    </Td>
                    <Td>{statusBadge(b.status)}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/production/${b.id}`);
                        }}
                      >
                        Open
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog
        open={openNew}
        onClose={() => { setOpenNew(false); setForm(emptyBatch); }}
        title="New Batch"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); createBatch.mutate(form); }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Batch Code *</label>
              <Input
                value={form.batchCode}
                onChange={(e) => setForm((f) => ({ ...f, batchCode: e.target.value }))}
                required
                placeholder="e.g. RUM-2026-001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <Input
                type="date"
                value={form.batchDate}
                onChange={(e) => setForm((f) => ({ ...f, batchDate: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Product Name</label>
              <Input
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                placeholder="e.g. Libertalia Rum"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpenNew(false); setForm(emptyBatch); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createBatch.isPending}>
              {createBatch.isPending ? "Creating…" : "Create Batch"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
