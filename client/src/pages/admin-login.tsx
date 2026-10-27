import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "../hooks/use-admin-auth";
import { AuthShell } from "../components/public/auth-shell";

export default function AdminLogin() {
  const { isAdmin, isLoading, login } = useAdminAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!isLoading && isAdmin) navigate("/admin");
  }, [isAdmin, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/admin");
    } catch {
      toast.error("Invalid admin credentials");
    }
  };

  return (
    <AuthShell panelTitle="Platform administration." panelText="Manage organizations, licenses and activity across every Distillr workspace.">
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 22, padding: "4px 10px", borderRadius: 100, background: "rgba(79,70,229,0.1)", color: "#4F46E5", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <ShieldCheck size={12} /> Restricted access
      </div>
      <h1 style={{ marginTop: 12 }}>Distillr admin</h1>
      <p className="auth__sub">Sign in with your platform administrator account.</p>
      <form onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="admin-email">Email</label>
          <input id="admin-email" className="auth__input" type="email" placeholder="admin@distillr.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="auth__field">
          <label className="auth__label" htmlFor="admin-password">Password</label>
          <input id="admin-password" className="auth__input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="pub-btn pub-btn--primary" disabled={login.isPending} style={{ width: "100%", borderRadius: 12, height: 46 }}>
          {login.isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
