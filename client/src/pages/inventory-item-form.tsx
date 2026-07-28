import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export default function InventoryItemForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    category: "Finished Goods",
    unitOfMeasure: "cases",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/inventory/items", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          unitOfMeasure: form.unitOfMeasure.trim(),
          notes: form.notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      toast.success("Inventory item created");
      navigate("/inventory");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.name.trim()) { toast.error("Item name is required"); return; }
    if (!form.category) { toast.error("Category is required"); return; }
    if (!form.unitOfMeasure.trim()) { toast.error("Unit of measure is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="New Inventory Item"
      subtitle="Define a product or material tracked in inventory"
      breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "New Item" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Create Item"
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Items vs. Lots</p>
          <p>An <strong>item</strong> defines the product (e.g., "Silver Rum 750ml"). <strong>Lots</strong> represent physical stock of that item with quantities, ABV, and lot codes. Add lots after creating the item.</p>
        </InfoCard>
      }
    >
      <FormSection title="Item Details">
        <FormGrid>
          <Field label="Item Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Silver Rum 750ml" />
          </Field>
          <Field label="Category" required>
            <Select value={form.category} onChange={set("category")}>
              <option>Finished Goods</option>
              <option>Raw Materials</option>
              <option>Packaging</option>
              <option>Supplies</option>
              <option>Work in Progress</option>
            </Select>
          </Field>
          <Field label="Unit of Measure" required hint="e.g. cases, bottles, gallons, kg">
            <Input value={form.unitOfMeasure} onChange={set("unitOfMeasure")} placeholder="cases" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Description, specifications, supplier info…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
