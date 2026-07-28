import { useState, useMemo } from "react";
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
import { Badge, statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import { useAuth } from "../hooks/use-auth";

type Tab = "permits" | "excise" | "cola" | "labels";

interface Permit {
  id: string;
  permitType: string;
  permitNumber: string;
  issuingAuthority: string;
  state: string | null;
  issueDate: string;
  expirationDate: string;
  reminderDaysBefore: number;
  status: string;
  notes: string | null;
}

interface ColaRegistration {
  id: string;
  productName: string;
  brandName: string;
  classType: string;
  formulaNumber: string | null;
  colaNumber: string | null;
  status: string;
  appliedAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
}

interface LabelRecord {
  id: string;
  productName: string;
  sku: string;
  version: string;
  colaId: string | null;
  netContents: string | null;
  alcoholContent: number | null;
  classType: string;
  status: string;
  approvedAt: string | null;
  notes: string | null;
}

interface StateExciseReturn {
  id: string;
  state: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  totalProofGallons: number;
  ratePerProofGallon: number;
  totalTax: number;
  filedAt: string | null;
  notes: string | null;
}

const STATE_RATES: Record<string, { name: string; rate: number }> = {
  CA: { name: "California", rate: 3.30 },
  NY: { name: "New York", rate: 6.44 },
  TX: { name: "Texas", rate: 2.40 },
  FL: { name: "Florida", rate: 9.53 },
  WA: { name: "Washington", rate: 14.27 },
  IL: { name: "Illinois", rate: 8.55 },
  PA: { name: "Pennsylvania", rate: 7.24 },
  OH: { name: "Ohio", rate: 9.34 },
  GA: { name: "Georgia", rate: 3.79 },
  NC: { name: "North Carolina", rate: 12.06 },
  MI: { name: "Michigan", rate: 11.98 },
  NJ: { name: "New Jersey", rate: 5.50 },
  VA: { name: "Virginia", rate: 19.88 },
  CO: { name: "Colorado", rate: 2.28 },
  AZ: { name: "Arizona", rate: 3.00 },
  MA: { name: "Massachusetts", rate: 4.05 },
  TN: { name: "Tennessee", rate: 4.40 },
  OR: { name: "Oregon", rate: 22.73 },
  MN: { name: "Minnesota", rate: 5.03 },
  WI: { name: "Wisconsin", rate: 3.25 },
  MO: { name: "Missouri", rate: 2.00 },
  AL: { name: "Alabama", rate: 9.16 },
  SC: { name: "South Carolina", rate: 5.42 },
  KY: { name: "Kentucky", rate: 1.92 },
  IN: { name: "Indiana", rate: 2.68 },
  CT: { name: "Connecticut", rate: 5.40 },
  MD: { name: "Maryland", rate: 1.50 },
  NV: { name: "Nevada", rate: 3.60 },
  NM: { name: "New Mexico", rate: 6.06 },
};

const PERMIT_TYPES = [
  "DSP Federal",
  "Basic Federal",
  "State Permit",
  "Surety Bond",
  "Other",
];

const CLASS_TYPES = [
  "Whiskey",
  "Bourbon",
  "Rum",
  "Vodka",
  "Gin",
  "Brandy",
  "Tequila",
  "Other",
];

const COLA_STATUSES = ["pending", "approved", "rejected", "expired", "revoked"];
const LABEL_STATUSES = ["draft", "approved", "in_use", "retired"];
const EXCISE_STATUSES = ["draft", "filed", "amended"];

function daysUntilExpiry(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function colaStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "approved") return <Badge variant="success">{formatStatus(status)}</Badge>;
  if (s === "pending") return <Badge variant="warning">{formatStatus(status)}</Badge>;
  if (s === "rejected" || s === "revoked") return <Badge variant="danger">{formatStatus(status)}</Badge>;
  if (s === "expired") return <Badge variant="muted">{formatStatus(status)}</Badge>;
  return <Badge>{formatStatus(status)}</Badge>;
}

function permitStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "active") return <Badge variant="success">Active</Badge>;
  if (s === "expiring_soon") return <Badge variant="warning">Expiring Soon</Badge>;
  if (s === "expired") return <Badge variant="danger">Expired</Badge>;
  if (s === "revoked") return <Badge variant="danger">Revoked</Badge>;
  return <Badge>{formatStatus(status)}</Badge>;
}

const emptyPermit = {
  permitType: "DSP Federal",
  permitNumber: "",
  issuingAuthority: "",
  state: "",
  issueDate: new Date().toISOString().slice(0, 10),
  expirationDate: "",
  reminderDaysBefore: "90",
  notes: "",
};

const emptyCola = {
  productName: "",
  brandName: "",
  classType: "Whiskey",
  formulaNumber: "",
  colaNumber: "",
  status: "pending",
  appliedAt: "",
  approvedAt: "",
  expiresAt: "",
  notes: "",
};

const emptyLabel = {
  productName: "",
  sku: "",
  version: "1.0",
  colaId: "",
  netContents: "",
  alcoholContent: "",
  classType: "Whiskey",
  status: "draft",
  approvedAt: "",
  notes: "",
};

const emptyExcise = {
  state: "FL",
  periodStart: "",
  periodEnd: "",
  dueDate: "",
  status: "draft",
  totalProofGallons: "",
  ratePerProofGallon: String(STATE_RATES["CA"].rate),
  notes: "",
};

export default function ComplianceRegulatory() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("permits");

  // Permits state
  const [permitOpen, setPermitOpen] = useState(false);
  const [editPermit, setEditPermit] = useState<Permit | null>(null);
  const [permitForm, setPermitForm] = useState(emptyPermit);

  // COLA state
  const [colaOpen, setColaOpen] = useState(false);
  const [editCola, setEditCola] = useState<ColaRegistration | null>(null);
  const [colaForm, setColaForm] = useState(emptyCola);

  // Label state
  const [labelOpen, setLabelOpen] = useState(false);
  const [editLabel, setEditLabel] = useState<LabelRecord | null>(null);
  const [labelForm, setLabelForm] = useState(emptyLabel);

  // Excise state
  const [exciseOpen, setExciseOpen] = useState(false);
  const [editExcise, setEditExcise] = useState<StateExciseReturn | null>(null);
  const [exciseForm, setExciseForm] = useState(emptyExcise);

  const { data: permits = [] } = useQuery<Permit[]>({
    queryKey: ["/api/permits"],
    queryFn: () => apiRequest("/api/permits"),
  });

  const { data: colaList = [] } = useQuery<ColaRegistration[]>({
    queryKey: ["/api/cola"],
    queryFn: () => apiRequest("/api/cola"),
  });

  const { data: labels = [] } = useQuery<LabelRecord[]>({
    queryKey: ["/api/labels"],
    queryFn: () => apiRequest("/api/labels"),
  });

  const { data: exciseReturns = [] } = useQuery<StateExciseReturn[]>({
    queryKey: ["/api/state-excise"],
    queryFn: () => apiRequest("/api/state-excise"),
  });

  const permitSummary = useMemo(() => {
    const active = permits.filter((p) => p.status === "active").length;
    const expiring = permits.filter((p) => p.status === "expiring_soon").length;
    const expired = permits.filter((p) => p.status === "expired").length;
    return { active, expiring, expired };
  }, [permits]);

  const approvedCola = useMemo(
    () => colaList.filter((c) => c.status === "approved"),
    [colaList],
  );

  // Permit mutations
  const createPermitMut = useMutation({
    mutationFn: (d: typeof permitForm) =>
      apiRequest("/api/permits", {
        method: "POST",
        body: JSON.stringify({ ...d, reminderDaysBefore: Number(d.reminderDaysBefore) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/permits"] });
      setPermitOpen(false);
      setPermitForm(emptyPermit);
      toast.success("Permit added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePermitMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof permitForm }) =>
      apiRequest(`/api/permits/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, reminderDaysBefore: Number(data.reminderDaysBefore) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/permits"] });
      setPermitOpen(false);
      setEditPermit(null);
      setPermitForm(emptyPermit);
      toast.success("Permit updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePermitMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/permits/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/permits"] });
      toast.success("Permit deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // COLA mutations
  const createColaMut = useMutation({
    mutationFn: (d: typeof colaForm) =>
      apiRequest("/api/cola", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cola"] });
      setColaOpen(false);
      setColaForm(emptyCola);
      toast.success("COLA registration created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateColaMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof colaForm }) =>
      apiRequest(`/api/cola/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cola"] });
      setColaOpen(false);
      setEditCola(null);
      setColaForm(emptyCola);
      toast.success("COLA registration updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteColaMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/cola/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cola"] });
      toast.success("COLA registration deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Label mutations
  const createLabelMut = useMutation({
    mutationFn: (d: typeof labelForm) =>
      apiRequest("/api/labels", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/labels"] });
      setLabelOpen(false);
      setLabelForm(emptyLabel);
      toast.success("Label record created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLabelMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof labelForm }) =>
      apiRequest(`/api/labels/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/labels"] });
      setLabelOpen(false);
      setEditLabel(null);
      setLabelForm(emptyLabel);
      toast.success("Label record updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLabelMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/labels/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/labels"] });
      toast.success("Label record deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Excise mutations
  const createExciseMut = useMutation({
    mutationFn: (d: typeof exciseForm) =>
      apiRequest("/api/state-excise", {
        method: "POST",
        body: JSON.stringify({
          ...d,
          totalProofGallons: Number(d.totalProofGallons),
          ratePerProofGallon: Number(d.ratePerProofGallon),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/state-excise"] });
      setExciseOpen(false);
      setExciseForm(emptyExcise);
      toast.success("Excise return created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateExciseMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof exciseForm }) =>
      apiRequest(`/api/state-excise/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          totalProofGallons: Number(data.totalProofGallons),
          ratePerProofGallon: Number(data.ratePerProofGallon),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/state-excise"] });
      setExciseOpen(false);
      setEditExcise(null);
      setExciseForm(emptyExcise);
      toast.success("Excise return updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteExciseMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/state-excise/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/state-excise"] });
      toast.success("Excise return deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAddPermit() {
    setEditPermit(null);
    setPermitForm(emptyPermit);
    setPermitOpen(true);
  }

  function openEditPermit(p: Permit) {
    setEditPermit(p);
    setPermitForm({
      permitType: p.permitType,
      permitNumber: p.permitNumber,
      issuingAuthority: p.issuingAuthority,
      state: p.state ?? "",
      issueDate: p.issueDate,
      expirationDate: p.expirationDate,
      reminderDaysBefore: String(p.reminderDaysBefore),
      notes: p.notes ?? "",
    });
    setPermitOpen(true);
  }

  function openAddCola() {
    setEditCola(null);
    setColaForm(emptyCola);
    setColaOpen(true);
  }

  function openEditCola(c: ColaRegistration) {
    setEditCola(c);
    setColaForm({
      productName: c.productName,
      brandName: c.brandName,
      classType: c.classType,
      formulaNumber: c.formulaNumber ?? "",
      colaNumber: c.colaNumber ?? "",
      status: c.status,
      appliedAt: c.appliedAt ?? "",
      approvedAt: c.approvedAt ?? "",
      expiresAt: c.expiresAt ?? "",
      notes: c.notes ?? "",
    });
    setColaOpen(true);
  }

  function openAddLabel() {
    setEditLabel(null);
    setLabelForm(emptyLabel);
    setLabelOpen(true);
  }

  function openEditLabel(l: LabelRecord) {
    setEditLabel(l);
    setLabelForm({
      productName: l.productName,
      sku: l.sku,
      version: l.version,
      colaId: l.colaId ?? "",
      netContents: l.netContents ?? "",
      alcoholContent: l.alcoholContent != null ? String(l.alcoholContent) : "",
      classType: l.classType,
      status: l.status,
      approvedAt: l.approvedAt ?? "",
      notes: l.notes ?? "",
    });
    setLabelOpen(true);
  }

  function openAddExcise() {
    setEditExcise(null);
    setExciseForm(emptyExcise);
    setExciseOpen(true);
  }

  function openEditExcise(r: StateExciseReturn) {
    setEditExcise(r);
    setExciseForm({
      state: r.state,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      dueDate: r.dueDate,
      status: r.status,
      totalProofGallons: String(r.totalProofGallons),
      ratePerProofGallon: String(r.ratePerProofGallon),
      notes: r.notes ?? "",
    });
    setExciseOpen(true);
  }

  const liveExciseTax =
    Number(exciseForm.totalProofGallons || 0) * Number(exciseForm.ratePerProofGallon || 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "permits", label: "Permits & Bonds" },
    { key: "excise", label: "State Excise" },
    { key: "cola", label: "COLA" },
    { key: "labels", label: "Labels" },
  ];

  return (
    <Layout>
      <PageHeader
        title="Compliance & Regulatory"
        subtitle="Permits, COLA registrations, label records, and state excise returns"
        actions={
          tab === "permits" ? (
            <Button onClick={() => navigate("/permits/new")}>+ Add Permit</Button>
          ) : tab === "cola" ? (
            <Button onClick={() => navigate("/cola/new")}>+ New COLA</Button>
          ) : tab === "labels" ? (
            <Button onClick={() => navigate("/labels/new")}>+ New Label</Button>
          ) : (
            <Button onClick={() => navigate("/excise/new")}>+ New Return</Button>
          )
        }
      />

      <div className="p-6">
        <div className="flex gap-1 mb-5 border-b border-[#e5e5e5]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-[#0a0a0a] text-[#0a0a0a]"
                  : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Permits & Bonds Tab */}
        {tab === "permits" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-4">
                <p className="text-xs text-[#737373] mb-1">Active Permits</p>
                <p className="text-2xl font-semibold text-[#0a0a0a]">{permitSummary.active}</p>
              </div>
              <div className="bg-white border border-[#fde68a] rounded-lg p-4">
                <p className="text-xs text-[#92400e] mb-1">Expiring Within 90 Days</p>
                <p className="text-2xl font-semibold text-[#92400e]">{permitSummary.expiring}</p>
              </div>
              <div className="bg-white border border-[#fecaca] rounded-lg p-4">
                <p className="text-xs text-[#991b1b] mb-1">Expired</p>
                <p className="text-2xl font-semibold text-[#991b1b]">{permitSummary.expired}</p>
              </div>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Permit #</Th>
                    <Th>Authority</Th>
                    <Th>State</Th>
                    <Th>Issue Date</Th>
                    <Th>Expiration</Th>
                    <Th>Days Left</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {permits.length === 0 ? (
                    <Tr>
                      <Td colSpan={9} className="text-center text-[#737373] py-10">
                        No permits on file
                      </Td>
                    </Tr>
                  ) : (
                    permits.map((p) => {
                      const days = daysUntilExpiry(p.expirationDate);
                      return (
                        <Tr key={p.id}>
                          <Td className="font-medium">{p.permitType}</Td>
                          <Td className="font-mono text-xs">{p.permitNumber}</Td>
                          <Td>{p.issuingAuthority}</Td>
                          <Td>{p.state ?? "—"}</Td>
                          <Td>{fmt(p.issueDate)}</Td>
                          <Td>{fmt(p.expirationDate)}</Td>
                          <Td>
                            {days < 0 ? (
                              <span className="text-[#991b1b] font-medium">Expired</span>
                            ) : (
                              <span
                                className={
                                  days <= p.reminderDaysBefore
                                    ? "text-[#92400e] font-medium"
                                    : "text-[#0a0a0a]"
                                }
                              >
                                {days}d
                              </span>
                            )}
                          </Td>
                          <Td>{permitStatusBadge(p.status)}</Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigate(`/permits/${p.id}/edit`)}
                                className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    if (confirm("Delete this permit?")) deletePermitMut.mutate(p.id);
                                  }}
                                  className="text-xs text-red-600 hover:text-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </Tbody>
              </Table>
            </div>
          </div>
        )}

        {/* State Excise Tab */}
        {tab === "excise" && (
          <div className="space-y-4">
            {/* Florida compliance info banner */}
            <div className="border border-[#e5e5e5] rounded-lg bg-white p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#0a0a0a]">Florida Excise Tax — Distilled Spirits</h3>
                  <p className="text-xs text-[#737373] mt-1">
                    Rate: <span className="font-semibold text-[#0a0a0a]">$9.53 per proof gallon</span> &nbsp;·&nbsp;
                    Filing: <span className="font-semibold text-[#0a0a0a]">Monthly</span> &nbsp;·&nbsp;
                    Due: <span className="font-semibold text-[#0a0a0a]">15th of the following month</span> &nbsp;·&nbsp;
                    Authority: <span className="font-semibold text-[#0a0a0a]">FL Dept. of Business &amp; Professional Regulation (DBPR)</span>
                  </p>
                  <p className="text-[10px] text-[#a3a3a3] mt-1">
                    Florida Statutes § 565.12 — Excise tax on distilled spirits sold to licensed vendors. Craft distillers producing under 75,000 gallons/year may qualify for a 7% excise tax credit under § 565.108.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th>State</Th>
                  <Th>Period Start</Th>
                  <Th>Period End</Th>
                  <Th>Due Date</Th>
                  <Th>Proof Gallons</Th>
                  <Th>Rate / PG</Th>
                  <Th>Total Tax</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {exciseReturns.length === 0 ? (
                  <Tr>
                    <Td colSpan={9} className="text-center text-[#737373] py-10">
                      No excise returns on file
                    </Td>
                  </Tr>
                ) : (
                  exciseReturns.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium">{r.state}</Td>
                      <Td>{fmt(r.periodStart)}</Td>
                      <Td>{fmt(r.periodEnd)}</Td>
                      <Td>{fmt(r.dueDate)}</Td>
                      <Td>{r.totalProofGallons.toFixed(2)}</Td>
                      <Td>${r.ratePerProofGallon.toFixed(2)}</Td>
                      <Td className="font-medium">${r.totalTax.toFixed(2)}</Td>
                      <Td>{statusBadge(r.status)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/excise/${r.id}/edit`)}
                            className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (confirm("Delete this excise return?")) deleteExciseMut.mutate(r.id);
                              }}
                              className="text-xs text-red-600 hover:text-red-700 transition-colors"
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
        )}

        {/* COLA Tab */}
        {tab === "cola" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Brand</Th>
                  <Th>Class</Th>
                  <Th>COLA #</Th>
                  <Th>Applied</Th>
                  <Th>Approved</Th>
                  <Th>Expires</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {colaList.length === 0 ? (
                  <Tr>
                    <Td colSpan={9} className="text-center text-[#737373] py-10">
                      No COLA registrations on file
                    </Td>
                  </Tr>
                ) : (
                  colaList.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium">{c.productName}</Td>
                      <Td>{c.brandName}</Td>
                      <Td>{c.classType}</Td>
                      <Td className="font-mono text-xs">{c.colaNumber ?? "—"}</Td>
                      <Td>{c.appliedAt ? fmt(c.appliedAt) : "—"}</Td>
                      <Td>{c.approvedAt ? fmt(c.approvedAt) : "—"}</Td>
                      <Td>{c.expiresAt ? fmt(c.expiresAt) : "—"}</Td>
                      <Td>{colaStatusBadge(c.status)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/cola/${c.id}/edit`)}
                            className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (confirm("Delete this COLA registration?")) deleteColaMut.mutate(c.id);
                              }}
                              className="text-xs text-red-600 hover:text-red-700 transition-colors"
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
        )}

        {/* Labels Tab */}
        {tab === "labels" && (
          <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Version</Th>
                  <Th>ABV%</Th>
                  <Th>Net Contents</Th>
                  <Th>COLA Link</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {labels.length === 0 ? (
                  <Tr>
                    <Td colSpan={8} className="text-center text-[#737373] py-10">
                      No label records on file
                    </Td>
                  </Tr>
                ) : (
                  labels.map((l) => {
                    const linkedCola = l.colaId
                      ? colaList.find((c) => c.id === l.colaId)
                      : null;
                    return (
                      <Tr key={l.id}>
                        <Td className="font-medium">{l.productName}</Td>
                        <Td className="font-mono text-xs">{l.sku}</Td>
                        <Td>{l.version}</Td>
                        <Td>{l.alcoholContent != null ? `${l.alcoholContent}%` : "—"}</Td>
                        <Td>{l.netContents ?? "—"}</Td>
                        <Td className="font-mono text-xs">
                          {linkedCola ? linkedCola.colaNumber ?? linkedCola.productName : "—"}
                        </Td>
                        <Td>{statusBadge(l.status.replace(/_/g, " "))}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/labels/${l.id}/edit`)}
                              className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm("Delete this label record?")) deleteLabelMut.mutate(l.id);
                                }}
                                className="text-xs text-red-600 hover:text-red-700 transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Permit Dialog */}
      <Dialog
        open={permitOpen}
        onClose={() => { setPermitOpen(false); setEditPermit(null); setPermitForm(emptyPermit); }}
        title={editPermit ? "Edit Permit" : "Add Permit"}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Permit Type</label>
            <Select
              value={permitForm.permitType}
              onChange={(e) => setPermitForm({ ...permitForm, permitType: e.target.value })}
            >
              {PERMIT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Permit Number</label>
            <Input
              value={permitForm.permitNumber}
              onChange={(e) => setPermitForm({ ...permitForm, permitNumber: e.target.value })}
              placeholder="e.g. DSP-TX-20001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Issuing Authority</label>
            <Input
              value={permitForm.issuingAuthority}
              onChange={(e) => setPermitForm({ ...permitForm, issuingAuthority: e.target.value })}
              placeholder="e.g. TTB, State ABC Board"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">State (optional)</label>
            <Input
              value={permitForm.state}
              onChange={(e) => setPermitForm({ ...permitForm, state: e.target.value })}
              placeholder="e.g. TX"
              maxLength={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Issue Date</label>
              <Input
                type="date"
                value={permitForm.issueDate}
                onChange={(e) => setPermitForm({ ...permitForm, issueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Expiration Date</label>
              <Input
                type="date"
                value={permitForm.expirationDate}
                onChange={(e) => setPermitForm({ ...permitForm, expirationDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Reminder Days Before Expiry</label>
            <Input
              type="number"
              value={permitForm.reminderDaysBefore}
              onChange={(e) => setPermitForm({ ...permitForm, reminderDaysBefore: e.target.value })}
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Notes</label>
            <textarea
              value={permitForm.notes}
              onChange={(e) => setPermitForm({ ...permitForm, notes: e.target.value })}
              className="flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              rows={3}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setPermitOpen(false); setEditPermit(null); setPermitForm(emptyPermit); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editPermit) {
                  updatePermitMut.mutate({ id: editPermit.id, data: permitForm });
                } else {
                  createPermitMut.mutate(permitForm);
                }
              }}
              disabled={createPermitMut.isPending || updatePermitMut.isPending}
            >
              {editPermit ? "Save Changes" : "Add Permit"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* COLA Dialog */}
      <Dialog
        open={colaOpen}
        onClose={() => { setColaOpen(false); setEditCola(null); setColaForm(emptyCola); }}
        title={editCola ? "Edit COLA Registration" : "New COLA Registration"}
        size="md"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Product Name</label>
              <Input
                value={colaForm.productName}
                onChange={(e) => setColaForm({ ...colaForm, productName: e.target.value })}
                placeholder="e.g. Libertalia Rum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Brand Name</label>
              <Input
                value={colaForm.brandName}
                onChange={(e) => setColaForm({ ...colaForm, brandName: e.target.value })}
                placeholder="e.g. Libertalia"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Class / Type</label>
              <Select
                value={colaForm.classType}
                onChange={(e) => setColaForm({ ...colaForm, classType: e.target.value })}
              >
                {CLASS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Status</label>
              <Select
                value={colaForm.status}
                onChange={(e) => setColaForm({ ...colaForm, status: e.target.value })}
              >
                {COLA_STATUSES.map((s) => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Formula Number</label>
              <Input
                value={colaForm.formulaNumber}
                onChange={(e) => setColaForm({ ...colaForm, formulaNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">COLA Number</label>
              <Input
                value={colaForm.colaNumber}
                onChange={(e) => setColaForm({ ...colaForm, colaNumber: e.target.value })}
                placeholder="Assigned by TTB"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Applied</label>
              <Input
                type="date"
                value={colaForm.appliedAt}
                onChange={(e) => setColaForm({ ...colaForm, appliedAt: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Approved</label>
              <Input
                type="date"
                value={colaForm.approvedAt}
                onChange={(e) => setColaForm({ ...colaForm, approvedAt: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Expires</label>
              <Input
                type="date"
                value={colaForm.expiresAt}
                onChange={(e) => setColaForm({ ...colaForm, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Notes</label>
            <textarea
              value={colaForm.notes}
              onChange={(e) => setColaForm({ ...colaForm, notes: e.target.value })}
              className="flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setColaOpen(false); setEditCola(null); setColaForm(emptyCola); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editCola) {
                  updateColaMut.mutate({ id: editCola.id, data: colaForm });
                } else {
                  createColaMut.mutate(colaForm);
                }
              }}
              disabled={createColaMut.isPending || updateColaMut.isPending}
            >
              {editCola ? "Save Changes" : "Create COLA"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Label Dialog */}
      <Dialog
        open={labelOpen}
        onClose={() => { setLabelOpen(false); setEditLabel(null); setLabelForm(emptyLabel); }}
        title={editLabel ? "Edit Label Record" : "New Label Record"}
        size="md"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Product Name</label>
              <Input
                value={labelForm.productName}
                onChange={(e) => setLabelForm({ ...labelForm, productName: e.target.value })}
                placeholder="e.g. Libertalia Rum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">SKU</label>
              <Input
                value={labelForm.sku}
                onChange={(e) => setLabelForm({ ...labelForm, sku: e.target.value })}
                placeholder="e.g. LIB-RUM-750"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Version</label>
              <Input
                value={labelForm.version}
                onChange={(e) => setLabelForm({ ...labelForm, version: e.target.value })}
                placeholder="e.g. 1.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Class / Type</label>
              <Select
                value={labelForm.classType}
                onChange={(e) => setLabelForm({ ...labelForm, classType: e.target.value })}
              >
                {CLASS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">ABV%</label>
              <Input
                type="number"
                step="0.1"
                value={labelForm.alcoholContent}
                onChange={(e) => setLabelForm({ ...labelForm, alcoholContent: e.target.value })}
                placeholder="e.g. 40.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Net Contents</label>
              <Input
                value={labelForm.netContents}
                onChange={(e) => setLabelForm({ ...labelForm, netContents: e.target.value })}
                placeholder="e.g. 750 ml"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">
                Linked COLA (approved only)
              </label>
              <Select
                value={labelForm.colaId}
                onChange={(e) => setLabelForm({ ...labelForm, colaId: e.target.value })}
              >
                <option value="">None</option>
                {approvedCola.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.productName} {c.colaNumber ? `(${c.colaNumber})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Status</label>
              <Select
                value={labelForm.status}
                onChange={(e) => setLabelForm({ ...labelForm, status: e.target.value })}
              >
                {LABEL_STATUSES.map((s) => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Approved At</label>
            <Input
              type="date"
              value={labelForm.approvedAt}
              onChange={(e) => setLabelForm({ ...labelForm, approvedAt: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Notes</label>
            <textarea
              value={labelForm.notes}
              onChange={(e) => setLabelForm({ ...labelForm, notes: e.target.value })}
              className="flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setLabelOpen(false); setEditLabel(null); setLabelForm(emptyLabel); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editLabel) {
                  updateLabelMut.mutate({ id: editLabel.id, data: labelForm });
                } else {
                  createLabelMut.mutate(labelForm);
                }
              }}
              disabled={createLabelMut.isPending || updateLabelMut.isPending}
            >
              {editLabel ? "Save Changes" : "Create Label"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Excise Return Dialog */}
      <Dialog
        open={exciseOpen}
        onClose={() => { setExciseOpen(false); setEditExcise(null); setExciseForm(emptyExcise); }}
        title={editExcise ? "Edit Excise Return" : "New Excise Return"}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">State</label>
            <Select
              value={exciseForm.state}
              onChange={(e) => {
                const st = e.target.value;
                const rate = STATE_RATES[st]?.rate ?? 0;
                setExciseForm({ ...exciseForm, state: st, ratePerProofGallon: String(rate) });
              }}
            >
              {Object.entries(STATE_RATES).map(([code, { name }]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Period Start</label>
              <Input
                type="date"
                value={exciseForm.periodStart}
                onChange={(e) => setExciseForm({ ...exciseForm, periodStart: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Period End</label>
              <Input
                type="date"
                value={exciseForm.periodEnd}
                onChange={(e) => {
                  const end = e.target.value;
                  let dueDate = exciseForm.dueDate;
                  if (end && exciseForm.state === "FL") {
                    const d = new Date(end + "T00:00:00");
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(15);
                    dueDate = d.toISOString().slice(0, 10);
                  }
                  setExciseForm({ ...exciseForm, periodEnd: end, dueDate });
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Due Date</label>
              <Input
                type="date"
                value={exciseForm.dueDate}
                onChange={(e) => setExciseForm({ ...exciseForm, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Status</label>
              <Select
                value={exciseForm.status}
                onChange={(e) => setExciseForm({ ...exciseForm, status: e.target.value })}
              >
                {EXCISE_STATUSES.map((s) => (
                  <option key={s} value={s}>{formatStatus(s)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Proof Gallons</label>
              <Input
                type="number"
                step="0.001"
                value={exciseForm.totalProofGallons}
                onChange={(e) => setExciseForm({ ...exciseForm, totalProofGallons: e.target.value })}
                placeholder="0.000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Rate / Proof Gallon</label>
              <Input
                type="number"
                step="0.01"
                value={exciseForm.ratePerProofGallon}
                onChange={(e) => setExciseForm({ ...exciseForm, ratePerProofGallon: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="bg-[#f7f7f7] border border-[#e5e5e5] rounded-md px-4 py-3">
            <p className="text-xs text-[#737373]">Estimated Total Tax</p>
            <p className="text-lg font-semibold text-[#0a0a0a] mt-0.5">
              ${liveExciseTax.toFixed(2)}
            </p>
            {exciseForm.state === "FL" && (
              <p className="text-[10px] text-[#a3a3a3] mt-1">
                FL craft credit (§ 565.108): eligible distillers (&lt;75,000 gal/yr) may deduct 7% — ${(liveExciseTax * 0.07).toFixed(2)} credit &rarr; net ${(liveExciseTax * 0.93).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Notes</label>
            <textarea
              value={exciseForm.notes}
              onChange={(e) => setExciseForm({ ...exciseForm, notes: e.target.value })}
              className="flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setExciseOpen(false); setEditExcise(null); setExciseForm(emptyExcise); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editExcise) {
                  updateExciseMut.mutate({ id: editExcise.id, data: exciseForm });
                } else {
                  createExciseMut.mutate(exciseForm);
                }
              }}
              disabled={createExciseMut.isPending || updateExciseMut.isPending}
            >
              {editExcise ? "Save Changes" : "Create Return"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
