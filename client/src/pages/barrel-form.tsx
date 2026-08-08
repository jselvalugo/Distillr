import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { Barrel } from "@shared/schema";

const LOC_SUITES = ["206", "207", "208"];
const LOC_ZONES  = ["A", "B", "C"];
const LOC_LEVELS = ["1", "2", "3"];

function parseLocation(val: string) {
  const [suite = "", zone = "", level = ""] = val.split("-");
  return { suite, zone, level };
}

function LocationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { suite, zone, level } = parseLocation(value);
  const emit = (s: string, z: string, l: string) => onChange([s, z, l].filter(Boolean).join("-"));
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] text-[#a3a3a3] mb-0.5">Suite</p>
          <Select value={suite} onChange={(e) => emit(e.target.value, zone, level)}>
            <option value="">—</option>
            {LOC_SUITES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-[#a3a3a3] mb-0.5">Zone</p>
          <Select value={zone} onChange={(e) => emit(suite, e.target.value, level)}>
            <option value="">—</option>
            {LOC_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </Select>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-[#a3a3a3] mb-0.5">Level</p>
          <Select value={level} onChange={(e) => emit(suite, zone, e.target.value)}>
            <option value="">—</option>
            {LOC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
      </div>
      {value && <p className="text-[10px] text-[#737373] font-mono">{value}</p>}
    </div>
  );
}

const PRODUCTS = [
  "Original Pitorro",
  "Coconut Pitorro",
  "Citrus Pitorro",
  "Café Pitorro",
  "Libertalia",
  "Oak Aged Libertalia",
  "Riskey",
  "Riskey Barrel Strength",
  "Coquito",
  "Libations",
  "Yo-Ho",
] as const;

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  serialNumber: "",
  productName: "",
  status: "Aging",
  fillDate: today,
  fillProof: "",
  fillVolume: "",
  warehouseZone: "",
  charLevel: "",
  notes: "",
};

export default function BarrelForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();

  const [form, setForm] = useState(emptyForm);

  const { data: existing, isLoading: loadingExisting } = useQuery<Barrel>({
    queryKey: ["/api/barrels", params.id],
    queryFn: () => apiRequest(`/api/barrels/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        serialNumber: existing.serialNumber ?? "",
        productName: existing.productName ?? "",
        status: existing.status ?? "Aging",
        fillDate: existing.fillDate ? String(existing.fillDate).slice(0, 10) : "",
        fillProof: existing.fillProof != null ? String(existing.fillProof) : "",
        fillVolume: existing.fillVolume != null ? String(existing.fillVolume) : "",
        warehouseZone: existing.warehouseZone ?? "",
        charLevel: existing.charLevel ?? "",
        notes: (existing as any).notes ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    serialNumber: form.serialNumber.trim(),
    productName: form.productName.trim() || null,
    status: form.status,
    fillDate: form.fillDate || null,
    fillProof: form.fillProof ? Number(form.fillProof) : null,
    fillVolume: form.fillVolume ? Number(form.fillVolume) : null,
    warehouseZone: form.warehouseZone.trim() || null,
    charLevel: form.charLevel.trim() || null,
    notes: form.notes.trim() || null,
  });

  const mut = useMutation({
    mutationFn: () =>
      isEdit
        ? apiRequest(`/api/barrels/${params.id}`, { method: "PATCH", body: JSON.stringify(payload()) })
        : apiRequest("/api/barrels", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/barrels"] });
      toast.success(isEdit ? "Barrel updated" : "Barrel added");
      navigate("/barrels");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.serialNumber.trim()) { toast.error("Serial number is required"); return; }
    mut.mutate();
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[#737373]">
        Loading barrel…
      </div>
    );
  }

  return (
    <FormLayout
      title={isEdit ? `Edit Barrel — ${existing?.serialNumber ?? ""}` : "Add Barrel"}
      subtitle={isEdit ? "Update barrel record and storage details" : "Register a new barrel into the aging program"}
      breadcrumbs={[{ label: "Barrels", href: "/barrels" }, { label: isEdit ? "Edit Barrel" : "Add Barrel" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Add Barrel"}
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
            <Select value={form.productName} onChange={set("productName")}>
              <option value="">— Select product —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
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
          <Field label="Location" hint="Suite · Zone · Level (e.g. 207-C-2)" span="full">
            <LocationPicker value={form.warehouseZone} onChange={(v) => setForm(f => ({ ...f, warehouseZone: v }))} />
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
