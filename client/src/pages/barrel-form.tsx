import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const today = new Date().toISOString().slice(0, 10);

export default function BarrelForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    serialNumber: "",
    productName: "",
    status: "Aging",
    fillDate: today,
    fillProof: "",
    fillVolume: "",
    warehouseZone: "",
    charLevel: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/barrels", {
        method: "POST",
        body: JSON.stringify({
          serialNumber: form.serialNumber.trim(),
          productName: form.productName.trim() || null,
          status: form.status,
          fillDate: form.fillDate || null,
          fillProof: form.fillProof ? Number(form.fillProof) : null,
          fillVolume: form.fillVolume ? Number(form.fillVolume) : null,
          warehouseZone: form.warehouseZone.trim() || null,
          charLevel: form.charLevel.trim() || null,
          notes: form.notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/barrels"] });
      toast.success("Barrel added");
      navigate("/barrels");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.serialNumber.trim()) { toast.error("Serial number is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="Add Barrel"
      subtitle="Register a new barrel into the aging program"
      breadcrumbs={[{ label: "Barrels", href: "/barrels" }, { label: "Add Barrel" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Add Barrel"
      aside={
        <>
          <InfoCard>
            <p className="font-medium text-[#0a0a0a]">Entry proof limit</p>
            <p>Per TTB 27 CFR § 19.285, whiskey must be entered into barrels at not more than 125° proof (62.5% ABV).</p>
          </InfoCard>
          <InfoCard>
            <p className="font-medium text-[#0a0a0a]">Fill volume</p>
            <p>Standard barrel sizes: 5 gal (small), 30 gal, 53 gal (standard bourbon), 59 gal (butt).</p>
          </InfoCard>
        </>
      }
    >
      <FormSection title="Identification" subtitle="Unique identification and product information">
        <FormGrid>
          <Field label="Serial Number" required hint="Unique barrel identifier">
            <Input value={form.serialNumber} onChange={set("serialNumber")} placeholder="B-2026-001" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Filled</option>
              <option>Aging</option>
              <option>Ready</option>
              <option>Dumped</option>
              <option>Retired</option>
            </Select>
          </Field>
          <Field label="Product Name" span="full">
            <Input value={form.productName} onChange={set("productName")} placeholder="e.g. Straight Bourbon Whiskey" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Fill Details" subtitle="Proof and volume at time of barrel entry">
        <FormGrid>
          <Field label="Fill Date">
            <Input type="date" value={form.fillDate} onChange={set("fillDate")} />
          </Field>
          <Field label="Fill Proof (°)" hint="Max 125° per TTB regulations">
            <Input type="number" step="0.01" min="0" max="200" value={form.fillProof} onChange={set("fillProof")} placeholder="125.0" />
          </Field>
          <Field label="Fill Volume (gal)" hint="Wine gallons at time of fill">
            <Input type="number" step="0.01" min="0" value={form.fillVolume} onChange={set("fillVolume")} placeholder="53.0" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Storage Location" subtitle="Warehouse and cooperage details">
        <FormGrid>
          <Field label="Warehouse Zone" hint="e.g. Rickhouse A, Row 3">
            <Input value={form.warehouseZone} onChange={set("warehouseZone")} placeholder="Rickhouse A" />
          </Field>
          <Field label="Char Level" hint="e.g. #3, #4, Medium+">
            <Input value={form.charLevel} onChange={set("charLevel")} placeholder="#3" />
          </Field>
          <Field label="Notes" span="full">
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Cooperage, grain bill, any special notes…"
              className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
            />
          </Field>
        </FormGrid>
      </FormSection>
    </FormLayout>
  );
}
