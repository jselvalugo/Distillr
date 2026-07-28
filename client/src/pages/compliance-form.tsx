import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface Client { id: string; name: string }

export default function ComplianceForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    clientId: "",
    type: "",
    status: "Open",
    severity: "medium",
    expires: "",
    jurisdiction: "",
    owner: "",
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
      apiRequest("/api/compliance", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId || null,
          type: form.type.trim(),
          status: form.status,
          severity: form.severity,
          expires: form.expires || null,
          jurisdiction: form.jurisdiction.trim() || null,
          owner: form.owner.trim() || null,
          notes: form.notes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance"] });
      toast.success("Compliance record created");
      navigate("/compliance");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.type.trim()) { toast.error("Compliance type is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="New Compliance Record"
      subtitle="Document a compliance item, finding, or regulatory obligation"
      breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "New Record" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Create Record"
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Severity levels</p>
          <ul className="space-y-1 mt-1">
            <li><strong>Critical</strong> — immediate action required</li>
            <li><strong>High</strong> — resolve within 7 days</li>
            <li><strong>Medium</strong> — resolve within 30 days</li>
            <li><strong>Low</strong> — monitor and plan</li>
          </ul>
        </InfoCard>
      }
    >
      <FormSection title="Record Details">
        <FormGrid>
          <Field label="Compliance Type" required>
            <Input value={form.type} onChange={set("type")} placeholder="e.g. TTB Reporting, State License Renewal" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Open</option>
              <option>In Progress</option>
              <option>Resolved</option>
              <option>Waived</option>
            </Select>
          </Field>
          <Field label="Severity">
            <Select value={form.severity} onChange={set("severity")}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Expiration / Due Date">
            <Input type="date" value={form.expires} onChange={set("expires")} />
          </Field>
          <Field label="Jurisdiction">
            <Input value={form.jurisdiction} onChange={set("jurisdiction")} placeholder="e.g. Federal, Florida, TTB" />
          </Field>
          <Field label="Owner / Responsible Party">
            <Input value={form.owner} onChange={set("owner")} placeholder="Name or department" />
          </Field>
          <Field label="Related Trading Partner">
            <Select value={form.clientId} onChange={set("clientId")}>
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Internal Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={4}
            placeholder="Context, steps taken, references to regulations…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
