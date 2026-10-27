import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/use-auth";
import { AuthShell } from "../components/public/auth-shell";

export default function Login() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  return (
    <AuthShell
      panelTitle="Everything from mash to TTB, in one place."
      panelText="Sign in to see today's batches, what's in bond, and what's due — with the reports already built from your records."
      quote="Forms 5110.40 and 5000.24 are generated from the batches you log. No re-keying, no spreadsheets."
    >
      <h1>Welcome back</h1>
      <p className="auth__sub">Sign in to your distillery's workspace.</p>
      <form onSubmit={handleSubmit}>
        <div className="auth__field">
          <label className="auth__label" htmlFor="email">Email</label>
          <input id="email" className="auth__input" type="email" autoComplete="email" placeholder="you@distillery.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="auth__field">
          <label className="auth__label" htmlFor="password">Password</label>
          <div style={{ position: "relative" }}>
            <input id="password" className="auth__input" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 44 }} />
            <button type="button" className="auth__eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
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
      <p className="auth__foot">
        New to Distillr? <Link href="/signup">Request access</Link>
      </p>
      <p className="auth__legal">
        By signing in you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
