import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { FormLayout, FormSection, FormGrid, Field, InfoCard } from "../components/form-layout";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

interface User { id: string; name: string; email: string; role: string; status: string }

export default function UserForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "distiller",
    status: "active",
    password: "",
  });

  const { data: existing } = useQuery<User>({
    queryKey: [`/api/users/${params.id}`],
    queryFn: () => apiRequest(`/api/users/${params.id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        email: existing.email,
        role: existing.role,
        status: existing.status,
        password: "",
      });
    }
  }, [existing]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const createMut = useMutation({
    mutationFn: () =>
      apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          status: form.status,
          password: form.password,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success("User created");
      navigate("/users");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/users/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          status: form.status,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success("User updated");
      navigate("/users");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isPending = createMut.isPending || editMut.isPending;

  function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (!isEdit && form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (isEdit) editMut.mutate(); else createMut.mutate();
  }

  return (
    <FormLayout
      title={isEdit ? "Edit User" : "Add User"}
      subtitle={isEdit ? "Update user details and access level" : "Create a new platform user account"}
      breadcrumbs={[{ label: "Users", href: "/users" }, { label: isEdit ? "Edit User" : "Add User" }]}
      onSave={save}
      saving={isPending}
      saveLabel={isEdit ? "Save Changes" : "Create User"}
      aside={
        <InfoCard>
          <p className="font-medium text-[#0a0a0a]">Access levels</p>
          <ul className="space-y-1 mt-1">
            <li><strong>Admin</strong> — full access including settings and user management</li>
            <li><strong>Distiller</strong> — production, barrels, batches</li>
            <li><strong>Cellar</strong> — barrels and aging operations</li>
            <li><strong>Compliance</strong> — TTB reports and regulatory</li>
            <li><strong>Inventory</strong> — inventory and bottling</li>
            <li><strong>Sales</strong> — orders and labels</li>
          </ul>
        </InfoCard>
      }
    >
      <FormSection title="Account Details">
        <FormGrid>
          <Field label="Full Name" required>
            <Input value={form.name} onChange={set("name")} placeholder="Jane Smith" />
          </Field>
          <Field label="Email Address" required>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@distillery.com" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={set("role")}>
              <option value="admin">Admin</option>
              <option value="distiller">Distiller</option>
              <option value="cellar">Cellar</option>
              <option value="compliance">Compliance</option>
              <option value="inventory">Inventory</option>
              <option value="sales">Sales</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          {!isEdit && (
            <Field label="Password" required hint="Minimum 8 characters">
              <Input type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
            </Field>
          )}
        </FormGrid>
      </FormSection>
    </FormLayout>
  );
}
