import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import type { Client } from "@shared/schema";

// ---------------------------------------------------------------------------
// Read-only detail dialog
// ---------------------------------------------------------------------------
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-[#f0f0f0] last:border-0">
      <span className="text-xs text-[#737373] w-40 shrink-0">{label}</span>
      <span className="text-xs font-medium text-[#0a0a0a] text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#737373] mb-2">{title}</p>
      <div className="rounded-lg border border-[#e5e5e5] px-3 py-1">{children}</div>
    </div>
  );
}

function ClientDetailDialog({ client, onClose, onEdit }: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Dialog open onClose={onClose} title={`${client.name} — Partner Detail`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Section title="Company">
          <DetailRow label="Company Name" value={<span className="font-medium">{client.name}</span>} />
          <DetailRow label="Type" value={client.type} />
          <DetailRow label="Status" value={statusBadge(client.status)} />
          <DetailRow label="Account Tier" value={(client as any).accountTier} />
          <DetailRow label="Industry Segment" value={(client as any).industrySegment} />
          <DetailRow label="Website" value={(client as any).website} />
          <DetailRow label="Billing Address" value={(client as any).billingAddress} />
        </Section>

        <Section title="Primary Contact">
          <DetailRow label="Name" value={client.contact} />
          <DetailRow label="Email" value={client.contactEmail} />
          <DetailRow label="Phone" value={client.contactPhone} />
        </Section>

        {(client as any).notes && (
          <Section title="Notes">
            <p className="text-xs text-[#0a0a0a] py-1.5">{(client as any).notes}</p>
          </Section>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit Partner →</Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------
const STATUSES = ["Active", "Prospective", "Inactive"] as const;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Clients() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewTarget, setViewTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/clients/${deleteTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setDeleteTarget(null);
      toast.success("Trading partner deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <PageHeader
        title="Trading Partners"
        subtitle={`${filtered.length} of ${clients.length} account${clients.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <div className="flex items-center gap-1 bg-white border border-[#e5e5e5] rounded-md p-0.5">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
              >
                All
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === s ? "bg-[var(--brand)] text-white" : "text-[#737373] hover:text-[#0a0a0a]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Input
              placeholder="Search name or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button onClick={() => navigate("/clients/new")}>+ Add Partner</Button>
          </>
        }
      />

      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Contact</Th>
                <Th className="hidden md:table-cell">Email</Th>
                <Th className="hidden md:table-cell">Phone</Th>
                <Th className="hidden md:table-cell">Tier</Th>
                <Th className="hidden md:table-cell">Segment</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={9} className="text-center text-[#737373] py-10">
                    {search || statusFilter !== "all" ? "No partners match your filter" : "No trading partners yet — add one to get started"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((c) => (
                  <Tr
                    key={c.id}
                    className="cursor-pointer hover:bg-[#f7f7f7]"
                    onClick={() => setViewTarget(c)}
                  >
                    <Td className="font-medium text-[#0a0a0a]">{c.name}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{c.type}</Td>
                    <Td>{statusBadge(c.status)}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{c.contact}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{c.contactEmail ?? "—"}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{c.contactPhone ?? "—"}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{(c as any).accountTier ?? "—"}</Td>
                    <Td className="text-[#737373] hidden md:table-cell">{(c as any).industrySegment ?? "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewTarget(c)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="View partner"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => navigate(`/clients/${c.id}/edit`)}
                          className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          title="Edit partner"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                          title="Delete partner"
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

      {viewTarget && (
        <ClientDetailDialog
          client={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setViewTarget(null); navigate(`/clients/${viewTarget.id}/edit`); }}
        />
      )}

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Trading Partner">
          <div className="space-y-4">
            <p className="text-sm text-[#0a0a0a]">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget.name}</span>?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              This permanently deletes the partner and all associated data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete Partner"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Layout>
  );
}
