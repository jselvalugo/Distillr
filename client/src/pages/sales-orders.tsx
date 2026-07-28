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
import type { SalesOrder, Client } from "@shared/schema";

const emptyForm = {
  orderNumber: "",
  clientId: "",
  orderDate: new Date().toISOString().slice(0, 10),
  status: "Draft",
  currency: "USD",
  notes: "",
};

export default function SalesOrders() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data: orders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["/api/sales-orders"],
    queryFn: () => apiRequest("/api/sales-orders"),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({ ...d, lineItems: [] }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Order created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (clientMap[o.clientId] ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Sales Orders"
        subtitle={`${orders.length} order${orders.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <Input
              placeholder="Search order # or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button onClick={() => navigate("/sales-orders/new")}>+ New Order</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Order #</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Order Date</Th>
                <Th>Ship Date</Th>
                <Th>Fulfilled</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center text-[#737373] py-10">
                    {search ? "No orders match your search" : "No sales orders yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-mono font-medium">{o.orderNumber}</Td>
                    <Td>{clientMap[o.clientId] ?? o.clientId}</Td>
                    <Td>{statusBadge(o.status)}</Td>
                    <Td>{fmt(o.orderDate)}</Td>
                    <Td>{fmt(o.requestedShipDate)}</Td>
                    <Td>{fmt(o.fulfilledDate)}</Td>
                    <Td>{o.totalAmount != null ? `$${fmtNum(o.totalAmount)}` : "—"}</Td>
                    <Td>{o.currency}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="New Sales Order">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Order Number *</label>
              <Input value={form.orderNumber} onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))} placeholder="e.g. SO-2025-001" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Client</label>
              <Select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Order Date</label>
              <Input type="date" value={form.orderDate} onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {["Draft", "Approved", "Fulfilled", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Currency</label>
              <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Create Order"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
