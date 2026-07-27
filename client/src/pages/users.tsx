import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import { useAuth } from "../hooks/use-auth";
import type { SafeUser } from "@shared/schema";

const emptyForm = {
  name: "",
  email: "",
  role: "distiller" as "admin" | "distiller" | "cellar",
  password: "",
};

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/users", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("User created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (me?.role !== "admin") {
    return (
      <Layout>
        <PageHeader title="Users" subtitle="User management" />
        <div className="p-6 text-sm text-[#737373]">Admin access required to manage users.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Users"
        subtitle={`${users.length} platform user${users.length !== 1 ? "s" : ""}`}
        actions={<Button onClick={() => setOpen(true)}>+ Add User</Button>}
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[#737373] py-10">
                    No users
                  </Td>
                </Tr>
              ) : (
                users.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td className="capitalize">{u.role}</Td>
                    <Td>{statusBadge(u.status)}</Td>
                    <Td>{fmt(u.createdAt)}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onClose={() => { setOpen(false); setForm(emptyForm); }} title="Add User">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Full Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}>
                <option value="distiller">Distiller</option>
                <option value="cellar">Cellar</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Password *</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Create User"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
