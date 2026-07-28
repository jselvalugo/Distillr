import { useState } from "react";
import { useLocation } from "wouter";
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
import type { Barrel } from "@shared/schema";

const STATUSES = ["Filled", "Aging", "Ready", "Dumped", "Retired"] as const;

const emptyForm = {
  serialNumber: "",
  productName: "",
  status: "Filled",
  warehouseZone: "",
  charLevel: "",
  fillDate: "",
  fillProof: "",
  fillVolume: "",
  notes: "",
};

export default function Barrels() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: barrels = [], isLoading } = useQuery<Barrel[]>({
    queryKey: ["/api/barrels"],
    queryFn: () => apiRequest("/api/barrels"),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("/api/barrels", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          fillProof: data.fillProof ? +data.fillProof : undefined,
          fillVolume: data.fillVolume ? +data.fillVolume : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/barrels"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Barrel added");
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
                </Tr>
              </Thead>
              <Tbody>
                {filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={11} className="text-center text-[#737373] py-10">
                      {search ? "No barrels match your search" : "No barrels yet — add your first barrel"}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((b) => (
                    <Tr key={b.id}>
                      <Td className="font-mono font-medium">{b.serialNumber}</Td>
                      <Td>{b.productName ?? "—"}</Td>
                      <Td>{statusBadge(b.status)}</Td>
                      <Td>{fmt(b.fillDate)}</Td>
                      <Td>{fmtNum(b.fillProof)}</Td>
                      <Td>{fmtNum(b.fillVolume)}</Td>
                      <Td>{fmtNum(b.fillProofGallons)}</Td>
                      <Td>{fmtNum(b.currentVolume)}</Td>
                      <Td>{b.warehouseZone ?? "—"}</Td>
                      <Td>{b.charLevel ?? "—"}</Td>
                      <Td>{b.totalAgingDays ?? "—"}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="Add Barrel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate(form);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Serial Number *</label>
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Product Name</label>
              <Input
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fill Date</label>
              <Input
                type="date"
                value={form.fillDate}
                onChange={(e) => setForm((f) => ({ ...f, fillDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fill Proof</label>
              <Input
                type="number"
                step="0.01"
                value={form.fillProof}
                onChange={(e) => setForm((f) => ({ ...f, fillProof: e.target.value }))}
                placeholder="e.g. 125.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fill Volume (gal)</label>
              <Input
                type="number"
                step="0.01"
                value={form.fillVolume}
                onChange={(e) => setForm((f) => ({ ...f, fillVolume: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Warehouse Zone</label>
              <Input
                value={form.warehouseZone}
                onChange={(e) => setForm((f) => ({ ...f, warehouseZone: e.target.value }))}
                placeholder="e.g. A-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Char Level</label>
              <Input
                value={form.charLevel}
                onChange={(e) => setForm((f) => ({ ...f, charLevel: e.target.value }))}
                placeholder="e.g. #3"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Saving…" : "Add Barrel"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
