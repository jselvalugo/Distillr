import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { SalesOrder } from "@shared/schema";

const today = new Date().toISOString().slice(0, 10);

interface Client { id: string; name: string }

const emptyForm = {
  orderNumber: "",
  clientId: "",
  orderDate: today,
  status: "Draft",
  currency: "USD",
  notes: "",
};

export default function SalesOrderForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!(params as any).id;
  const orderId = (params as any).id as string | undefined;

  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: existing } = useQuery<SalesOrder>({
    queryKey: ["/api/sales-orders", orderId],
    queryFn: () => apiRequest(`/api/sales-orders/${orderId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        orderNumber: existing.orderNumber,
        clientId: existing.clientId ?? "",
        orderDate: existing.orderDate,
        status: existing.status,
        currency: existing.currency ?? "USD",
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        orderNumber: form.orderNumber.trim(),
        clientId: form.clientId || null,
        orderDate: form.orderDate,
        status: form.status,
        currency: form.currency,
        notes: form.notes.trim() || null,
        lineItems: existing?.lineItems ?? [],
      };
      if (isEdit) {
        return apiRequest(`/api/sales-orders/${orderId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiRequest("/api/sales-orders", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast.success(isEdit ? "Order updated" : "Sales order created");
      navigate("/sales-orders");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.orderNumber.trim()) { toast.error("Order number is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? `Edit Order — ${form.orderNumber || "…"}` : "New Sales Order"}
      subtitle={isEdit ? "Update order details below" : "Create a sales order for a trading partner"}
      breadcrumbs={[{ label: "Sales Orders", href: "/sales-orders" }, { label: isEdit ? "Edit Order" : "New Order" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Create Order"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Order workflow</p>
          <p>Move through Draft → Approved → Fulfilled as the order progresses.</p>
        </InfoCard>
      }
    >
      <FormSection title="Order Details">
        <FormGrid>
          <Field label="Order Number" required hint="Unique identifier for this order">
            <Input value={form.orderNumber} onChange={set("orderNumber")} placeholder="SO-2026-001" />
          </Field>
          <Field label="Order Date">
            <Input type="date" value={form.orderDate} onChange={set("orderDate")} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Draft</option>
              <option>Approved</option>
              <option>Fulfilled</option>
              <option>Cancelled</option>
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={set("currency")}>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </Select>
          </Field>
          <Field label="Trading Partner" span="full">
            <Select value={form.clientId} onChange={set("clientId")}>
              <option value="">— Select a partner —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Order Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={4}
            placeholder="Delivery instructions, payment terms, special requirements…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
