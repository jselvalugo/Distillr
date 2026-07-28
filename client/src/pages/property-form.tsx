import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface Client { id: string; name: string }

export default function PropertyForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    address: "",
    clientId: "",
    type: "Production",
    status: "Active",
    region: "",
    siteContact: "",
    siteContactPhone: "",
    accessNotes: "",
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/properties", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          clientId: form.clientId || null,
          type: form.type,
          status: form.status,
          region: form.region.trim() || null,
          siteContact: form.siteContact.trim() || null,
          siteContactPhone: form.siteContactPhone.trim() || null,
          accessNotes: form.accessNotes.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/properties"] });
      toast.success("Facility added");
      navigate("/properties");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.name.trim()) { toast.error("Facility name is required"); return; }
    if (!form.address.trim()) { toast.error("Address is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title="Add Facility"
      subtitle="Register a production, storage, or office facility"
      breadcrumbs={[{ label: "Facilities", href: "/properties" }, { label: "Add Facility" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Add Facility"
    >
      <FormSection title="Facility Information">
        <FormGrid>
          <Field label="Facility Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Main Rickhouse" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={set("type")}>
              <option>Production</option>
              <option>Storage</option>
              <option>Office</option>
              <option>Retail</option>
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Active</option>
              <option>Inactive</option>
              <option>Under Construction</option>
            </Select>
          </Field>
          <Field label="Region">
            <Input value={form.region} onChange={set("region")} placeholder="e.g. Southeast, Lot B" />
          </Field>
          <Field label="Address" required span="full">
            <Input value={form.address} onChange={set("address")} placeholder="123 Distillery Lane, Tampa, FL 33601" />
          </Field>
          <Field label="Associated Trading Partner">
            <Select value={form.clientId} onChange={set("clientId")}>
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Site Contact">
        <FormGrid>
          <Field label="Site Contact Name">
            <Input value={form.siteContact} onChange={set("siteContact")} placeholder="Jane Smith" />
          </Field>
          <Field label="Contact Phone">
            <Input type="tel" value={form.siteContactPhone} onChange={set("siteContactPhone")} placeholder="(555) 000-0000" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Access Notes">
        <Field label="Access & Entry Instructions">
          <textarea
            value={form.accessNotes}
            onChange={set("accessNotes")}
            rows={3}
            placeholder="Gate codes, hours, special instructions…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
