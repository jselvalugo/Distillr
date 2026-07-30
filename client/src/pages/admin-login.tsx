import { useState, useEffect } from "react";
import { useAdminAuth } from "../hooks/use-admin-auth";
import { useLocation } from "wouter";
import { toast } from "sonner";

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

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f0f0f0", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: 360, padding: "40px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18 }}>

        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="8" width="12" height="7" rx="1.5" stroke="white" strokeWidth="1.4" />
              <path d="M5 8V5.5a3 3 0 016 0V8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="1" fill="white" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Distillr Admin</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>Restricted access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}>
              EMAIL
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@distillr.com" required autoFocus style={inp}
              onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}>
              PASSWORD
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required style={inp}
              onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <button
            type="submit" disabled={login.isPending}
            style={{
              marginTop: 4, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: login.isPending ? "rgba(255,255,255,0.5)" : "#ffffff",
              color: "#080808", border: "none", cursor: login.isPending ? "not-allowed" : "pointer",
              opacity: login.isPending ? 0.7 : 1, transition: "opacity .15s",
            }}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
