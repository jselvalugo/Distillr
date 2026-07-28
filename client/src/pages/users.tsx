import { useState } from "react";
import { useLocation } from "wouter";
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
  status: "active" as "active" | "inactive",
};

export default function Users() {
  const [, navigate] = useLocation();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);
  const [resetUser, setResetUser] = useState<SafeUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "distiller" as "admin" | "distiller" | "cellar", status: "active" as "active" | "inactive" });
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users"),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) =>
      apiRequest("/api/users", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      setForm(emptyForm);
      toast.success("User created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      apiRequest(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      toast.success("User updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUser(null);
      toast.success("User deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiRequest(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      setResetUser(null);
      setNewPassword("");
      toast.success("Password reset successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(u: SafeUser) {
    navigate(`/users/${u.id}/edit`);
  }

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
        actions={<Button onClick={() => navigate("/users/new")}>+ Add User</Button>}
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
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[#737373] py-10">No users</Td>
                </Tr>
              ) : (
                users.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td className="capitalize">{u.role}</Td>
                    <Td>{statusBadge(u.status)}</Td>
                    <Td>{fmt(u.createdAt)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setResetUser(u); setNewPassword(""); }}
                          className="text-xs text-amber-600 hover:underline font-medium"
                        >
                          Reset Password
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="text-xs text-red-600 hover:underline font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      {/* Add User */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setForm(emptyForm); }} title="Add User">
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
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="col-span-2">
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
            <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setForm(emptyForm); }}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Saving…" : "Create User"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit User */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} title={`Edit — ${editUser?.name}`}>
        <form onSubmit={(e) => { e.preventDefault(); editMut.mutate({ id: editUser!.id, data: editForm }); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Full Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <Select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as any }))}>
                <option value="distiller">Distiller</option>
                <option value="cellar">Cellar</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <Select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as any }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button type="submit" disabled={editMut.isPending}>{editMut.isPending ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Reset Password */}
      <Dialog open={!!resetUser} onClose={() => { setResetUser(null); setNewPassword(""); }} title={`Reset Password — ${resetUser?.name}`}>
        <form onSubmit={(e) => { e.preventDefault(); resetMut.mutate({ id: resetUser!.id, password: newPassword }); }} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">New Password *</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setResetUser(null); setNewPassword(""); }}>Cancel</Button>
            <Button type="submit" disabled={resetMut.isPending}>{resetMut.isPending ? "Resetting…" : "Reset Password"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-sm text-[#404040]">
            Are you sure you want to delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate(deleteUser!.id)}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete User"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
