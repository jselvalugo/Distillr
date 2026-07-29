import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import type { Staff } from "@shared/schema";

export default function StaffPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: () => apiRequest("/api/staff"),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiRequest(`/api/staff/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      setDeleteTarget(null);
      toast.success("Team member removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} team member${staff.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <Input
              placeholder="Search name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44"
            />
            <Button onClick={() => navigate("/staff/new")}>+ Add Member</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Phone</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[#737373] py-10">
                    {search ? "No staff match your search" : "No staff members yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((s) => (
                  <Tr key={s.id} className="hover:bg-[#f7f7f7]">
                    <Td className="font-medium text-[#0a0a0a]">{s.name}</Td>
                    <Td className="text-[#737373]">{s.role}</Td>
                    <Td>{statusBadge(s.status)}</Td>
                    <Td className="text-[#737373]">{s.phone ?? "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/staff/${s.id}/edit`)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="Edit member"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Remove Team Member">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to remove <strong>{deleteTarget.name}</strong> from the team?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the staff record. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? "Removing…" : "Remove Member"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Layout>
  );
}
