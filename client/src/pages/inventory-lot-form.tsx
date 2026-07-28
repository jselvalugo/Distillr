import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface InventoryItem { id: string; name: string; unitOfMeasure: string }

export default function InventoryLotForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    itemId: "",
    lotCode: "",
    quantity: "",
    unitOfMeasure: "",
    abv: "",
    notes: "",
  });

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: () => apiRequest("/api/inventory/items"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handleItemChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const item = items.find(i => i.id === e.target.value);
    setForm(f => ({ ...f, itemId: e.target.value, unitOfMeasure: item?.unitOfMeasure ?? f.unitOfMeasure }));
  }

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/inventory/lots", {
        method: "POST",
        body: JSON.stringify({
          itemId: form.itemId,
          lotCode: form.lotCode.trim(),
          quantity: Number(form.quantity),
          unitOfMeasure: form.unitOfMeasure.trim() || null,
          abv: form.abv ? Number(form.abv) : null,
          notes: form.notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      toast.success("Lot added");
      navigate("/inventory");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.itemId) { toast.error("Item is required"); return; }
    if (!form.lotCode.trim()) { toast.error("Lot code is required"); return; }
    if (!form.quantity || isNaN(Number(form.quantity))) { toast.error("Valid quantity is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="Add Inventory Lot"
      subtitle="Record physical stock for an inventory item"
      breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Add Lot" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Add Lot"
    >
      <FormSection title="Lot Details">
        <FormGrid>
          <Field label="Inventory Item" required>
            <Select value={form.itemId} onChange={handleItemChange}>
              <option value="">— Select an item —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Lot Code" required hint="Unique code for this lot">
            <Input value={form.lotCode} onChange={set("lotCode")} placeholder="LOT-2026-001" />
          </Field>
          <Field label="Quantity" required>
            <Input type="number" step="0.01" min="0" value={form.quantity} onChange={set("quantity")} placeholder="0" />
          </Field>
          <Field label="Unit of Measure">
            <Input value={form.unitOfMeasure} onChange={set("unitOfMeasure")} placeholder="cases" />
          </Field>
          <Field label="ABV %" hint="Alcohol by volume, if applicable">
            <Input type="number" step="0.01" min="0" max="100" value={form.abv} onChange={set("abv")} placeholder="40.0" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Batch origin, storage location, inspection notes…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
