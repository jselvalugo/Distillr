import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "../hooks/use-admin-auth";
import { useLocation } from "wouter";
import { apiRequest } from "../lib/queryClient";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "active" | "suspended" | "cancelled";
  created_at: string;
  user_count: number;
  // Licensing
  user_limit: number;
  license_expires_at: string | null;
  billing_email: string | null;
  billing_amount: number | null;
  billing_cycle: string;
  license_notes: string | null;
}

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; color: string; defaultLimit: number; price: number }> = {
  standard:   { label: "Standard",  color: "#6b7280", defaultLimit: 1,  price: 99  },
  pro:        { label: "Premium",   color: "#8b5cf6", defaultLimit: 15, price: 299 },
  enterprise: { label: "Enterprise", color: "#f59e0b", defaultLimit: -1, price: 0   },
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#a78bfa", manager: "#60a5fa", operator: "#34d399", viewer: "#9ca3af",
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const s = {
  inp: {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f0f0f0", outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,
  label: {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "rgba(255,255,255,0.4)", marginBottom: 5,
    letterSpacing: "0.05em", textTransform: "uppercase",
  } as React.CSSProperties,
  cell: { padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)", verticalAlign: "middle" } as React.CSSProperties,
  btn: (bg = "rgba(255,255,255,0.08)", tc = "rgba(255,255,255,0.55)", bc = "rgba(255,255,255,0.1)"): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
    background: bg, border: `1px solid ${bc}`, color: tc, transition: "all .15s",
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function licenseStatus(t: Tenant): "ok" | "expiring" | "expired" | "none" {
  if (!t.license_expires_at) return "none";
  const exp = new Date(t.license_expires_at);
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "ok";
}

function userCapPct(t: Tenant): number {
  if (t.user_limit === -1) return 0;
  return Math.min(100, Math.round((t.user_count / t.user_limit) * 100));
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n: number | null, cycle = "monthly") {
  if (n == null || n === 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}/${cycle === "annual" ? "yr" : "mo"}`;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Tenant["status"] }) {
  const colors: Record<string, { bg: string; dot: string; text: string }> = {
    active:    { bg: "rgba(34,197,94,0.12)",   dot: "#22c55e", text: "#4ade80" },
    suspended: { bg: "rgba(239,68,68,0.12)",   dot: "#ef4444", text: "#f87171" },
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
  const meta = PLAN_META[plan] ?? { label: plan, color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: `${meta.color}18`, borderRadius: 6, padding: "2px 8px", border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  );
}

function LicenseBadge({ t }: { t: Tenant }) {
  const st = licenseStatus(t);
  if (st === "none") return <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>;
  const cfg = {
    ok:       { bg: "rgba(34,197,94,0.1)",  dot: "#22c55e", text: "#4ade80" },
    expiring: { bg: "rgba(245,158,11,0.1)", dot: "#f59e0b", text: "#fbbf24" },
    expired:  { bg: "rgba(239,68,68,0.1)",  dot: "#ef4444", text: "#f87171" },
    none:     { bg: "transparent", dot: "", text: "" },
  }[st];
  const days = Math.ceil((new Date(t.license_expires_at!).getTime() - Date.now()) / 86400000);
  const label = st === "expired" ? "Expired" : st === "expiring" ? `${days}d left` : fmtDate(t.license_expires_at);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, borderRadius: 6, padding: "2px 8px" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.text }}>{label}</span>
    </span>
  );
}

function UserCapBar({ t }: { t: Tenant }) {
  const pct = userCapPct(t);
  const atCap = t.user_limit !== -1 && t.user_count >= t.user_limit;
  const barColor = atCap ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: atCap ? "#f87171" : "rgba(255,255,255,0.7)", minWidth: 36 }}>
        {t.user_count}/{t.user_limit === -1 ? "∞" : t.user_limit}
      </span>
      {t.user_limit !== -1 && (
        <div style={{ width: 60, height: 4, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width .3s" }} />
        </div>
      )}
    </div>
  );
}

// ─── Edit Tenant License Modal ────────────────────────────────────────────────

function EditLicenseModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    plan: tenant.plan,
    userLimit: String(tenant.user_limit),
    billingAmount: tenant.billing_amount != null ? String(tenant.billing_amount) : "",
    billingCycle: tenant.billing_cycle || "monthly",
    billingEmail: tenant.billing_email ?? "",
    licenseExpiresAt: tenant.license_expires_at ? tenant.license_expires_at.slice(0, 10) : "",
    licenseNotes: tenant.license_notes ?? "",
    status: tenant.status,
    name: tenant.name,
    slug: tenant.slug,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          status: form.status,
          userLimit: parseInt(form.userLimit) || -1,
          billingAmount: parseFloat(form.billingAmount) || null,
          billingCycle: form.billingCycle,
          billingEmail: form.billingEmail || null,
          licenseExpiresAt: form.licenseExpiresAt ? new Date(form.licenseExpiresAt).toISOString() : null,
          licenseNotes: form.licenseNotes || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast.success("License updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const inp = (key: keyof typeof form, type = "text", extra?: object) => ({
    style: s.inp, type, value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      (e.target.style.borderColor = "rgba(255,255,255,0.3)"),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      (e.target.style.borderColor = "rgba(255,255,255,0.1)"),
    ...extra,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 520, maxHeight: "90vh", overflowY: "auto", background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Edit Tenant & License</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>{tenant.name}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Identity */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Identity</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Name</label><input {...inp("name")} /></div>
              <div><label style={s.label}>Slug</label><input {...inp("slug")} /></div>
            </div>
          </div>

          {/* License */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Plan & License</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={s.label}>Plan</label>
                <select style={{ ...s.inp, cursor: "pointer" }} value={form.plan}
                  onChange={(e) => {
                    const p = e.target.value;
                    const def = PLAN_META[p]?.defaultLimit ?? 5;
                    setForm(f => ({ ...f, plan: p, userLimit: String(def) }));
                  }}>
                  <option value="standard">Standard — $99/mo (1 user)</option>
                  <option value="pro">Premium — $299/mo (2–15 users)</option>
                  <option value="enterprise">Enterprise — Custom</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Status</label>
                <select style={{ ...s.inp, cursor: "pointer" }} value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label style={s.label}>User Limit (-1 = unlimited)</label>
                <input {...inp("userLimit", "number")} />
              </div>
              <div>
                <label style={s.label}>License Expires</label>
                <input {...inp("licenseExpiresAt", "date")} />
              </div>
            </div>
          </div>

          {/* Billing */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Billing</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={s.label}>Amount ($)</label>
                <input {...inp("billingAmount", "number")} placeholder="e.g. 299" />
              </div>
              <div>
                <label style={s.label}>Cycle</label>
                <select style={{ ...s.inp, cursor: "pointer" }} value={form.billingCycle}
                  onChange={(e) => setForm(f => ({ ...f, billingCycle: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>Billing Email</label>
                <input {...inp("billingEmail", "email")} placeholder="billing@distillery.com" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={s.label}>License Notes</label>
            <textarea
              style={{ ...s.inp, height: 72, resize: "vertical" }}
              value={form.licenseNotes}
              onChange={(e) => setForm(f => ({ ...f, licenseNotes: e.target.value }))}
              placeholder="e.g. Annual deal, includes onboarding, renewal due Q1 2027…"
              onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", opacity: saveMut.isPending ? 0.6 : 1 }}>
              {saveMut.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Users Panel ───────────────────────────────────────────────────────

function TenantUsersPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState<TenantUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "operator" });
  const [resetUser, setResetUser] = useState<TenantUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: users = [], isLoading } = useQuery<TenantUser[]>({
    queryKey: [`/api/admin/tenants/${tenant.id}/users`],
    queryFn: () => apiRequest<TenantUser[]>(`/api/admin/tenants/${tenant.id}/users`),
  });

  const editMut = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<TenantUser> }) =>
      apiRequest(`/api/admin/tenants/${tenant.id}/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/admin/tenants/${tenant.id}/users`] });
      qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setEditUser(null);
      toast.success("User updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const resetMut = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiRequest(`/api/admin/tenants/${tenant.id}/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => { setResetUser(null); setNewPassword(""); toast.success("Password reset"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  function openEdit(u: TenantUser) { setEditUser(u); setEditForm({ name: u.name, email: u.email, role: u.role }); }
  const instanceUrl = typeof window !== "undefined" ? window.location.origin : "";
  const atCap = tenant.user_limit !== -1 && tenant.user_count >= tenant.user_limit;

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0, background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ padding: "16px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                Users in <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{tenant.name}</span>
              </p>
              {atCap && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "2px 8px" }}>
                  At user limit — upgrage plan to add more
                </span>
              )}
            </div>
            <a href={instanceUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 7, padding: "4px 11px" }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M6 3H3C2.448 3 2 3.448 2 4V13C2 13.552 2.448 14 3 14H12C12.552 14 13 13.552 13 13V10M10 2H14V6M14 2L8 8" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Open Instance
            </a>
          </div>

          {isLoading ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>Loading…</p>
          ) : users.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>No users in this tenant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  {["Name", "Email", "Role", "Status", "Joined", ""].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#fff" }}>{u.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{u.email}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ROLE_COLORS[u.role] ?? "#9ca3af", background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "2px 7px", textTransform: "capitalize" }}>{u.role}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: u.status === "active" ? "#4ade80" : "#f87171", textTransform: "capitalize" }}>{u.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button style={s.btn()} onClick={() => openEdit(u)}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                          Edit
                        </button>
                        <button style={s.btn("rgba(251,191,36,0.1)", "#fbbf24", "rgba(251,191,36,0.25)")}
                          onClick={() => { setResetUser(u); setNewPassword(""); setShowPassword(false); }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.18)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.1)"; }}>
                          Reset PW
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editUser && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditUser(null); }}>
            <div style={{ width: 420, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "28px 24px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 20px" }}>Edit User</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={s.label}>Name</label><input style={s.inp} value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} /></div>
                <div><label style={s.label}>Email</label><input style={s.inp} type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} /></div>
                <div>
                  <label style={s.label}>Role</label>
                  <select style={{ ...s.inp, cursor: "pointer" }} value={editForm.role} onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}>
                    {["admin","manager","operator","viewer"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button onClick={() => setEditUser(null)} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => editMut.mutate({ userId: editUser.id, data: editForm })} disabled={editMut.isPending}
                    style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", opacity: editMut.isPending ? 0.6 : 1 }}>
                    {editMut.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resetUser && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
            onClick={(e) => { if (e.target === e.currentTarget) { setResetUser(null); setNewPassword(""); } }}>
            <div style={{ width: 380, background: "#111", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 16, padding: "28px 24px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>Reset Password</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 20px" }}>For <span style={{ color: "#fff", fontWeight: 600 }}>{resetUser.name}</span></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={s.label}>New Password</label>
                  <div style={{ position: "relative" }}>
                    <input style={{ ...s.inp, paddingRight: 44 }} type={showPassword ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="min 8 characters"
                      onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, padding: 0 }}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setResetUser(null); setNewPassword(""); }} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => resetMut.mutate({ userId: resetUser.id, password: newPassword })} disabled={resetMut.isPending || newPassword.length < 8}
                    style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fbbf24", color: "#080808", border: "none", cursor: "pointer", opacity: (resetMut.isPending || newPassword.length < 8) ? 0.5 : 1 }}>
                    {resetMut.isPending ? "Resetting…" : "Reset"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Operations Hub ───────────────────────────────────────────────────────────

type OpsTab = "filings" | "legal" | "industry" | "compliance";

const OPS_TABS: { key: OpsTab; label: string; icon: string }[] = [
  { key: "filings",    label: "Annual Filings",     icon: "📋" },
  { key: "legal",      label: "Legal & Privacy",    icon: "⚖️" },
  { key: "industry",   label: "Industry Reference", icon: "🏭" },
  { key: "compliance", label: "Data & Compliance",  icon: "🛡️" },
];

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{title}</p>
      {children}
    </div>
  );
}

function CheckItem({ status, text, sub }: { status: "required" | "recommended" | "annual" | "quarterly" | "monthly"; text: string; sub?: string }) {
  const colors: Record<string, { bg: string; tc: string; label: string }> = {
    required:    { bg: "rgba(239,68,68,0.12)",   tc: "#f87171", label: "Required" },
    recommended: { bg: "rgba(245,158,11,0.12)",  tc: "#fbbf24", label: "Recommended" },
    annual:      { bg: "rgba(96,165,250,0.12)",  tc: "#60a5fa", label: "Annual" },
    quarterly:   { bg: "rgba(167,139,250,0.12)", tc: "#a78bfa", label: "Quarterly" },
    monthly:     { bg: "rgba(52,211,153,0.12)",  tc: "#34d399", label: "Monthly" },
  };
  const c = colors[status];
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: c.tc, background: c.bg, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 1 }}>{c.label}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>{text}</p>
        {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>{sub}</p>}
      </div>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 10px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 500, textAlign: "right" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "0 0 12px", padding: "0 0 0 16px", listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }}>→</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AlertBox({ type, title, body }: { type: "warn" | "info" | "danger"; title: string; body: string }) {
  const cfg = {
    warn:   { bg: "rgba(245,158,11,0.08)",  bc: "rgba(245,158,11,0.25)",  tc: "#fbbf24" },
    info:   { bg: "rgba(96,165,250,0.08)",  bc: "rgba(96,165,250,0.25)",  tc: "#60a5fa" },
    danger: { bg: "rgba(239,68,68,0.08)",   bc: "rgba(239,68,68,0.25)",   tc: "#f87171" },
  }[type];
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.bc}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: cfg.tc, margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function FilingsTab() {
  return (
    <div>
      <AlertBox type="warn" title="Disclaimer" body="This is a reference guide, not legal or tax advice. Consult a licensed CPA and attorney for your specific situation. Deadlines vary by entity type, state, and fiscal year." />

      <DocSection title="Federal Tax Obligations (US)">
        <CheckItem status="annual" text="Form 1120-S — S-Corporation Tax Return" sub="Due March 15. File extension (Form 7004) by March 15 if needed — grants 6-month extension to September 15." />
        <CheckItem status="annual" text="Form 1040 + Schedule K-1 — Personal Return" sub="Due April 15 (October 15 with extension). K-1 from your S-Corp flows through to your personal return." />
        <CheckItem status="quarterly" text="Form 1040-ES — Estimated Quarterly Taxes" sub="Due: April 15, June 15, September 15, January 15. Pay estimated personal income tax on S-Corp distributions to avoid underpayment penalties." />
        <CheckItem status="annual" text="Form 1099-NEC — Contractor Payments ≥ $600" sub="Due January 31 to contractors and IRS. Required for any US-based contractor paid $600+ during the year." />
        <CheckItem status="annual" text="Form W-2 — Employee Wages" sub="Due January 31 to employees and SSA. If you have W-2 employees." />
        <CheckItem status="annual" text="FBAR / FinCEN 114 — Foreign Bank Accounts" sub="Due April 15 (auto-extended to October 15). Required if foreign financial accounts exceed $10,000 at any time during the year." />
      </DocSection>

      <DocSection title="Puerto Rico Obligations">
        <CheckItem status="annual" text="Planilla de Contribución sobre Ingresos — PR Corporate Return" sub="Form SC 2644 or SC 2553. Due 3.5 months after fiscal year end. Puerto Rico has separate tax jurisdiction from the US federal system." />
        <CheckItem status="quarterly" text="PR Estimated Tax Payments" sub="Filed with Hacienda (Departamento de Hacienda). Quarterly installments based on prior year liability." />
        <CheckItem status="annual" text="Patente Municipal — Municipal Business License" sub="Annual municipal license fee for conducting business. Filed with your municipality. Due varies by municipality (typically January–April)." />
        <CheckItem status="annual" text="Act 60 / Act 20 Annual Report" sub="If operating under Act 60 tax incentives (export services decree), must file annual compliance report with DDEC by April 15." />
        <CheckItem status="annual" text="PR Sales and Use Tax (IVU) — Monthly Returns" sub="Monthly SUT returns if selling taxable goods/services in Puerto Rico. Due 20th of following month." />
      </DocSection>

      <DocSection title="Corporate Housekeeping">
        <CheckItem status="annual" text="Annual Report to State of Incorporation" sub="Delaware: due March 1 + franchise tax by March 1. PR corps: filed with DACO or Dept of State. Failure results in administrative dissolution." />
        <CheckItem status="annual" text="Registered Agent Renewal" sub="Renew your registered agent service annually (if Delaware/foreign corp). Typically auto-renewed — confirm it doesn't lapse." />
        <CheckItem status="annual" text="Board/Shareholder Meeting Minutes" sub="Hold annual meeting and document minutes. S-Corps must maintain corporate formalities to preserve liability protection." />
        <CheckItem status="recommended" text="Operating Agreement / Bylaws Review" sub="Review annually for accuracy. Update if ownership, officers, or business scope has changed." />
        <CheckItem status="recommended" text="Business Insurance Renewal" sub="General liability, E&O (Errors & Omissions), Cyber Liability. Review coverage limits annually especially as ARR grows." />
      </DocSection>

      <DocSection title="Software / SaaS Specific">
        <CheckItem status="annual" text="SOC 2 Type II Audit (when required)" sub="Enterprise customers increasingly require SOC 2 Type II. Begin with SOC 2 Type I if not yet in place. Typically required when ARR > $1M or serving regulated industries." />
        <CheckItem status="recommended" text="Penetration Test" sub="Annual third-party pen test. Required by many enterprise procurement processes. Keep the report for your security questionnaire library." />
        <CheckItem status="recommended" text="Privacy Policy & Terms Review" sub="Review and update Privacy Policy and Terms of Service at least annually, or whenever you add new data types, integrations, or change data processing practices." />
        <CheckItem status="annual" text="Domain & SSL Certificate Renewal" sub="Track expiration dates for all domains, SSL certs, and code signing certificates. Automate via Let's Encrypt or ensure registrar auto-renew is active." />
      </DocSection>
    </div>
  );
}

function LegalTab() {
  return (
    <div>
      <AlertBox type="info" title="These are structural requirements, not legal advice" body="Have a licensed attorney review all legal documents before publishing. Requirements evolve — schedule an annual review with counsel." />

      <DocSection title="Privacy Policy — Required Elements">
        <InfoBlock title="What Data You Collect" items={[
          { label: "Identity data", value: "Name, email, job title, company" },
          { label: "Account data", value: "Login credentials (hashed), tenant configuration" },
          { label: "Production data", value: "Batch records, barrel data, inventory entered by users" },
          { label: "Usage data", value: "Pages visited, features used, session duration" },
          { label: "Technical data", value: "IP address, browser type, device ID" },
          { label: "Payment data", value: "Billing name, email — card data via Stripe (not stored by us)" },
        ]} />
        <InfoBlock title="CCPA Requirements (California users)" items={[
          { label: "Right to Know", value: "Disclose categories and purposes of data collected" },
          { label: "Right to Delete", value: "Honor deletion requests within 45 days" },
          { label: "Right to Opt-Out", value: "\"Do Not Sell My Personal Information\" link (if applicable)" },
          { label: "Non-discrimination", value: "Cannot penalize users for exercising CCPA rights" },
          { label: "Annual update", value: "Update policy if data practices change" },
        ]} />
        <InfoBlock title="GDPR Requirements (EU users)" items={[
          { label: "Lawful basis", value: "Identify legal basis for each processing activity (contract, consent, legitimate interest)" },
          { label: "Data subject rights", value: "Access, rectification, erasure, portability, objection" },
          { label: "Response time", value: "30 days to respond to data subject requests" },
          { label: "DPA requirement", value: "Execute a Data Processing Agreement with EU customers" },
          { label: "Breach notification", value: "72 hours to notify supervisory authority of breach" },
          { label: "Data transfers", value: "Standard Contractual Clauses (SCCs) for US → EU transfers" },
        ]} />
        <BulletList items={[
          "Identify a Data Protection Officer (DPO) or point of contact for privacy matters",
          "Describe data retention periods for each data category",
          "List all third-party processors (Railway, Neon/Postgres, Stripe, Resend, Sentry, etc.) and their roles",
          "Describe your cookie policy — session cookies, analytics, third-party",
          "Include an effective date and commit to notifying users of material changes",
          "Provide a physical mailing address (required by CAN-SPAM and some state laws)",
        ]} />
      </DocSection>

      <DocSection title="Terms of Service — Key Clauses">
        <BulletList items={[
          "License grant: Limited, non-exclusive, non-transferable right to access the Service",
          "Acceptable use: Reference your Acceptable Use Policy; list prohibited conduct explicitly",
          "Subscription & payment: Billing cycle, auto-renewal, failed payment grace period, price change notice (30 days minimum)",
          "Data ownership: Users own their data; you have a limited license to process it to provide the Service",
          "Confidentiality: Mutual NDA provisions for enterprise; at minimum protect customer data",
          "Limitation of liability: Cap at fees paid in last 12 months; exclude consequential damages",
          "Indemnification: Customer indemnifies for their content; you indemnify for IP infringement",
          "Termination: Define what triggers termination, notice period (30 days for convenience), data export window (30–90 days)",
          "Governing law & disputes: Specify jurisdiction (Puerto Rico or Delaware); consider arbitration clause",
          "Changes to terms: Require 30 days notice for material changes; continued use = acceptance",
          "Uptime SLA: If offered, define measurement period, excluded downtime (maintenance, force majeure), and remedies (service credits)",
          "Force majeure: Exclude liability for events outside reasonable control",
          "Entire agreement: ToS + DPA + Order Form supersede all prior agreements",
        ]} />
        <AlertBox type="warn" title="SaaS-Specific Clause: TTB Data" body="Since Distillr stores federal compliance data (TTB records, excise tax calculations), explicitly disclaim that the software does not provide legal, tax, or regulatory compliance advice. Users are responsible for verifying accuracy of all regulatory filings." />
      </DocSection>

      <DocSection title="Data Processing Agreement (DPA)">
        <BulletList items={[
          "Required for any EU/EEA customer — execute before onboarding them",
          "Defines: controller (customer) vs processor (Distillr) responsibilities",
          "Must list sub-processors: Railway (hosting), Neon (database), Stripe (billing), any AI providers",
          "Includes Standard Contractual Clauses (SCCs) for international transfers",
          "Specify audit rights — right for customer to audit or receive third-party audit report",
          "Sub-processor notification: Commit to notifying customers before adding new sub-processors (30 days notice typical)",
          "Data deletion: Commit to deleting/returning all customer data within 30 days of termination",
        ]} />
      </DocSection>

      <DocSection title="Acceptable Use Policy — Key Prohibitions">
        <BulletList items={[
          "No use for illegal activities including falsifying federal TTB records",
          "No reverse engineering, decompilation, or unauthorized API access",
          "No uploading malicious code, viruses, or disruptive content",
          "No sharing login credentials across multiple distilleries (one tenant = one DSP)",
          "No scraping or automated data extraction beyond normal API use",
          "No use in jurisdictions where distilled spirits production is illegal",
          "Violation = grounds for immediate suspension without refund",
        ]} />
      </DocSection>
    </div>
  );
}

function IndustryTab() {
  return (
    <div>
      <DocSection title="TTB — Distilled Spirits Plant (DSP) Overview">
        <InfoBlock title="DSP Permit Requirements (27 CFR Part 19)" items={[
          { label: "Federal Basic Permit", value: "Required before producing, bottling, or warehousing spirits" },
          { label: "DSP Registration", value: "File with TTB; separate from Basic Permit" },
          { label: "Bond requirement", value: "Operations/Withdrawal bond required to operate bonded premises" },
          { label: "Qualifying officer", value: "At least one officer must be a US citizen not prohibited from holding permit" },
          { label: "State license", value: "State-level distillery license required in addition to federal" },
          { label: "Renewal", value: "Basic Permits do not expire but must be amended if operations change" },
        ]} />
      </DocSection>

      <DocSection title="Federal Excise Tax (FET) — Current Rates">
        <InfoBlock title="Distilled Spirits FET (per Proof Gallon)" items={[
          { label: "Craft Tier 1", value: "$2.70/PG — first 100,000 PG removed from bond" },
          { label: "Craft Tier 2", value: "$13.34/PG — 100,001 to 22,130,000 PG" },
          { label: "Standard Rate", value: "$13.50/PG — over 22.13M PG or non-craft" },
          { label: "Craft eligibility", value: "Domestic producers only; not applicable to importers" },
          { label: "Proof Gallon", value: "1 gallon at 100° proof (50% ABV)" },
          { label: "Formula", value: "Wine Gallons × (Proof / 100) = Proof Gallons" },
        ]} />
        <AlertBox type="warn" title="Craft Rate Qualification" body="The reduced craft rates ($2.70 and $13.34) expire and must be reauthorized by Congress. As of 2024 they are permanent, but track TTB bulletins. Customers must apply for and receive craft producer designation." />
      </DocSection>

      <DocSection title="TTB Reporting Requirements">
        <CheckItem status="monthly" text="TTB Report of Operations — Form 5110.40" sub="Monthly. Reports spirits produced, deposited, withdrawn, and inventory balance. Due 15th of following month. Core document that Distillr's compliance module must support." />
        <CheckItem status="quarterly" text="Excise Tax Return — Form 5000.24" sub="Semi-monthly or quarterly depending on tax liability. Taxpayers with annual liability < $50K may file quarterly; > $50K file semi-monthly. Payment due with return." />
        <CheckItem status="annual" text="Annual Operations Report" sub="Annual summary submitted to TTB. Reconciles monthly reports for the calendar year." />
        <CheckItem status="required" text="Gauge Records" sub="Required per 27 CFR §19.289. Every transfer of spirits must be gauged (measured for volume and proof). Distillr's aging/barrel module covers this." />
        <CheckItem status="required" text="Distilled Spirits Production Records" sub="Per 27 CFR §19.582. Daily records of all spirits produced must be maintained and available for TTB inspection for 3 years." />
      </DocSection>

      <DocSection title="COLA — Certificate of Label Approval">
        <BulletList items={[
          "Required before any bottled distilled spirits can be shipped in interstate commerce",
          "Filed online via TTB's COLAs Online system (mypermanentrecord.ttb.gov)",
          "Standard review: 90 days; expedited (30 days) available for compliant submissions",
          "Required elements: Brand name, class/type of spirits, net contents, alcohol content (ABV%), name and address of bottler/importer",
          "Formula approval required first for flavored spirits and anything with added ingredients",
          "COLA is per label — any label change requires new COLA approval",
          "State label approvals are separate and required by many states in addition to federal COLA",
        ]} />
      </DocSection>

      <DocSection title="Key Industry Standards & Definitions">
        <InfoBlock title="Spirit Classifications (27 CFR Part 5)" items={[
          { label: "Whiskey", value: "Fermented grain mash, distilled < 190°, stored in oak" },
          { label: "Bourbon", value: "≥51% corn, new charred oak, entered at ≤125°, bottled ≥80°" },
          { label: "Rum", value: "Fermented sugar cane products, distilled < 190°" },
          { label: "Vodka", value: "Neutral spirits distilled ≥ 190°, filtered/treated" },
          { label: "Gin", value: "Spirits with juniper berry flavor predominant" },
          { label: "Tequila", value: "Blue agave, produced in specific Mexican regions (import)" },
        ]} />
        <InfoBlock title="Common Measurements" items={[
          { label: "Proof", value: "Twice the ABV percentage (e.g., 80° proof = 40% ABV)" },
          { label: "Wine Gallon (WG)", value: "1 US liquid gallon of liquid, regardless of alcohol content" },
          { label: "Proof Gallon (PG)", value: "1 WG at 100° proof; the taxable unit" },
          { label: "Angel's Share", value: "Volume lost to evaporation during aging (typically 2–10%/year)" },
          { label: "Fill Proof", value: "Proof at which spirits enter the barrel (must be ≤ 190°)" },
          { label: "Bottling Proof", value: "Proof at bottling (minimum 80° for most spirits)" },
        ]} />
      </DocSection>

      <DocSection title="Product Roadmap Awareness — What Customers Need">
        <BulletList items={[
          "TTB Form 5110.40 auto-population from batch records — the #1 requested feature in the distillery compliance space",
          "State excise tax calculation varies by state — build a state rules engine (California, Texas, Florida are largest markets)",
          "Barrel tracking interoperability with industry databases (DISCUS, KDA for Kentucky distillers)",
          "Label management with COLA submission tracking and expiration alerts",
          "Integration with accounting software (QuickBooks, Xero) for COGS and inventory valuation",
          "Mobile gauging app — distillers want to log barrel readings from the warehouse floor",
          "Multi-DSP support — larger customers operate multiple production facilities under one company",
          "Grain-to-glass traceability — farm-to-bottle documentation increasingly demanded by premium brands",
          "Electronic TTB filing when/if TTB opens API access",
          "Distribution tracking — cases shipped to distributors, depletion reporting",
        ]} />
      </DocSection>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div>
      <DocSection title="Data Distillr Collects & Processes">
        <InfoBlock title="Personal Data Categories" items={[
          { label: "User accounts", value: "Name, email, hashed password, role, tenant_id" },
          { label: "Billing contacts", value: "Name, billing email — credit card held by Stripe only" },
          { label: "Usage logs", value: "IP addresses, session tokens, API request logs (30-day retention)" },
          { label: "Waitlist", value: "Name, email, distillery name, state, message" },
          { label: "Audit logs", value: "User ID, action, timestamp, changed fields — retained 7 years (TTB requirement)" },
        ]} />
        <InfoBlock title="Customer Business Data (Controller is the Customer)" items={[
          { label: "Production records", value: "Batch codes, distillation specs, proof gallons — TTB compliance data" },
          { label: "Barrel records", value: "Serial numbers, aging data, warehouse locations" },
          { label: "Inventory", value: "Item names, lot codes, quantities" },
          { label: "Staff", value: "Employee names, roles, schedules" },
          { label: "Sales orders", value: "Order details, distributor contacts, pricing" },
          { label: "Compliance filings", value: "Permit numbers, filing dates, regulatory data" },
        ]} />
      </DocSection>

      <DocSection title="Data Retention Policy">
        <InfoBlock title="Recommended Retention Periods" items={[
          { label: "Active account data", value: "Retained for life of subscription" },
          { label: "TTB/compliance records", value: "7 years (TTB requires 3 years; 7 provides buffer)" },
          { label: "Financial/billing records", value: "7 years (IRS requirement)" },
          { label: "Audit logs", value: "7 years" },
          { label: "Deleted account data", value: "30-day recovery window, then purge within 90 days" },
          { label: "Server/access logs", value: "30 days rolling" },
          { label: "Backups", value: "30-day rolling backup retention" },
        ]} />
        <AlertBox type="danger" title="Data Purge on Account Deletion" body="When a tenant is deleted, you must purge all their personal data within 90 days. Business/compliance records that are legally required may need to be handed back to the customer before deletion. Document your deletion process." />
      </DocSection>

      <DocSection title="Security Standards to Maintain">
        <CheckItem status="required" text="TLS 1.2+ on all endpoints" sub="Enforce HTTPS everywhere. Redirect HTTP to HTTPS. Use HSTS headers. Minimum TLS 1.2, prefer TLS 1.3." />
        <CheckItem status="required" text="Passwords hashed with bcrypt / Argon2" sub="Minimum cost factor 12 for bcrypt. Never store plaintext passwords. Salt every hash." />
        <CheckItem status="required" text="Multi-tenant data isolation" sub="Every DB query must include tenant_id filter. Row-level security on PostgreSQL strongly recommended. Regular audit to verify no cross-tenant data leakage." />
        <CheckItem status="required" text="Environment secrets in secrets manager" sub="Never commit secrets to git. Use Railway environment variables or a secrets manager. Rotate DB passwords and API keys at minimum annually." />
        <CheckItem status="recommended" text="Rate limiting on auth endpoints" sub="Implement rate limiting on /api/auth/login to prevent brute force. Maximum 5 failed attempts before lockout or CAPTCHA." />
        <CheckItem status="recommended" text="Dependency vulnerability scanning" sub="Run npm audit or Snyk in CI/CD pipeline. Address critical vulnerabilities within 7 days, high within 30 days." />
        <CheckItem status="recommended" text="Database backups verified" sub="Verify automated backups weekly. Test restoration quarterly. Document RPO (Recovery Point Objective) and RTO (Recovery Time Objective)." />
        <CheckItem status="recommended" text="Incident response plan" sub="Document steps for: data breach, service outage, ransomware. Know your 72-hour GDPR notification obligation. Have a breach notification template ready." />
      </DocSection>

      <DocSection title="Sub-Processors to Disclose">
        <InfoBlock title="Current Infrastructure (update if you add services)" items={[
          { label: "Railway", value: "Hosting & deployment (US)" },
          { label: "Neon / PostgreSQL", value: "Database (US)" },
          { label: "Stripe", value: "Payment processing (US)" },
          { label: "Resend / SendGrid", value: "Transactional email (US)" },
          { label: "Cloudflare", value: "DNS, CDN, DDoS protection (Global)" },
          { label: "GitHub", value: "Source code repository (US)" },
          { label: "Sentry (if used)", value: "Error tracking (US)" },
          { label: "OpenAI / Anthropic (if used)", value: "AI features — MUST disclose if customer data is sent" },
        ]} />
        <AlertBox type="danger" title="AI Sub-Processor Disclosure" body="If any customer data (batch records, barrel data, staff information) is sent to an AI provider (OpenAI, Anthropic, etc.) for the AI chat feature, this MUST be disclosed in your Privacy Policy and DPA as a sub-processor. Many enterprise customers and regulated industries will object to this." />
      </DocSection>

      <DocSection title="Breach Response Checklist">
        <BulletList items={[
          "Hour 0–1: Contain the breach — revoke compromised credentials, isolate affected systems",
          "Hour 1–4: Assess scope — what data was accessed, which tenants are affected, how long was it exposed",
          "Hour 4–24: Notify affected tenants — provide clear description of what happened, what data, what you're doing",
          "72 hours: Notify supervisory authority if EU personal data was affected (GDPR requirement)",
          "7 days: Notify affected users if their personal data was exposed (varies by US state — California requires 45 days, but faster is better)",
          "30 days: Complete root cause analysis and implement remediation",
          "Document everything — breach log, notifications sent, timeline, remediation steps",
          "Review cyber liability insurance coverage — file claim if applicable",
        ]} />
      </DocSection>
    </div>
  );
}

function OperationsHub() {
  const [activeOpsTab, setActiveOpsTab] = useState<OpsTab>("filings");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 4px" }}>Operations Hub</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Reference documents, compliance requirements, and industry knowledge to run Distillr.</p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 6, width: "fit-content" }}>
        {OPS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveOpsTab(tab.key)}
            style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, cursor: "pointer", border: "none", display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
              background: activeOpsTab === tab.key ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeOpsTab === tab.key ? "#fff" : "rgba(255,255,255,0.4)" }}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820 }}>
        {activeOpsTab === "filings"    && <FilingsTab />}
        {activeOpsTab === "legal"      && <LegalTab />}
        {activeOpsTab === "industry"   && <IndustryTab />}
        {activeOpsTab === "compliance" && <ComplianceTab />}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", slug: "", plan: "standard", adminEmail: "", adminPassword: "", adminName: "", userLimit: "" };

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tenants" | "operations">("tenants");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [editLicense, setEditLicense] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    queryFn: () => apiRequest<Tenant[]>("/api/admin/tenants"),
    enabled: isAdmin,
  });

  const { data: waitlist = [] } = useQuery<{ id: string; name: string; email: string; distillery_name: string | null; state: string | null; message: string | null; submitted_at: string }[]>({
    queryKey: ["/api/waitlist"],
    queryFn: () => apiRequest("/api/waitlist"),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("/api/admin/tenants", { method: "POST", body: JSON.stringify({ ...data, userLimit: parseInt(data.userLimit) || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] }); setShowCreate(false); setForm(EMPTY_FORM); toast.success("Tenant created"); },
    onError: (e: any) => toast.error(e.message ?? "Failed to create tenant"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      apiRequest(`/api/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/tenants"] }); setConfirmDelete(null); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const removeWaitlistMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/waitlist"] }); toast.success("Removed from waitlist"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (authLoading) return <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading…</div>;
  if (!isAdmin) { navigate("/admin/login"); return null; }

  const active    = tenants.filter(t => t.status === "active").length;
  const suspended = tenants.filter(t => t.status === "suspended").length;
  const mrr       = tenants.filter(t => t.status === "active" && t.billing_amount).reduce((s, t) => {
    const mo = t.billing_cycle === "annual" ? (t.billing_amount! / 12) : t.billing_amount!;
    return s + mo;
  }, 0);
  const atCap     = tenants.filter(t => t.user_limit !== -1 && t.user_count >= t.user_limit).length;
  const expiring  = tenants.filter(t => ["expiring", "expired"].includes(licenseStatus(t))).length;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#fff" }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>Distillr</span>
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Super Admin</span>
          </div>
          <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
            {([["tenants", "Tenants & Waitlist"], ["operations", "Operations Hub"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7, cursor: "pointer", border: "none", background: activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)", transition: "all .15s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => logout.mutateAsync().then(() => navigate("/admin/login"))}
          style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: "6px 14px", borderRadius: 7 }}>
          Sign out
        </button>
      </div>

      {activeTab === "tenants" && <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>

        {/* Heading */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 4px" }}>Tenant Management</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Licensing, user caps, and plan tracking across all accounts.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", padding: "9px 18px", borderRadius: 9, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            + New Tenant
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Tenants",    value: tenants.length,                  color: "#fff" },
            { label: "Active",           value: active,                           color: "#4ade80" },
            { label: "MRR",              value: mrr > 0 ? `$${Math.round(mrr).toLocaleString()}` : "—", color: "#a78bfa" },
            { label: "At User Cap",      value: atCap,                            color: atCap > 0 ? "#f87171" : "#737373" },
            { label: "License Alerts",   value: expiring,                         color: expiring > 0 ? "#fbbf24" : "#737373" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 6px" }}>{stat.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Loading…</div>
          ) : tenants.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>No tenants yet.</p>
              <button onClick={() => setShowCreate(true)} style={{ fontSize: 13, fontWeight: 600, background: "#fff", color: "#080808", border: "none", cursor: "pointer", padding: "9px 18px", borderRadius: 9 }}>Create first tenant</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th style={{ width: 28, padding: "12px 8px 12px 16px" }} />
                  {["Distillery", "Plan", "Status", "Users", "License", "Billing", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const isExpanded = expandedTenant === t.id;
                  return [
                    <tr key={t.id}
                      style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "background .15s", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent" }}
                      onClick={() => setExpandedTenant(isExpanded ? null : t.id)}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "13px 8px 13px 16px", verticalAlign: "middle" }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform .2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.3)" }}>
                          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </td>
                      <td style={s.cell}>
                        <p style={{ fontWeight: 600, color: "#fff", margin: "0 0 2px", fontSize: 13 }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>{t.slug}</p>
                      </td>
                      <td style={s.cell}><PlanBadge plan={t.plan} /></td>
                      <td style={s.cell}><StatusBadge status={t.status} /></td>
                      <td style={s.cell}><UserCapBar t={t} /></td>
                      <td style={s.cell}><LicenseBadge t={t} /></td>
                      <td style={{ ...s.cell, fontSize: 12 }}>
                        {t.billing_amount
                          ? <span style={{ color: "#a78bfa", fontWeight: 600 }}>{fmtMoney(t.billing_amount, t.billing_cycle)}</span>
                          : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                      </td>
                      <td style={s.cell} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={s.btn("rgba(139,92,246,0.1)", "#a78bfa", "rgba(139,92,246,0.25)")}
                            onClick={() => setEditLicense(t)}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}>
                            License
                          </button>
                          {t.status === "active" ? (
                            <button style={s.btn("rgba(239,68,68,0.1)", "#f87171", "rgba(239,68,68,0.25)")}
                              onClick={() => patchMut.mutate({ id: t.id, data: { status: "suspended" } })}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}>
                              Suspend
                            </button>
                          ) : (
                            <button style={s.btn("rgba(34,197,94,0.1)", "#4ade80", "rgba(34,197,94,0.25)")}
                              onClick={() => patchMut.mutate({ id: t.id, data: { status: "active" } })}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.18)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}>
                              Restore
                            </button>
                          )}
                          <button style={s.btn()}
                            onClick={() => setConfirmDelete(t.id)}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded && <TenantUsersPanel key={`${t.id}-users`} tenant={t} />,
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Waitlist ── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 2px" }}>Waitlist</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>{waitlist.length} interested distilleries</p>
            </div>
          </div>
          {waitlist.length === 0 ? (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>No waitlist submissions yet.</p>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Submitted", "Name", "Email", "Distillery", "State", "Message", ""].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((w, i) => (
                    <tr key={w.id} style={{ borderBottom: i < waitlist.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                        {new Date(w.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#fff" }}>{w.name}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <a href={`mailto:${w.email}`} style={{ color: "#60a5fa", textDecoration: "none" }}>{w.email}</a>
                      </td>
                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.6)" }}>{w.distillery_name ?? "—"}</td>
                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.5)" }}>{w.state ?? "—"}</td>
                      <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.45)", maxWidth: 280 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {w.message ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          style={s.btn("rgba(239,68,68,0.1)", "#f87171", "rgba(239,68,68,0.25)")}
                          onClick={() => removeWaitlistMut.mutate(w.id)}
                          disabled={removeWaitlistMut.isPending}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>}

      {activeTab === "operations" && <OperationsHub />}

      {/* Edit License Modal */}
      {editLicense && <EditLicenseModal tenant={editLicense} onClose={() => setEditLicense(null)} />}

      {/* Create tenant modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ width: 500, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "32px 28px" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 24px", letterSpacing: "-0.02em" }}>New Tenant</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>Distillery Name</label>
                  <input style={s.inp} required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Blue Ridge Distillery"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
                <div><label style={s.label}>Slug</label>
                  <input style={s.inp} required value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="blue-ridge"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Plan</label>
                  <select style={{ ...s.inp, cursor: "pointer" }} value={form.plan}
                    onChange={(e) => {
                      const p = e.target.value;
                      const def = PLAN_META[p]?.defaultLimit ?? 3;
                      setForm(f => ({ ...f, plan: p, userLimit: String(def) }));
                    }}>
                    <option value="standard">Standard — $99/mo (1 user)</option>
                    <option value="pro">Premium — $299/mo (2–15 users)</option>
                    <option value="enterprise">Enterprise — Custom</option>
                  </select>
                </div>
                <div><label style={s.label}>User Limit</label>
                  <input style={s.inp} type="number" value={form.userLimit} onChange={(e) => setForm(f => ({ ...f, userLimit: e.target.value }))} placeholder="3"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "2px 0" }} />
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>Admin User</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>Name</label>
                  <input style={s.inp} value={form.adminName} onChange={(e) => setForm(f => ({ ...f, adminName: e.target.value }))} placeholder="John Smith"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
                <div><label style={s.label}>Email</label>
                  <input style={s.inp} type="email" required value={form.adminEmail} onChange={(e) => setForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="john@distillery.com"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
                </div>
              </div>
              <div><label style={s.label}>Temp Password</label>
                <input style={s.inp} type="password" required minLength={8} value={form.adminPassword} onChange={(e) => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="min 8 characters"
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={createMut.isPending} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#fff", color: "#080808", border: "none", cursor: "pointer", opacity: createMut.isPending ? 0.6 : 1 }}>
                  {createMut.isPending ? "Creating…" : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ width: 380, background: "#111", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "28px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>Delete tenant?</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 24px", lineHeight: 1.6 }}>This permanently deletes the tenant and all its data. Cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteMut.mutate(confirmDelete!)} disabled={deleteMut.isPending}
                style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", opacity: deleteMut.isPending ? 0.6 : 1 }}>
                {deleteMut.isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
