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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", slug: "", plan: "standard", adminEmail: "", adminPassword: "", adminName: "", userLimit: "" };

export default function AdminDashboard() {
  const { isAdmin, isLoading: authLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>Distillr</span>
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Super Admin</span>
        </div>
        <button onClick={() => logout.mutateAsync().then(() => navigate("/admin/login"))}
          style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: "6px 14px", borderRadius: 7 }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>

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

      </div>

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
