import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

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

const CLASS_TYPES = ["Rum"];
const COLA_STATUSES = ["pending", "approved", "rejected", "expired", "revoked"];

const empty = {
  productName: "", brandName: "", classType: "Rum", formulaNumber: "",
  colaNumber: "", status: "pending", appliedAt: "", approvedAt: "", expiresAt: "", notes: "",
};

interface ColaRegistration {
  id: string; productName: string; brandName: string; classType: string;
  formulaNumber: string | null; colaNumber: string | null; status: string;
  appliedAt: string | null; approvedAt: string | null; expiresAt: string | null; notes: string | null;
}

function formatStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

export default function ColaForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const { data: existing } = useQuery<ColaRegistration>({
    queryKey: [`/api/cola/${params.id}`],
    queryFn: () => apiRequest(`/api/cola/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        productName: existing.productName,
        brandName: existing.brandName,
        classType: existing.classType,
        formulaNumber: existing.formulaNumber ?? "",
        colaNumber: existing.colaNumber ?? "",
        status: existing.status,
        appliedAt: existing.appliedAt ?? "",
        approvedAt: existing.approvedAt ?? "",
        expiresAt: existing.expiresAt ?? "",
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    ...form,
    formulaNumber: form.formulaNumber.trim() || null,
    colaNumber: form.colaNumber.trim() || null,
    appliedAt: form.appliedAt || null,
    approvedAt: form.approvedAt || null,
    expiresAt: form.expiresAt || null,
    notes: form.notes.trim() || null,
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("/api/cola", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cola"] }); toast.success("COLA registration created"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () => apiRequest(`/api/cola/${params.id}`, { method: "PATCH", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cola"] }); toast.success("COLA registration updated"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.productName.trim()) { toast.error("Product name is required"); return; }
    if (!form.brandName.trim()) { toast.error("Brand name is required"); return; }
    if (isEdit) editMut.mutate(); else createMut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? "Edit COLA Registration" : "New COLA Registration"}
      subtitle="Certificate of Label Approval — required for interstate and export commerce"
      breadcrumbs={[{ label: "Regulatory", href: "/compliance-regulatory" }, { label: isEdit ? "Edit COLA" : "New COLA" }]}
      onSave={save}
      saving={createMut.isPending || editMut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Create COLA"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">About COLA</p>
          <p>The TTB issues Certificates of Label Approval (COLA) for distilled spirits sold in interstate commerce. Apply via TTB's COLAs Online portal and record the assigned number here upon approval.</p>
        </InfoCard>
      }
    >
      <FormSection title="Product Information">
        <FormGrid>
          <Field label="Product Name" required>
            <Select value={form.productName} onChange={set("productName")}>
              <option value="">— Select product —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Brand Name" required>
            <Input value={form.brandName} onChange={set("brandName")} placeholder="e.g. Libertalia" />
          </Field>
          <Field label="Class / Type">
            <Select value={form.classType} onChange={set("classType")}>
              {CLASS_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {COLA_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </Select>
          </Field>
          <Field label="Formula Number" hint="TTB-assigned formula number, if applicable">
            <Input value={form.formulaNumber} onChange={set("formulaNumber")} placeholder="Optional" />
          </Field>
          <Field label="COLA Number" hint="Assigned by TTB upon approval">
            <Input value={form.colaNumber} onChange={set("colaNumber")} placeholder="Assigned by TTB" />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Key Dates">
        <FormGrid cols={3}>
          <Field label="Applied">
            <Input type="date" value={form.appliedAt} onChange={set("appliedAt")} />
          </Field>
          <Field label="Approved">
            <Input type="date" value={form.approvedAt} onChange={set("approvedAt")} />
          </Field>
          <Field label="Expires">
            <Input type="date" value={form.expiresAt} onChange={set("expiresAt")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Label description, revision history, TTB correspondence…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
