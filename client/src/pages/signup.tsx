import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { AuthShell } from "../components/public/auth-shell";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function Signup() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", distilleryName: "", state: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/waitlist", { method: "POST", body: JSON.stringify(form) });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Set up in an afternoon. File with confidence."
      panelText="Tell us about your distillery and we'll get you started with a 14-day trial — no credit card, no contract."
      quote="Most distilleries import their batches, barrels and inventory and generate their first TTB report the same day."
    >
      {done ? (
        <>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(79,70,229,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 24 }}>
            <Check size={22} color="#4F46E5" strokeWidth={2.5} />
          </div>
          <h1 style={{ marginTop: 18 }}>You're on the list.</h1>
          <p className="auth__sub">Thanks for your interest in Distillr. We'll be in touch shortly to get you set up.</p>
          <button className="pub-btn pub-btn--ghost" onClick={() => navigate("/")}>
            ← Back to home
          </button>
        </>
      ) : (
        <>
          <p className="pub-eyebrow" style={{ marginTop: 22, marginBottom: 6 }}>Request access</p>
          <h1 style={{ marginTop: 0 }}>Join the waitlist.</h1>
          <p className="auth__sub">Tell us about your distillery and we'll reach out to get you started.</p>
          {error && <div className="auth__error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="auth__row">
              <div className="auth__field">
                <label className="auth__label" htmlFor="name">Your name</label>
                <input id="name" className="auth__input" placeholder="Jane Smith" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="state">State</label>
                <select id="state" className="auth__input" value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select…</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="auth__field">
              <label className="auth__label" htmlFor="email">Work email</label>
              <input id="email" className="auth__input" type="email" placeholder="jane@distillery.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="auth__field">
              <label className="auth__label" htmlFor="distilleryName">Distillery name</label>
              <input id="distilleryName" className="auth__input" placeholder="Your Distillery Co." value={form.distilleryName} onChange={(e) => set("distilleryName", e.target.value)} />
            </div>
            <div className="auth__field">
              <label className="auth__label" htmlFor="message">Anything we should know? <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
              <textarea id="message" className="auth__input" rows={3} placeholder="Current TTB pain points, production volume, tools you use today…" value={form.message} onChange={(e) => set("message", e.target.value)} />
            </div>
            <button type="submit" className="pub-btn pub-btn--primary" disabled={loading} style={{ width: "100%", borderRadius: 12, height: 46 }}>
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Sending…
                </>
              ) : (
                "Request access →"
              )}
            </button>
          </form>
          <p className="auth__foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
          <p className="auth__legal">
            By requesting access you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </>
      )}
    </AuthShell>
  );
}
