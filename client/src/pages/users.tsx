import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, KeyRound } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import { useAuth } from "../hooks/use-auth";
import type { SafeUser } from "@shared/schema";

export default function Users() {
  const [, navigate] = useLocation();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [deleteUser, setDeleteUser] = useState<SafeUser | null>(null);
  const [resetUser, setResetUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("/api/users"),
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
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/users/${u.id}/edit`)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="Edit user"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { setResetUser(u); setNewPassword(""); }}
                          className="p-1.5 rounded hover:bg-amber-50 text-[#737373] hover:text-amber-600 transition-colors"
                          title="Reset password"
                        >
                          <KeyRound size={13} />
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={13} />
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
