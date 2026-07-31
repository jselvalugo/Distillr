import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "../lib/queryClient";

const CREAM = "#FAF0E2";
const NAVY  = "#0F1B42";
const NAVY2 = "#162050";

const STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }

  .wl-input {
    width: 100%;
    padding: 11px 14px;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    background: rgba(15,27,66,0.04);
    border: 1.5px solid rgba(15,27,66,0.16);
    color: ${NAVY};
    font-family: inherit;
    box-sizing: border-box;
  }
  .wl-input::placeholder { color: rgba(15,27,66,0.32); }
  .wl-input:focus {
    border-color: rgba(15,27,66,0.5);
    box-shadow: 0 0 0 3px rgba(15,27,66,0.07);
    background: rgba(15,27,66,0.02);
  }
  .wl-btn {
    width: 100%;
    padding: 13px;
    border-radius: 100px;
    font-size: 14px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    background: ${NAVY};
    color: #fff;
    transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
    font-family: inherit;
  }
  .wl-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(15,27,66,0.3); }
  .wl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function WordMark({ color }: { color: string }) {
  return (
    <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 26, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
      Distillr
    </span>
  );
}

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
    setForm(f => ({ ...f, [field]: value }));
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
      await apiRequest("/api/waitlist", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}>

        {/* ── Left panel (navy) ── */}
        <div style={{
          width: "45%",
          background: `linear-gradient(160deg, ${NAVY2} 0%, ${NAVY} 100%)`,
          display: "flex",
          flexDirection: "column",
          padding: "48px 52px",
          position: "relative",
          overflow: "hidden",
        }} className="hidden md:flex">

          {/* Subtle grid texture */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04 }} aria-hidden>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>

          {/* Brand */}
          <div style={{ position: "relative", zIndex: 1, animation: "fadeIn 0.6s ease-out both" }}>
            <WordMark color={CREAM} />
          </div>

          {/* Center content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(250,240,226,0.4)", marginBottom: 16, animation: "fadeUp 0.6s ease-out 0.1s both" }}>
              Early Access
            </p>
            <h1 style={{ fontSize: "clamp(1.8rem, 2.8vw, 2.6rem)", fontWeight: 800, color: CREAM, letterSpacing: "-0.035em", lineHeight: 1.12, marginBottom: 20, animation: "fadeUp 0.6s ease-out 0.15s both" }}>
              Built for craft<br />distilleries.
            </h1>
            <p style={{ fontSize: 14, color: "rgba(250,240,226,0.55)", lineHeight: 1.75, maxWidth: 340, marginBottom: 40, animation: "fadeUp 0.6s ease-out 0.2s both" }}>
              TTB compliance, barrel tracking, excise tax automation, and AI-powered operations — all in one platform.
            </p>

            {[
              "Federal TTB reporting (5110.40 & 5000.24)",
              "All 50-state excise tax returns",
              "Barrel & aging intelligence",
              "AI operations assistant with live data",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, animation: `fadeUp 0.6s ease-out ${0.25 + i * 0.05}s both` }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="8" fill="rgba(250,240,226,0.12)"/>
                  <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 13, color: "rgba(250,240,226,0.7)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Bottom tagline */}
          <p style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(250,240,226,0.2)", animation: "fadeIn 0.8s ease-out 0.5s both" }}>
            A Loogo Labs Software
          </p>
        </div>

        {/* ── Right panel (cream) ── */}
        <div style={{
          flex: 1,
          background: CREAM,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
          position: "relative",
          overflowY: "auto",
        }}>

          {/* Mobile brand */}
          <div className="md:hidden" style={{ marginBottom: 32 }}>
            <WordMark color={NAVY} />
          </div>

          <div style={{ width: "100%", maxWidth: 400, animation: "fadeUp 0.5s ease-out both" }}>

            {done ? (
              /* ── Success state ── */
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M6 14l6 6 10-10" stroke={CREAM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: NAVY, letterSpacing: "-0.03em", marginBottom: 12 }}>
                  You're on the list.
                </h2>
                <p style={{ fontSize: 14, color: "rgba(15,27,66,0.55)", lineHeight: 1.7, marginBottom: 32 }}>
                  Thanks for your interest in Distillr. We'll be in touch shortly to get you set up.
                </p>
                <button
                  onClick={() => navigate("/")}
                  style={{ fontSize: 13, color: NAVY, fontWeight: 600, background: "none", border: `1.5px solid rgba(15,27,66,0.2)`, borderRadius: 100, padding: "9px 24px", cursor: "pointer" }}
                >
                  ← Back to home
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(15,27,66,0.4)", marginBottom: 12 }}>
                  Request Access
                </p>
                <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, color: NAVY, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 8 }}>
                  Join the waitlist.
                </h2>
                <p style={{ fontSize: 13.5, color: "rgba(15,27,66,0.5)", lineHeight: 1.65, marginBottom: 32 }}>
                  Tell us about your distillery and we'll reach out to get you started.
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,27,66,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Your Name *</label>
                      <input className="wl-input" placeholder="Jane Smith" value={form.name} onChange={e => set("name", e.target.value)} required />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,27,66,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Email Address *</label>
                    <input className="wl-input" type="email" placeholder="jane@distillery.com" value={form.email} onChange={e => set("email", e.target.value)} required />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,27,66,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Distillery Name</label>
                      <input className="wl-input" placeholder="Lugo's Craft Distillery" value={form.distilleryName} onChange={e => set("distilleryName", e.target.value)} />
                    </div>
                    <div style={{ width: 90 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,27,66,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>State</label>
                      <select className="wl-input" value={form.state} onChange={e => set("state", e.target.value)} style={{ cursor: "pointer" }}>
                        <option value="">—</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(15,27,66,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Anything you'd like us to know?</label>
                    <textarea
                      className="wl-input"
                      placeholder="Current TTB pain points, production volume, tech stack…"
                      value={form.message}
                      onChange={e => set("message", e.target.value)}
                      rows={3}
                      style={{ resize: "vertical", minHeight: 80 }}
                    />
                  </div>

                  {error && (
                    <p style={{ fontSize: 12.5, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
                      {error}
                    </p>
                  )}

                  <button type="submit" className="wl-btn" disabled={loading} style={{ marginTop: 4 }}>
                    {loading ? "Sending…" : "Request Access →"}
                  </button>
                </form>

                <div style={{ marginTop: 28, textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "rgba(15,27,66,0.35)" }}>
                    Already have an account?{" "}
                    <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                      Sign in
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
