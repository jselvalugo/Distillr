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
import type { Client } from "@shared/schema";

const emptyForm = {
  name: "",
  type: "Distributor",
  contact: "",
  contactEmail: "",
  contactPhone: "",
  status: "Active",
  industrySegment: "",
  accountTier: "",
  notes: "",
};

export default function Clients() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/clients", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Trading partner added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Trading Partners"
        subtitle={`${clients.length} accounts`}
        actions={
          <>
            <Input
              placeholder="Search name or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button onClick={() => navigate("/clients/new")}>+ Add Partner</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Contact</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Tier</Th>
                <Th>Segment</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center text-[#737373] py-10">
                    {search ? "No partners match your search" : "No trading partners yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td>{c.type}</Td>
                    <Td>{statusBadge(c.status)}</Td>
                    <Td>{c.contact}</Td>
                    <Td>{c.contactEmail ?? "—"}</Td>
                    <Td>{c.contactPhone ?? "—"}</Td>
                    <Td>{c.accountTier ?? "—"}</Td>
                    <Td>{c.industrySegment ?? "—"}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="Add Trading Partner">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Company Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {["Distributor", "Retailer", "Supplier", "Contract Partner", "Regulatory"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Primary Contact *</label>
              <Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contact Email</label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Contact Phone</label>
              <Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {["Active", "Prospective", "Inactive"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Industry Segment</label>
              <Input value={form.industrySegment} onChange={(e) => setForm((f) => ({ ...f, industrySegment: e.target.value }))} placeholder="e.g. Spirits" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Account Tier</label>
              <Select value={form.accountTier} onChange={(e) => setForm((f) => ({ ...f, accountTier: e.target.value }))}>
                <option value="">—</option>
                {["Tier 1", "Tier 2", "Strategic", "Seasonal"].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Add Partner"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
