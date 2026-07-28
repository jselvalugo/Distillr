import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export default function StaffForm() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    role: "Distiller",
    phone: "",
    status: "Active",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("/api/staff", {
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
      toast.success("Team member added");
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

  return (
    <FormLayout
      title="Add Team Member"
      subtitle="Add a new staff member to your distillery team"
      breadcrumbs={[{ label: "Staff", href: "/staff" }, { label: "Add Team Member" }]}
      onSave={save}
      saving={mut.isPending}
      saveLabel="Add Team Member"
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
