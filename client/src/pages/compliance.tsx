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
import { fmt } from "../lib/utils";
import type { Compliance, Client } from "@shared/schema";

const emptyForm = {
  clientId: "",
  type: "DSP Permit",
  status: "Pending Review",
  expires: "",
  jurisdiction: "",
  severity: "Medium",
  owner: "",
  notes: "",
};

export default function CompliancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: records = [] } = useQuery<Compliance[]>({
    queryKey: ["/api/compliance"],
    queryFn: () => apiRequest("/api/compliance"),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/compliance", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Record added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = records.filter(
    (r) =>
      r.type.toLowerCase().includes(search.toLowerCase()) ||
      (r.jurisdiction ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Compliance"
        subtitle={`${records.length} compliance records`}
        actions={
          <>
            <Input
              placeholder="Search type or jurisdiction…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52"
            />
            <Button onClick={() => setOpen(true)}>+ Add Record</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Severity</Th>
                <Th>Jurisdiction</Th>
                <Th>Expires</Th>
                <Th>Owner</Th>
                <Th>Last Reviewed</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="text-center text-[#737373] py-10">
                    {search ? "No records match your search" : "No compliance records yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.type}</Td>
                    <Td>{statusBadge(r.status)}</Td>
                    <Td>{r.severity ?? "—"}</Td>
                    <Td>{r.jurisdiction ?? "—"}</Td>
                    <Td>{fmt(r.expires)}</Td>
                    <Td>{r.owner ?? "—"}</Td>
                    <Td>{fmt(r.lastReviewedOn)}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="Add Compliance Record">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Client</label>
              <Select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type *</label>
              <Input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {["Approved", "Expiring Soon", "Missing", "Expired", "Pending Review"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Severity</label>
              <Select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                {["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Expires</label>
              <Input type="date" value={form.expires} onChange={(e) => setForm((f) => ({ ...f, expires: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Jurisdiction</label>
              <Input value={form.jurisdiction} onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))} placeholder="e.g. Federal TTB" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Owner</label>
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Add Record"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
