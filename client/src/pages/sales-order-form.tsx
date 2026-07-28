import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const today = new Date().toISOString().slice(0, 10);

interface Client { id: string; name: string }

export default function SalesOrderForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    orderNumber: "",
    clientId: "",
    orderDate: today,
    status: "Draft",
    currency: "USD",
    notes: "",
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify({
          orderNumber: form.orderNumber.trim(),
          clientId: form.clientId || null,
          orderDate: form.orderDate,
          status: form.status,
          currency: form.currency,
          notes: form.notes.trim() || null,
          lineItems: [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast.success("Sales order created");
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
      title="New Sales Order"
      subtitle="Create a sales order for a trading partner"
      breadcrumbs={[{ label: "Sales Orders", href: "/sales-orders" }, { label: "New Order" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Create Order"
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Order workflow</p>
          <p>Create the order here, then add line items from the order detail page. Move through Draft → Confirmed → Shipped → Invoiced as the order progresses.</p>
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
              <option>Confirmed</option>
              <option>Shipped</option>
              <option>Invoiced</option>
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
