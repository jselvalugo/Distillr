import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "../hooks/use-admin-auth";
import { useLocation } from "wouter";
import { apiRequest } from "../lib/queryClient";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "active" | "suspended" | "cancelled";
  created_at: string;
  user_count: number;
}

const PLAN_LABELS: Record<string, string> = { standard: "Starter", pro: "Professional", enterprise: "Enterprise" };

function StatusBadge({ status }: { status: Tenant["status"] }) {
  const colors: Record<string, { bg: string; dot: string; text: string }> = {
    active:    { bg: "rgba(34,197,94,0.12)",  dot: "#22c55e", text: "#4ade80" },
    suspended: { bg: "rgba(239,68,68,0.12)",  dot: "#ef4444", text: "#f87171" },
    cancelled: { bg: "rgba(113,113,122,0.15)", dot: "#71717a", text: "#a1a1aa" },
  };
  const c = colors[status] ?? colors.cancelled;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, borderRadius: 100, padding: "3px 10px 3px 7px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text, textTransform: "capitalize" }}>{status}</span>
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: "2px 8px" }}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  );
}

const EMPTY_FORM = { name: "", slug: "", plan: "standard" as const, adminEmail: "", adminPassword: "", adminName: "" };

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    queryFn: () => apiRequest<Tenant[]>("/api/admin/tenants"),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("/api/admin/tenants", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast.success("Tenant created");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create tenant"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      apiRequest(`/api/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast.success("Tenant updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setConfirmDelete(null);
      toast.success("Tenant deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/admin/login");
  };

  if (authLoading) {
    return <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading…</div>;
  }
  if (!isAdmin) {
    navigate("/admin/login");
    return null;
  }

  const active = tenants.filter(t => t.status === "active").length;
  const suspended = tenants.filter(t => t.status === "suspended").length;

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f0f0f0", outline: "none", boxSizing: "border-box",
  };
  const cell: React.CSSProperties = {
    padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)",
    borderBottom: "1px solid rgba(255,255,255,0.06)", verticalAlign: "middle",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#fff" }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>Distillr</span>
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Admin Panel</span>
        </div>
        <button
          onClick={handleLogout}
          style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: "6px 14px", borderRadius: 7, transition: "all .15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Page heading */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 4px" }}>Tenants</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Manage all distillery accounts on the platform.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", padding: "9px 18px", borderRadius: 9, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          >
            + New Tenant
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Tenants", value: tenants.length },
            { label: "Active", value: active },
            { label: "Suspended", value: suspended },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 6px" }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tenants table */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Loading tenants…</div>
          ) : tenants.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>No tenants yet.</p>
              <button onClick={() => setShowCreate(true)} style={{ fontSize: 13, fontWeight: 600, background: "#fff", color: "#080808", border: "none", cursor: "pointer", padding: "9px 18px", borderRadius: 9 }}>Create first tenant</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Distillery", "Plan", "Status", "Users", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ transition: "background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={cell}>
                      <p style={{ fontWeight: 600, color: "#fff", margin: "0 0 2px", fontSize: 13 }}>{t.name}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>{t.slug}</p>
                    </td>
                    <td style={cell}><PlanBadge plan={t.plan} /></td>
                    <td style={cell}><StatusBadge status={t.status} /></td>
                    <td style={{ ...cell, color: "rgba(255,255,255,0.5)" }}>{t.user_count}</td>
                    <td style={{ ...cell, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {t.status === "active" ? (
                          <button
                            onClick={() => patchMut.mutate({ id: t.id, data: { status: "suspended" } })}
                            style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 7, cursor: "pointer", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", transition: "all .15s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          >
                            Revoke Access
                          </button>
                        ) : (
                          <button
                            onClick={() => patchMut.mutate({ id: t.id, data: { status: "active" } })}
                            style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 7, cursor: "pointer", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", transition: "all .15s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.18)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
                          >
                            Restore Access
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 7, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", transition: "all .15s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create tenant modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ width: 480, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "32px 28px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 24px", letterSpacing: "-0.02em" }}>New Tenant</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Distillery Name</label>
                  <input style={inp} required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Blue Ridge Distillery"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Slug</label>
                  <input style={inp} required value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="blue-ridge"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Plan</label>
                <select style={{ ...inp, cursor: "pointer" }} value={form.plan} onChange={(e) => setForm(f => ({ ...f, plan: e.target.value as any }))}>
                  <option value="standard">Starter — $99/mo</option>
                  <option value="pro">Professional — $299/mo</option>
                  <option value="enterprise">Enterprise — Custom</option>
                </select>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "2px 0" }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>Admin User</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Name</label>
                  <input style={inp} value={form.adminName} onChange={(e) => setForm(f => ({ ...f, adminName: e.target.value }))} placeholder="John Smith"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Email</label>
                  <input style={inp} type="email" required value={form.adminEmail} onChange={(e) => setForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="john@distillery.com"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Temp Password</label>
                <input style={inp} type="password" required minLength={8} value={form.adminPassword} onChange={(e) => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="min 8 characters"
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={createMut.isPending} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", opacity: createMut.isPending ? 0.6 : 1 }}>
                  {createMut.isPending ? "Creating…" : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ width: 380, background: "#111", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "28px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: "#fff" }}>Delete tenant?</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 24px", lineHeight: 1.6 }}>
              This permanently deletes the tenant and all its data. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(confirmDelete!)}
                disabled={deleteMut.isPending}
                style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", opacity: deleteMut.isPending ? 0.6 : 1 }}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
