import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const STATE_RATES: Record<string, { name: string; rate: number }> = {
  CA: { name: "California", rate: 3.30 }, NY: { name: "New York", rate: 6.44 },
  TX: { name: "Texas", rate: 2.40 }, FL: { name: "Florida", rate: 9.53 },
  WA: { name: "Washington", rate: 14.27 }, IL: { name: "Illinois", rate: 8.55 },
  PA: { name: "Pennsylvania", rate: 7.24 }, OH: { name: "Ohio", rate: 9.34 },
  GA: { name: "Georgia", rate: 3.79 }, NC: { name: "North Carolina", rate: 12.06 },
  MI: { name: "Michigan", rate: 11.98 }, NJ: { name: "New Jersey", rate: 5.50 },
  VA: { name: "Virginia", rate: 19.88 }, CO: { name: "Colorado", rate: 2.28 },
  AZ: { name: "Arizona", rate: 3.00 }, MA: { name: "Massachusetts", rate: 4.05 },
  TN: { name: "Tennessee", rate: 4.40 }, OR: { name: "Oregon", rate: 22.73 },
  MN: { name: "Minnesota", rate: 5.03 }, WI: { name: "Wisconsin", rate: 3.25 },
  MO: { name: "Missouri", rate: 2.00 }, AL: { name: "Alabama", rate: 9.16 },
  SC: { name: "South Carolina", rate: 5.42 }, KY: { name: "Kentucky", rate: 1.92 },
  IN: { name: "Indiana", rate: 2.68 }, CT: { name: "Connecticut", rate: 5.40 },
  MD: { name: "Maryland", rate: 1.50 }, NV: { name: "Nevada", rate: 3.60 },
  NM: { name: "New Mexico", rate: 6.06 },
};

const EXCISE_STATUSES = ["draft", "filed", "amended"];
function formatStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

const empty = {
  state: "FL", periodStart: "", periodEnd: "", dueDate: "",
  status: "draft", totalProofGallons: "", ratePerProofGallon: String(STATE_RATES["FL"].rate), notes: "",
};

interface StateExciseReturn {
  id: string; state: string; periodStart: string; periodEnd: string; dueDate: string;
  status: string; totalProofGallons: number; ratePerProofGallon: number; notes: string | null;
}

export default function ExciseForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const { data: existing } = useQuery<StateExciseReturn>({
    queryKey: [`/api/state-excise/${params.id}`],
    queryFn: () => apiRequest(`/api/state-excise/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        state: existing.state,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
        dueDate: existing.dueDate,
        status: existing.status,
        totalProofGallons: String(existing.totalProofGallons),
        ratePerProofGallon: String(existing.ratePerProofGallon),
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const st = e.target.value;
    const rate = STATE_RATES[st]?.rate ?? 0;
    setForm(f => ({ ...f, state: st, ratePerProofGallon: String(rate) }));
  }

  function handlePeriodEnd(e: React.ChangeEvent<HTMLInputElement>) {
    const end = e.target.value;
    let dueDate = form.dueDate;
    if (end && form.state === "FL") {
      const d = new Date(end + "T00:00:00");
      d.setMonth(d.getMonth() + 1);
      d.setDate(15);
      dueDate = d.toISOString().slice(0, 10);
    }
    setForm(f => ({ ...f, periodEnd: end, dueDate }));
  }

  const liveTotal = Number(form.totalProofGallons || 0) * Number(form.ratePerProofGallon || 0);

  const payload = () => ({
    ...form,
    totalProofGallons: Number(form.totalProofGallons),
    ratePerProofGallon: Number(form.ratePerProofGallon),
    notes: form.notes.trim() || null,
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("/api/state-excise", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/state-excise"] }); toast.success("Excise return created"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () => apiRequest(`/api/state-excise/${params.id}`, { method: "PATCH", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/state-excise"] }); toast.success("Excise return updated"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.periodStart) { toast.error("Period start is required"); return; }
    if (!form.periodEnd) { toast.error("Period end is required"); return; }
    if (!form.totalProofGallons) { toast.error("Proof gallons is required"); return; }
    if (isEdit) editMut.mutate(); else createMut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? "Edit Excise Return" : "New Excise Return"}
      subtitle="File a state excise tax return for distilled spirits"
      breadcrumbs={[{ label: "Regulatory", href: "/compliance-regulatory" }, { label: isEdit ? "Edit Return" : "New Return" }]}
      onSave={save}
      saving={createMut.isPending || editMut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Create Return"}
      aside={
        <>
          <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-4 text-xs space-y-2">
            <p className="font-medium text-[#0369a1]">Estimated Total Tax</p>
            <p className="text-2xl font-bold text-[#0a0a0a]">${liveTotal.toFixed(2)}</p>
            {form.state === "FL" && (
              <p className="text-[10px] text-[#737373]">
                FL craft credit (§ 565.108): eligible distillers (&lt;75k gal/yr) deduct 7% → net ${(liveTotal * 0.93).toFixed(2)}
              </p>
            )}
          </div>
          <InfoCard>
            <p className="font-medium text-[#0a0a0a]">Filing deadlines</p>
            <p>Most states require monthly returns due on the 15th of the following month. Florida follows this schedule under § 565.12.</p>
          </InfoCard>
        </>
      }
    >
      <FormSection title="Return Details">
        <FormGrid>
          <Field label="State">
            <Select value={form.state} onChange={handleStateChange}>
              {Object.entries(STATE_RATES).map(([code, { name }]) => (
                <option key={code} value={code}>{code} — {name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {EXCISE_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </Select>
          </Field>
          <Field label="Period Start" required>
            <Input type="date" value={form.periodStart} onChange={set("periodStart")} />
          </Field>
          <Field label="Period End" required>
            <Input type="date" value={form.periodEnd} onChange={handlePeriodEnd} />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={form.dueDate} onChange={set("dueDate")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Tax Calculation">
        <FormGrid>
          <Field label="Total Proof Gallons" required>
            <Input type="number" step="0.001" min="0" value={form.totalProofGallons} onChange={set("totalProofGallons")} placeholder="0.000" />
          </Field>
          <Field label="Rate per Proof Gallon ($)" hint="Auto-filled from state; adjust if needed">
            <Input type="number" step="0.01" min="0" value={form.ratePerProofGallon} onChange={set("ratePerProofGallon")} placeholder="0.00" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Filing reference, adjustments, payment confirmation…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
