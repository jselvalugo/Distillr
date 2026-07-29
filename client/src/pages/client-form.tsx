import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { Client } from "@shared/schema";

const emptyForm = {
  name: "", type: "Distributor", contact: "", contactEmail: "",
  contactPhone: "", status: "Active", industrySegment: "",
  accountTier: "", notes: "", website: "", billingAddress: "",
};

export default function ClientForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!(params as any).id;
  const clientId = (params as any).id as string | undefined;

  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: existing } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: () => apiRequest(`/api/clients/${clientId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? "",
        type: existing.type ?? "Distributor",
        contact: existing.contact ?? "",
        contactEmail: existing.contactEmail ?? "",
        contactPhone: existing.contactPhone ?? "",
        status: existing.status ?? "Active",
        industrySegment: (existing as any).industrySegment ?? "",
        accountTier: (existing as any).accountTier ?? "",
        notes: (existing as any).notes ?? "",
        website: (existing as any).website ?? "",
        billingAddress: (existing as any).billingAddress ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        type: form.type,
        contact: form.contact.trim(),
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        status: form.status,
        industrySegment: form.industrySegment.trim() || null,
        accountTier: form.accountTier || null,
        notes: form.notes.trim() || null,
        website: form.website.trim() || null,
        billingAddress: form.billingAddress.trim() || null,
      };
      if (isEdit) {
        return apiRequest(`/api/clients/${clientId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiRequest("/api/clients", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast.success(isEdit ? "Partner updated" : "Trading partner created");
      navigate("/clients");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    if (!form.contact.trim()) { toast.error("Primary contact is required"); return; }
    mut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? `Edit Partner — ${form.name || "…"}` : "New Trading Partner"}
      subtitle={isEdit ? "Update partner details below" : "Add a distributor, retailer, supplier, or contract partner"}
      breadcrumbs={[{ label: "Trading Partners", href: "/clients" }, { label: isEdit ? "Edit Partner" : "New Partner" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Create Partner"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Partner types</p>
          <ul className="space-y-1 mt-1">
            <li><strong>Distributor</strong> — wholesale distribution</li>
            <li><strong>Retailer</strong> — direct-to-consumer</li>
            <li><strong>Supplier</strong> — raw materials / cooperage</li>
            <li><strong>Contract Partner</strong> — co-packing, tolling</li>
            <li><strong>Regulatory</strong> — government agencies</li>
          </ul>
        </InfoCard>
      }
    >
      <FormSection title="Company Information">
        <FormGrid>
          <Field label="Company Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="Acme Distributors LLC" />
          </Field>
          <Field label="Partner Type">
            <Select value={form.type} onChange={set("type")}>
              <option>Distributor</option>
              <option>Retailer</option>
              <option>Supplier</option>
              <option>Contract Partner</option>
              <option>Regulatory</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Active</option>
              <option>Prospective</option>
              <option>Inactive</option>
            </Select>
          </Field>
          <Field label="Account Tier">
            <Select value={form.accountTier} onChange={set("accountTier")}>
              <option value="">— None —</option>
              <option>Tier 1</option>
              <option>Tier 2</option>
              <option>Strategic</option>
              <option>Seasonal</option>
            </Select>
          </Field>
          <Field label="Industry Segment">
            <Input value={form.industrySegment} onChange={set("industrySegment")} placeholder="e.g. On-premise, Off-premise" />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={set("website")} placeholder="https://…" />
          </Field>
          <Field label="Billing Address" span="full">
            <Input value={form.billingAddress} onChange={set("billingAddress")} placeholder="123 Main St, City, State ZIP" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Primary Contact">
        <FormGrid>
          <Field label="Contact Name" required>
            <Input value={form.contact} onChange={set("contact")} placeholder="Jane Smith" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="jane@example.com" />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={form.contactPhone} onChange={set("contactPhone")} placeholder="(555) 000-0000" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Internal Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={4}
            placeholder="Payment terms, shipping preferences, relationship context…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
