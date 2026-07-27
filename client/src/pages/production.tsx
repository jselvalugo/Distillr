import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt, fmtNum } from "../lib/utils";
import type { DistillingBatchRecord, DistillingProductionRecord } from "@shared/schema";

type Tab = "batches" | "runs";

const emptyBatch = {
  batchCode: "",
  batchDate: new Date().toISOString().slice(0, 10),
  stage: "Production",
  notes: "",
};

const emptyRun = {
  mashDate: new Date().toISOString().slice(0, 10),
  gallonsMolasses: "",
  lbsSugar: "",
  libertaliaYeastPackets: "0",
  riskeyYeastPackets: "0",
  distillDate: new Date().toISOString().slice(0, 10),
  gallonsDistilled: "",
  percentageDistilled: "",
  notes: "",
};

export default function Production() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("batches");
  const [openBatch, setOpenBatch] = useState(false);
  const [openRun, setOpenRun] = useState(false);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [runForm, setRunForm] = useState(emptyRun);

  const { data: batches = [] } = useQuery<DistillingBatchRecord[]>({
    queryKey: ["/api/distilling/batches"],
    queryFn: () => apiRequest("/api/distilling/batches"),
  });
  const { data: runs = [] } = useQuery<DistillingProductionRecord[]>({
    queryKey: ["/api/distilling/production-records"],
    queryFn: () => apiRequest("/api/distilling/production-records"),
  });

  const createBatch = useMutation({
    mutationFn: (d: typeof batchForm) =>
      apiRequest("/api/distilling/batches", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batches"] });
      setOpenBatch(false);
      setBatchForm(emptyBatch);
      toast.success("Batch created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createRun = useMutation({
    mutationFn: (d: typeof runForm) =>
      apiRequest("/api/distilling/production-records", {
        method: "POST",
        body: JSON.stringify({
          ...d,
          gallonsMolasses: +d.gallonsMolasses,
          lbsSugar: +d.lbsSugar,
          libertaliaYeastPackets: +d.libertaliaYeastPackets,
          riskeyYeastPackets: +d.riskeyYeastPackets,
          gallonsDistilled: +d.gallonsDistilled,
          percentageDistilled: +d.percentageDistilled,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/production-records"] });
      setOpenRun(false);
      setRunForm(emptyRun);
      toast.success("Run logged");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        title="Production"
        subtitle="Distilling batches and run records"
        actions={
          tab === "batches" ? (
            <Button onClick={() => setOpenBatch(true)}>+ New Batch</Button>
          ) : (
            <Button onClick={() => setOpenRun(true)}>+ Log Run</Button>
          )
        }
      />

      <div className="p-6">
        <div className="flex gap-1 mb-4 border-b border-[#e5e5e5]">
          {(["batches", "runs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[#0a0a0a] text-[#0a0a0a]"
                  : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {t === "batches" ? "Batch Records" : "Production Runs"}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          {tab === "batches" ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Batch Code</Th>
                  <Th>Date</Th>
                  <Th>Stage</Th>
                  <Th>Status</Th>
                  <Th>Notes</Th>
                </Tr>
              </Thead>
              <Tbody>
                {batches.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center text-[#737373] py-10">
                      No batches yet
                    </Td>
                  </Tr>
                ) : (
                  batches.map((b) => (
                    <Tr key={b.id}>
                      <Td className="font-mono font-medium">{b.batchCode}</Td>
                      <Td>{fmt(b.batchDate)}</Td>
                      <Td>{b.stage}</Td>
                      <Td>{statusBadge(b.status)}</Td>
                      <Td className="text-[#737373] max-w-xs truncate">{b.notes ?? "—"}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Mash Date</Th>
                  <Th>Distill Date</Th>
                  <Th>Gal. Molasses</Th>
                  <Th>Lbs Sugar</Th>
                  <Th>Gal. Distilled</Th>
                  <Th>% Distilled</Th>
                  <Th>Proof Gal.</Th>
                </Tr>
              </Thead>
              <Tbody>
                {runs.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="text-center text-[#737373] py-10">
                      No runs logged yet
                    </Td>
                  </Tr>
                ) : (
                  runs.map((r) => (
                    <Tr key={r.id}>
                      <Td>{fmt(r.mashDate)}</Td>
                      <Td>{fmt(r.distillDate)}</Td>
                      <Td>{fmtNum(r.gallonsMolasses)}</Td>
                      <Td>{fmtNum(r.lbsSugar)}</Td>
                      <Td>{fmtNum(r.gallonsDistilled)}</Td>
                      <Td>{fmtNum(r.percentageDistilled)}%</Td>
                      <Td>{fmtNum(r.proofOfGallons)}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      <Dialog
        open={openBatch}
        onClose={() => { setOpenBatch(false); setBatchForm(emptyBatch); }}
        title="New Batch Record"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); createBatch.mutate(batchForm); }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Batch Code *</label>
              <Input
                value={batchForm.batchCode}
                onChange={(e) => setBatchForm((f) => ({ ...f, batchCode: e.target.value }))}
                required
                placeholder="e.g. RUM-2025-001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <Input
                type="date"
                value={batchForm.batchDate}
                onChange={(e) => setBatchForm((f) => ({ ...f, batchDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stage</label>
              <Select
                value={batchForm.stage}
                onChange={(e) => setBatchForm((f) => ({ ...f, stage: e.target.value }))}
              >
                <option>Production</option>
                <option>Processing</option>
                <option>Bottling</option>
                <option>Sales</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input
                value={batchForm.notes}
                onChange={(e) => setBatchForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpenBatch(false); setBatchForm(emptyBatch); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBatch.isPending}>
              {createBatch.isPending ? "Saving…" : "Create Batch"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={openRun}
        onClose={() => { setOpenRun(false); setRunForm(emptyRun); }}
        title="Log Production Run"
        size="lg"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); createRun.mutate(runForm); }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Mash Date *</label>
              <Input
                type="date"
                value={runForm.mashDate}
                onChange={(e) => setRunForm((f) => ({ ...f, mashDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Distill Date *</label>
              <Input
                type="date"
                value={runForm.distillDate}
                onChange={(e) => setRunForm((f) => ({ ...f, distillDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Gallons Molasses</label>
              <Input
                type="number"
                step="0.01"
                value={runForm.gallonsMolasses}
                onChange={(e) => setRunForm((f) => ({ ...f, gallonsMolasses: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Lbs Sugar</label>
              <Input
                type="number"
                step="0.01"
                value={runForm.lbsSugar}
                onChange={(e) => setRunForm((f) => ({ ...f, lbsSugar: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Libertalia Yeast Packets</label>
              <Input
                type="number"
                min="0"
                value={runForm.libertaliaYeastPackets}
                onChange={(e) => setRunForm((f) => ({ ...f, libertaliaYeastPackets: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Riskey Yeast Packets</label>
              <Input
                type="number"
                min="0"
                value={runForm.riskeyYeastPackets}
                onChange={(e) => setRunForm((f) => ({ ...f, riskeyYeastPackets: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Gallons Distilled *</label>
              <Input
                type="number"
                step="0.01"
                value={runForm.gallonsDistilled}
                onChange={(e) => setRunForm((f) => ({ ...f, gallonsDistilled: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">% Distilled</label>
              <Input
                type="number"
                step="0.01"
                value={runForm.percentageDistilled}
                onChange={(e) => setRunForm((f) => ({ ...f, percentageDistilled: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input
                value={runForm.notes}
                onChange={(e) => setRunForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpenRun(false); setRunForm(emptyRun); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRun.isPending}>
              {createRun.isPending ? "Saving…" : "Log Run"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
