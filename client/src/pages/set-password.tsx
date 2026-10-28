import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "../components/public/auth-shell";

type LinkState =
  | { status: "checking" }
  | { status: "ready"; email: string; name: string; organizationName: string }
  | { status: "invalid"; reason: "not_found" | "used" | "expired" | "missing" };

const INVALID_COPY: Record<string, { title: string; body: string }> = {
  expired: { title: "This link has expired", body: "Set-password links last 72 hours. Ask your Distillr administrator to send you a new welcome email." },
  used: { title: "This link was already used", body: "Your password has been set. Sign in with the password you chose." },
  not_found: { title: "This link isn't valid", body: "It may have been replaced by a newer email. Use the most recent welcome email, or ask your administrator to resend it." },
  missing: { title: "No link found", body: "Open the “Set my password” button from your Distillr welcome email." },
};

function strength(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Letters and numbers" },
    { ok: pw.length >= 12, label: "12+ characters (recommended)" },
  ];
}

export default function SetPassword() {
  const [, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return setLink({ status: "invalid", reason: "missing" });
    fetch(`/api/auth/password-setup/${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.valid) setLink({ status: "ready", email: body.email, name: body.name, organizationName: body.organizationName });
        else setLink({ status: "invalid", reason: body.reason ?? "not_found" });
      })
      .catch(() => setLink({ status: "invalid", reason: "not_found" }));
  }, [token]);

  const checks = strength(password);
  const canSubmit = password.length >= 8 && password === confirm && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password-setup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410 && body.reason) setLink({ status: "invalid", reason: body.reason });
        throw new Error(body.error || "Could not set your password");
      }
      toast.success("Password set — sign in to get started");
      navigate("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      panelTitle="Your workspace is ready."
      panelText="Choose a password you'll remember. After this, you'll sign in with your email and this password."
      quote="Batches, barrels, inventory and TTB reports — all in one place, built from the records you already keep."
    >
      {link.status === "checking" && (
        <p className="auth__sub" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
          <Loader2 size={15} className="animate-spin" /> Checking your link…
        </p>
      )}

      {link.status === "invalid" && (
        <>
          <h1>{INVALID_COPY[link.reason].title}</h1>
          <p className="auth__sub">{INVALID_COPY[link.reason].body}</p>
          <Link href="/login" className="pub-btn pub-btn--primary" style={{ width: "100%", borderRadius: 12, height: 46, justifyContent: "center" }}>
            Go to sign in
          </Link>
        </>
      )}

      {link.status === "ready" && (
        <>
          <h1>Set your password</h1>
          <p className="auth__sub">
            For <strong style={{ color: "var(--ink)" }}>{link.email}</strong> at {link.organizationName}.
          </p>
          <form onSubmit={handleSubmit}>
            {error && <div className="auth__error" role="alert">{error}</div>}
            <input type="email" name="username" autoComplete="username" value={link.email} readOnly hidden />
            <div className="auth__field">
              <label className="auth__label" htmlFor="new-password">New password</label>
              <div style={{ position: "relative" }}>
                <input id="new-password" className="auth__input" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus style={{ paddingRight: 44 }} />
                <button type="button" className="auth__eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "-4px 0 16px", display: "grid", gap: 4 }}>
              {checks.map((c) => (
                <li key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.ok ? "#15803D" : "var(--ink-muted)" }}>
                  <Check size={13} style={{ opacity: c.ok ? 1 : 0.35 }} /> {c.label}
                </li>
              ))}
            </ul>
            <div className="auth__field">
              <label className="auth__label" htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" className="auth__input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {confirm && confirm !== password && <p style={{ fontSize: 12, color: "#B91C1C", margin: "6px 0 0" }}>Passwords don't match.</p>}
            </div>
            <button type="submit" className="pub-btn pub-btn--primary" disabled={!canSubmit} style={{ width: "100%", borderRadius: 12, height: 46, opacity: canSubmit ? 1 : 0.6 }}>
              {saving ? (<><Loader2 size={15} className="animate-spin" /> Saving…</>) : "Set password"}
            </button>
          </form>
          <p className="auth__foot">
            Already set it? <Link href="/login">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
