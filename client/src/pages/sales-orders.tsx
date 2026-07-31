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
import type { SalesOrder, Client } from "@shared/schema";

// ---------------------------------------------------------------------------
// Read-only detail dialog
// ---------------------------------------------------------------------------
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-[#f0f0f0] last:border-0">
      <span className="text-xs text-[#737373] w-40 shrink-0">{label}</span>
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

function OrderDetailDialog({ order, clientName, onClose, onEdit }: {
  order: SalesOrder;
  clientName: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Dialog open onClose={onClose} title={`${order.orderNumber} — Order Detail`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Section title="Order Overview">
          <DetailRow label="Order Number" value={<span className="font-mono">{order.orderNumber}</span>} />
          <DetailRow label="Client" value={clientName} />
          <DetailRow label="Status" value={statusBadge(order.status)} />
          <DetailRow label="Order Date" value={fmt(order.orderDate)} />
          <DetailRow label="Ship Date" value={fmt(order.requestedShipDate)} />
          <DetailRow label="Fulfilled Date" value={fmt(order.fulfilledDate)} />
          <DetailRow label="Currency" value={order.currency} />
          <DetailRow label="Total Amount" value={
            order.totalAmount != null
              ? <span className="font-semibold text-[#0369a1]">${fmtNum(order.totalAmount)}</span>
              : null
          } />
        </Section>

        {order.lineItems && order.lineItems.length > 0 && (
          <Section title="Line Items">
            {order.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between items-start py-1.5 border-b border-[#f0f0f0] last:border-0">
                <span className="text-xs text-[#737373]">
                  {item.sku} — {item.description}
                  <span className="ml-1 text-[#0a0a0a]">×{item.quantity}</span>
                </span>
                <span className="text-xs font-medium text-[#0a0a0a]">${fmtNum(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </Section>
        )}

        {order.notes && (
          <Section title="Notes">
            <p className="text-xs text-[#0a0a0a] py-1.5">{order.notes}</p>
          </Section>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit Order →</Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------
const STATUSES = ["Draft", "Approved", "Fulfilled", "Cancelled"] as const;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SalesOrders() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewTarget, setViewTarget] = useState<SalesOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null);

  const { data: orders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["/api/sales-orders"],
    queryFn: () => apiRequest("/api/sales-orders"),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/sales-orders/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      setDeleteTarget(null);
      toast.success("Order deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (clientMap[o.clientId] ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <PageHeader
        title="Sales Orders"
        subtitle={`${filtered.length} of ${orders.length} order${orders.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <div className="flex items-center gap-1 bg-white border border-[#e5e5e5] rounded-md p-0.5">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
              >
                All
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === s ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
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
                <Th className="hidden md:table-cell">Client</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Order Date</Th>
                <Th className="hidden md:table-cell">Ship Date</Th>
                <Th className="hidden md:table-cell">Fulfilled</Th>
                <Th>Amount</Th>
                <Th className="hidden md:table-cell">Currency</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={9} className="text-center text-[#737373] py-10">
                    {search || statusFilter !== "all" ? "No orders match your filter" : "No sales orders yet — create one to get started"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((o) => (
                  <Tr
                    key={o.id}
                    className="cursor-pointer hover:bg-[#f7f7f7]"
                    onClick={() => setViewTarget(o)}
                  >
                    <Td className="font-mono font-medium text-[#0a0a0a]">{o.orderNumber}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{clientMap[o.clientId] ?? "—"}</Td>
                    <Td>{statusBadge(o.status)}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{fmt(o.orderDate)}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{fmt(o.requestedShipDate) ?? "—"}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{fmt(o.fulfilledDate) ?? "—"}</Td>
                    <Td className="text-[#737373]">{o.totalAmount != null ? `$${fmtNum(o.totalAmount)}` : "—"}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{o.currency}</Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewTarget(o)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="View order"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => navigate(`/sales-orders/${o.id}/edit`)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="Edit order"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(o)}
                          className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                          title="Delete order"
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
        </div>
      </div>

      {viewTarget && (
        <OrderDetailDialog
          order={viewTarget}
          clientName={clientMap[viewTarget.clientId] ?? viewTarget.clientId}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setViewTarget(null); navigate(`/sales-orders/${viewTarget.id}/edit`); }}
        />
      )}

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Order">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to delete order{" "}
              <span className="font-mono font-semibold">{deleteTarget.orderNumber}</span>?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the order and all line items. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete Order"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Layout>
  );
}
