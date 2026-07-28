import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";

const today = new Date().toISOString().slice(0, 10);

export default function BatchForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    batchCode: "",
    batchDate: today,
    productName: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/distilling/batch-records", {
        method: "POST",
        body: JSON.stringify({
          batchCode: form.batchCode.trim(),
          batchDate: form.batchDate,
          productName: form.productName.trim() || null,
          notes: form.notes.trim() || null,
          stage: "planning",
          status: "Draft",
        }),
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/distilling/batch-records"] });
      toast.success("Batch created");
      navigate(res?.id ? `/production/${res.id}` : "/production");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.batchCode.trim()) { toast.error("Batch code is required"); return; }
    if (!form.batchDate) { toast.error("Date is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="New Production Batch"
      subtitle="Create a new batch and begin tracking through production stages"
      breadcrumbs={[{ label: "Production", href: "/production" }, { label: "New Batch" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Create Batch"
    >
      <FormSection title="Batch Identity" subtitle="Core identification for this production run">
        <FormGrid>
          <Field label="Batch Code" required hint="e.g. RUM-2026-001">
            <Input value={form.batchCode} onChange={set("batchCode")} placeholder="RUM-2026-001" />
          </Field>
          <Field label="Batch Date" required>
            <Input type="date" value={form.batchDate} onChange={set("batchDate")} />
          </Field>
          <Field label="Product Name" span="full" hint="Spirit type or brand name for this batch">
            <Input value={form.productName} onChange={set("productName")} placeholder="e.g. Silver Rum, Bourbon Whiskey" />
          </Field>
          <Field label="Notes" span="full">
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Any initial notes about this batch…"
              className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <InfoCard>
        <p className="font-medium text-[#0a0a0a]">Batch workflow</p>
        <p>After creating this batch it will enter the <strong>Planning</strong> stage. You can then progress it through Mash & Fermentation → Distillation → Barreling → Aging → Bottling inside the batch detail page.</p>
      </InfoCard>
    </FormLayout>
  );
}
