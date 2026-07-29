import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { Staff } from "@shared/schema";

export default function StaffForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    role: "Distiller",
    phone: "",
    status: "Active",
  });

  const { data: existing, isLoading } = useQuery<Staff>({
    queryKey: ["/api/staff", params.id],
    queryFn: () => apiRequest(`/api/staff/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? "",
        role: existing.role ?? "Distiller",
        phone: existing.phone ?? "",
        status: existing.status ?? "Active",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      isEdit
        ? apiRequest(`/api/staff/${params.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: form.name.trim(),
              role: form.role,
              phone: form.phone.trim(),
              status: form.status,
            }),
          })
        : apiRequest("/api/staff", {
            method: "POST",
            body: JSON.stringify({
              name: form.name.trim(),
              role: form.role,
              phone: form.phone.trim(),
              status: form.status,
            }),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      toast.success(isEdit ? "Team member updated" : "Team member added");
      navigate("/staff");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.role.trim()) { toast.error("Role is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    mut.mutate();
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[#737373]">
        Loading…
      </div>
    );
  }

  return (
    <FormLayout
      title={isEdit ? `Edit — ${existing?.name ?? ""}` : "Add Team Member"}
      subtitle={isEdit ? "Update staff member details" : "Add a new staff member to your distillery team"}
      breadcrumbs={[{ label: "Staff", href: "/staff" }, { label: isEdit ? "Edit Member" : "Add Team Member" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel={isEdit ? "Save Changes" : "Add Team Member"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Staff vs. Users</p>
          <p>Staff records track your production team for scheduling and compliance. To grant login access to the platform, create a User account separately under the Users module.</p>
        </InfoCard>
      }
    >
      <FormSection title="Team Member Details">
        <FormGrid>
          <Field label="Full Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="Jane Smith" />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={set("role")}>
              <option>Distiller</option>
              <option>Head Distiller</option>
              <option>Assistant Distiller</option>
              <option>Cellar Worker</option>
              <option>Bottling Line</option>
              <option>Quality Control</option>
              <option>Sales</option>
              <option>Operations</option>
              <option>Management</option>
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Phone" required>
            <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option>Active</option>
              <option>On Leave</option>
              <option>Inactive</option>
            </Select>
          </Field>
        </FormGrid>
      </FormSection>
    </FormLayout>
  );
}
