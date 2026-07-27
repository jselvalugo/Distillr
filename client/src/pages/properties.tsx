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
import type { Property, Client } from "@shared/schema";

const emptyForm = {
  name: "",
  address: "",
  clientId: "",
  type: "Distillery",
  status: "Active",
  region: "",
  siteContact: "",
  siteContactPhone: "",
  accessNotes: "",
};

export default function Properties() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: () => apiRequest("/api/properties"),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/properties", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/properties"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Facility added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const filtered = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Facilities"
        subtitle={`${properties.length} location${properties.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <Input
              placeholder="Search name or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button onClick={() => setOpen(true)}>+ Add Facility</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Client</Th>
                <Th>Region</Th>
                <Th>Site Contact</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="text-center text-[#737373] py-10">
                    {search ? "No facilities match your search" : "No facilities yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="text-[#737373] max-w-xs truncate">{p.address}</Td>
                    <Td>{p.type ?? "—"}</Td>
                    <Td>{p.status ? statusBadge(p.status) : "—"}</Td>
                    <Td>{clientMap[p.clientId] ?? p.clientId}</Td>
                    <Td>{p.region ?? "—"}</Td>
                    <Td>{p.siteContact ?? "—"}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="Add Facility">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {["Distillery", "Rickhouse", "Warehouse", "Bonded Area", "Bottling Hall", "Lab"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Address *</label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Client</label>
              <Select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {["Active", "Maintenance", "Standby", "Inactive"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Region</label>
              <Input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Site Contact</label>
              <Input value={form.siteContact} onChange={(e) => setForm((f) => ({ ...f, siteContact: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Site Contact Phone</label>
              <Input value={form.siteContactPhone} onChange={(e) => setForm((f) => ({ ...f, siteContactPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Access Notes</label>
              <Input value={form.accessNotes} onChange={(e) => setForm((f) => ({ ...f, accessNotes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Add Facility"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
