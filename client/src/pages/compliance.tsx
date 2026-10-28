import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import { daysUntil, displaySeverity, severityTone } from "../lib/compliance";
import type { Compliance } from "@shared/schema";

function ExpiryCell({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-[#a3a3a3]">—</span>;
  const tone = days < 0 ? "text-red-600" : days <= 30 ? "text-amber-700" : "text-[#0a0a0a]";
  return (
    <span className={tone}>
      {fmt(date)}
      {days < 0 && <span className="ml-1.5 text-[10px] font-semibold">overdue</span>}
      {days >= 0 && days <= 30 && <span className="ml-1.5 text-[10px] font-semibold">{days === 0 ? "today" : `${days}d`}</span>}
    </span>
  );
}

export default function CompliancePage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: records = [] } = useQuery<Compliance[]>({
    queryKey: ["/api/compliance"],
    queryFn: () => apiRequest("/api/compliance"),
  });

  const q = search.trim().toLowerCase();
  const filtered = records.filter((r) =>
    !q || [r.type, r.jurisdiction, r.owner, r.controlReference, r.status].some((v) => (v ?? "").toLowerCase().includes(q)),
  );

  function open(e: React.MouseEvent, id: string) {
    const href = `/compliance/${id}`;
    // Cmd/Ctrl-click or middle-click opens the record in a new tab.
    if (e.metaKey || e.ctrlKey || e.button === 1) window.open(href, "_blank", "noopener");
    else navigate(href);
  }

  return (
    <Layout>
      <PageHeader
        title="Compliance"
        subtitle={`${records.length} compliance record${records.length === 1 ? "" : "s"} · open a record to work on it`}
        actions={
          <>
            <Input
              placeholder="Search type, owner, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Button onClick={() => navigate("/compliance/new")}>+ Add Record</Button>
          </>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Severity</Th>
                <Th>Jurisdiction</Th>
                <Th>Expires</Th>
                <Th>Owner</Th>
                <Th>Last Reviewed</Th>
                <Th className="w-8" />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center text-[#737373] py-10">
                    {search ? "No records match your search" : "No compliance records yet"}
                  </Td>
                </Tr>
              ) : (
                filtered.map((r) => {
                  const sev = severityTone(r.severity);
                  return (
                    <Tr
                      key={r.id}
                      role="link"
                      tabIndex={0}
                      onClick={(e) => open(e, r.id)}
                      onAuxClick={(e) => open(e, r.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/compliance/${r.id}`); }}
                      className="group cursor-pointer focus:outline-none focus-visible:bg-[#f7f7f7]"
                    >
                      <Td className="font-medium">
                        {r.type}
                        {r.controlReference && <span className="ml-2 font-mono text-[11px] font-normal text-[#a3a3a3]">{r.controlReference}</span>}
                      </Td>
                      <Td>{statusBadge(r.status)}</Td>
                      <Td>
                        {r.severity ? (
                          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: sev.fg }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.dot }} />
                            {displaySeverity(r.severity)}
                          </span>
                        ) : "—"}
                      </Td>
                      <Td>{r.jurisdiction ?? "—"}</Td>
                      <Td><ExpiryCell date={r.expires} /></Td>
                      <Td>{r.owner ?? "—"}</Td>
                      <Td>{fmt(r.lastReviewedOn)}</Td>
                      <Td className="text-right">
                        <ChevronRight size={15} className="text-[#d4d4d4] transition-colors group-hover:text-[var(--brand)]" />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
