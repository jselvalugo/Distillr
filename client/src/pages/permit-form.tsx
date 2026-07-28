import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const PERMIT_TYPES = ["DSP Federal", "Basic Federal", "State Permit", "Surety Bond", "Other"];

const today = new Date().toISOString().slice(0, 10);

const empty = {
  permitType: "DSP Federal",
  permitNumber: "",
  issuingAuthority: "",
  state: "",
  issueDate: today,
  expirationDate: "",
  reminderDaysBefore: "90",
  notes: "",
};

interface Permit {
  id: string; permitType: string; permitNumber: string; issuingAuthority: string;
  state: string | null; issueDate: string; expirationDate: string;
  reminderDaysBefore: number; notes: string | null;
}

export default function PermitForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const { data: existing } = useQuery<Permit>({
    queryKey: [`/api/permits/${params.id}`],
    queryFn: () => apiRequest(`/api/permits/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        permitType: existing.permitType,
        permitNumber: existing.permitNumber,
        issuingAuthority: existing.issuingAuthority,
        state: existing.state ?? "",
        issueDate: existing.issueDate,
        expirationDate: existing.expirationDate,
        reminderDaysBefore: String(existing.reminderDaysBefore),
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    ...form,
    state: form.state || null,
    notes: form.notes.trim() || null,
    reminderDaysBefore: Number(form.reminderDaysBefore),
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("/api/permits", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/permits"] }); toast.success("Permit added"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () => apiRequest(`/api/permits/${params.id}`, { method: "PATCH", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/permits"] }); toast.success("Permit updated"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.permitNumber.trim()) { toast.error("Permit number is required"); return; }
    if (!form.issuingAuthority.trim()) { toast.error("Issuing authority is required"); return; }
    if (!form.expirationDate) { toast.error("Expiration date is required"); return; }
    if (isEdit) editMut.mutate(); else createMut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? "Edit Permit" : "Add Permit"}
      subtitle="Track federal and state permits, bonds, and licenses"
      breadcrumbs={[{ label: "Regulatory", href: "/compliance-regulatory" }, { label: isEdit ? "Edit Permit" : "Add Permit" }]}
      onSave={save}
      saving={createMut.isPending || editMut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Add Permit"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Reminder alerts</p>
          <p>Set reminder days to receive early warning before expiration. Common values: 90 days (federal), 30 days (state bonds).</p>
        </InfoCard>
      }
    >
      <FormSection title="Permit Details">
        <FormGrid>
          <Field label="Permit Type">
            <Select value={form.permitType} onChange={set("permitType")}>
              {PERMIT_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Permit Number" required>
            <Input value={form.permitNumber} onChange={set("permitNumber")} placeholder="DSP-TX-20001" />
          </Field>
          <Field label="Issuing Authority" required>
            <Input value={form.issuingAuthority} onChange={set("issuingAuthority")} placeholder="TTB, State ABC Board…" />
          </Field>
          <Field label="State" hint="2-letter code, leave blank for federal">
            <Input value={form.state} onChange={set("state")} placeholder="FL" maxLength={2} />
          </Field>
          <Field label="Issue Date">
            <Input type="date" value={form.issueDate} onChange={set("issueDate")} />
          </Field>
          <Field label="Expiration Date" required>
            <Input type="date" value={form.expirationDate} onChange={set("expirationDate")} />
          </Field>
          <Field label="Reminder Days Before Expiry">
            <Input type="number" min="1" value={form.reminderDaysBefore} onChange={set("reminderDaysBefore")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Renewal requirements, contact info, filing notes…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
