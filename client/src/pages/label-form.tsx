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
const LABEL_STATUSES = ["draft", "approved", "in_use", "retired"];

const empty = {
  productName: "", sku: "", version: "1.0", colaId: "", netContents: "",
  alcoholContent: "", classType: "Rum", status: "draft", approvedAt: "", notes: "",
};

interface LabelRecord {
  id: string; productName: string; sku: string; version: string; colaId: string | null;
  netContents: string | null; alcoholContent: number | null; classType: string;
  status: string; approvedAt: string | null; notes: string | null;
}
interface ColaRegistration { id: string; productName: string; colaNumber: string | null; status: string }

function formatStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

export default function LabelForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const { data: existing } = useQuery<LabelRecord>({
    queryKey: [`/api/labels/${params.id}`],
    queryFn: () => apiRequest(`/api/labels/${params.id}`),
    enabled: isEdit,
  });

  const { data: colaList = [] } = useQuery<ColaRegistration[]>({
    queryKey: ["/api/cola"],
    queryFn: () => apiRequest("/api/cola"),
  });

  const approvedCola = colaList.filter(c => c.status === "approved");

  useEffect(() => {
    if (existing) {
      setForm({
        productName: existing.productName,
        sku: existing.sku,
        version: existing.version,
        colaId: existing.colaId ?? "",
        netContents: existing.netContents ?? "",
        alcoholContent: existing.alcoholContent != null ? String(existing.alcoholContent) : "",
        classType: existing.classType,
        status: existing.status,
        approvedAt: existing.approvedAt ?? "",
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const payload = () => ({
    ...form,
    colaId: form.colaId || null,
    netContents: form.netContents.trim() || null,
    alcoholContent: form.alcoholContent ? Number(form.alcoholContent) : null,
    approvedAt: form.approvedAt || null,
    notes: form.notes.trim() || null,
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("/api/labels", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/labels"] }); toast.success("Label record created"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () => apiRequest(`/api/labels/${params.id}`, { method: "PATCH", body: JSON.stringify(payload()) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/labels"] }); toast.success("Label record updated"); navigate("/compliance-regulatory"); },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.productName.trim()) { toast.error("Product name is required"); return; }
    if (!form.sku.trim()) { toast.error("SKU is required"); return; }
    if (isEdit) editMut.mutate(); else createMut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? "Edit Label Record" : "New Label Record"}
      subtitle="Track approved label versions and link them to COLA registrations"
      breadcrumbs={[{ label: "Regulatory", href: "/compliance-regulatory" }, { label: isEdit ? "Edit Label" : "New Label" }]}
      onSave={save}
      saving={createMut.isPending || editMut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Create Label"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Label requirements</p>
          <p>TTB 27 CFR Part 5 requires approved labels on all distilled spirits. Each label must include class/type, ABV, net contents, name &amp; address, and health warning statement.</p>
        </InfoCard>
      }
    >
      <FormSection title="Label Identity">
        <FormGrid>
          <Field label="Product Name" required>
            <Select value={form.productName} onChange={set("productName")}>
              <option value="">— Select product —</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="SKU" required hint="Stock keeping unit">
            <Input value={form.sku} onChange={set("sku")} placeholder="LIB-RUM-750" />
          </Field>
          <Field label="Version">
            <Input value={form.version} onChange={set("version")} placeholder="1.0" />
          </Field>
          <Field label="Class / Type">
            <Select value={form.classType} onChange={set("classType")}>
              {CLASS_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {LABEL_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </Select>
          </Field>
          <Field label="Linked COLA" hint="Approved COLAs only">
            <Select value={form.colaId} onChange={set("colaId")}>
              <option value="">— None —</option>
              {approvedCola.map(c => (
                <option key={c.id} value={c.id}>
                  {c.productName}{c.colaNumber ? ` (${c.colaNumber})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Label Specifications">
        <FormGrid>
          <Field label="ABV %" hint="Alcohol by volume">
            <Input type="number" step="0.1" min="0" max="100" value={form.alcoholContent} onChange={set("alcoholContent")} placeholder="40.0" />
          </Field>
          <Field label="Net Contents">
            <Input value={form.netContents} onChange={set("netContents")} placeholder="750 ml" />
          </Field>
          <Field label="Approved At">
            <Input type="date" value={form.approvedAt} onChange={set("approvedAt")} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Revision history, design agency, printer specs…"
            className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </Field>
      </FormSection>
    </FormLayout>
  );
}
