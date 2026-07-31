import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CREAM = "#FAF0E2";
const NAVY  = "#0F1B42";
const NAVY2 = "#162050"; // slightly lighter navy for gradients

const STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes barrelFloat {
    0%, 100% { transform: translateY(0px) rotate(-1deg); }
    50%       { transform: translateY(-10px) rotate(1deg); }
  }

  .ln-1 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
  .ln-2 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
  .ln-3 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.26s both; }
  .ln-4 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.38s both; }
  .ln-fi { animation: fadeIn 0.9s ease 0.04s both; }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }

  .ln-root {
    min-height: 100vh;
    display: flex;
    background: ${CREAM};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  }

  /* LEFT */
  .ln-left {
    flex: 0 0 52%;
    background: ${NAVY};
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 48px 56px 52px;
  }

  /* RIGHT */
  .ln-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: ${CREAM};
    padding: 60px 48px;
    position: relative;
  }

  /* Inputs */
  .ln-input {
    width: 100%;
    padding: 14px 18px;
    border-radius: 12px;
    border: 1.5px solid rgba(15,27,66,0.18);
    background: rgba(255,255,255,0.7);
    color: ${NAVY};
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    backdrop-filter: blur(4px);
  }
  .ln-input::placeholder { color: rgba(15,27,66,0.3); }
  .ln-input:focus {
    border-color: ${NAVY};
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15,27,66,0.1);
  }

  /* Sign in button */
  .ln-btn {
    width: 100%;
    padding: 15px;
    border-radius: 100px;
    border: none;
    background: ${NAVY};
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.18s;
  }
  .ln-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 36px rgba(15,27,66,0.28);
  }
  .ln-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .ln-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Feature row on right panel */
  .ln-feat-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  /* Mobile */
  @media (max-width: 767px) {
    .ln-left { display: none !important; }
    .ln-right {
      flex: none !important;
      width: 100% !important;
      min-height: 100vh;
      padding: 40px 24px;
    }
  }
`;

function BarrelIllustration() {
  const W = 200, H = 260;
  const cx = W / 2;
  const rx = 86, topRy = 22, bodyTop = 26, bodyBot = H - 26;
  const hoops = [H * 0.3, H * 0.5, H * 0.7];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      style={{ animation: "barrelFloat 7s ease-in-out infinite", display: "block" }}
    >
      <defs>
        <linearGradient id="barrelBodyGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(250,240,226,0.08)" />
          <stop offset="40%"  stopColor="rgba(250,240,226,0.18)" />
          <stop offset="100%" stopColor="rgba(250,240,226,0.05)" />
        </linearGradient>
        <linearGradient id="hoopGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(250,240,226,0.25)" />
          <stop offset="50%"  stopColor="rgba(250,240,226,0.55)" />
          <stop offset="100%" stopColor="rgba(250,240,226,0.25)" />
        </linearGradient>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(250,240,226,0.08)" />
          <stop offset="100%" stopColor="rgba(250,240,226,0)" />
        </radialGradient>
      </defs>

      {/* Glow behind barrel */}
      <ellipse cx={cx} cy={H / 2} rx={110} ry={130} fill="url(#glowGrad)" />

      {/* Barrel body fill */}
      <path
        d={`M ${cx - rx} ${bodyTop} Q ${cx - rx - 12} ${H / 2} ${cx - rx} ${bodyBot}
            L ${cx + rx} ${bodyBot} Q ${cx + rx + 12} ${H / 2} ${cx + rx} ${bodyTop} Z`}
        fill="url(#barrelBodyGrad)"
      />

      {/* Top ellipse */}
      <ellipse cx={cx} cy={bodyTop} rx={rx} ry={topRy}
        stroke="rgba(250,240,226,0.7)" strokeWidth="1.8" />

      {/* Bottom ellipse */}
      <ellipse cx={cx} cy={bodyBot} rx={rx} ry={topRy}
        stroke="rgba(250,240,226,0.7)" strokeWidth="1.8" />

      {/* Side staves */}
      <line x1={cx - rx} y1={bodyTop} x2={cx - rx} y2={bodyBot}
        stroke="rgba(250,240,226,0.7)" strokeWidth="1.8" />
      <line x1={cx + rx} y1={bodyTop} x2={cx + rx} y2={bodyBot}
        stroke="rgba(250,240,226,0.7)" strokeWidth="1.8" />

      {/* Inner stave lines (belly) */}
      {[-40, -18, 0, 18, 40].map((offset, i) => (
        <line key={i}
          x1={cx + offset} y1={bodyTop + topRy}
          x2={cx + offset} y2={bodyBot - topRy}
          stroke="rgba(250,240,226,0.1)" strokeWidth="1"
        />
      ))}

      {/* Hoops */}
      {hoops.map((y, i) => (
        <ellipse key={i} cx={cx} cy={y} rx={rx + 5} ry={topRy * 0.75}
          stroke="url(#hoopGrad)" strokeWidth={i === 1 ? 3 : 2}
        />
      ))}

      {/* Bung hole */}
      <circle cx={cx} cy={hoops[1]} r={7}
        fill="rgba(250,240,226,0.08)"
        stroke="rgba(250,240,226,0.45)" strokeWidth="1.5"
      />
      <circle cx={cx} cy={hoops[1]} r={2.5}
        fill="rgba(250,240,226,0.4)"
      />

      {/* Top sheen */}
      <ellipse cx={cx - 14} cy={bodyTop} rx={26} ry={topRy * 0.5}
        fill="rgba(250,240,226,0.12)"
      />
    </svg>
  );
}

function WordMark({ color = CREAM }: { color?: string }) {
  return (
    <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 26, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
      Distillr
    </span>
  );
}

function NavyCheckCircle() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: NAVY, flexShrink: 0, marginTop: 2,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5L8 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function CreamCheckCircle() {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: "50%",
      background: "rgba(250,240,226,0.15)",
      border: "1.5px solid rgba(250,240,226,0.5)",
      flexShrink: 0, marginTop: 1,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5L8 2.5" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function Login() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  return (
    <div className="ln-root">
      <style>{STYLES}</style>

      {/* ── LEFT PANEL ── */}
      <div className="ln-left">
        {/* Subtle background texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at 20% 10%, rgba(250,240,226,0.06) 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 80%, rgba(250,240,226,0.04) 0%, transparent 55%)`,
        }} />

        {/* Fine stave lines behind everything */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }} preserveAspectRatio="none">
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={i} x1={`${i * 8}%`} y1="0" x2={`${i * 8}%`} y2="100%"
              stroke={CREAM} strokeWidth="1" />
          ))}
        </svg>

        {/* Brand */}
        <div className="ln-fi" style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 2 }}>
          <WordMark color={CREAM} />
          <span style={{
            marginLeft: 2, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "rgba(250,240,226,0.4)",
            border: "1px solid rgba(250,240,226,0.2)", borderRadius: 100,
            padding: "2px 8px",
          }}>Platform</span>
        </div>

        {/* Barrel illustration — center of panel */}
        <div style={{
          position: "relative", zIndex: 2, flex: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 24, marginBottom: 24,
        }}>
          <BarrelIllustration />
        </div>

        {/* Headline */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="ln-1">
            <h1 style={{
              fontSize: "clamp(1.9rem, 2.6vw, 2.8rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: CREAM,
              marginBottom: 20,
            }}>
              Your distillery,<br />
              <span style={{ color: "rgba(250,240,226,0.55)" }}>fully connected.</span>
            </h1>
          </div>

          {/* Features */}
          <div className="ln-2" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
            {[
              "TTB compliance, fully automated",
              "Live batch & barrel intelligence",
              "All 50-state excise returns",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CreamCheckCircle />
                <span style={{ fontSize: 14, color: "rgba(250,240,226,0.72)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="ln-3" style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {[
              { val: "7-Stage", label: "Production workflow" },
              { val: "TTB Ready", label: "Forms 5110 & 5000" },
              { val: "Real-Time", label: "Barrel & batch data" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "stretch" }}>
                {i > 0 && (
                  <div style={{ width: 1, background: "rgba(250,240,226,0.12)", margin: "0 20px" }} />
                )}
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: CREAM, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>
                    {s.val}
                  </p>
                  <p style={{ fontSize: 10.5, color: "rgba(250,240,226,0.35)", letterSpacing: "0.03em" }}>
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="ln-right">
        {/* Subtle decorative rings top-right */}
        <div style={{
          position: "absolute", top: -60, right: -60, width: 280, height: 280,
          borderRadius: "50%", border: "1px solid rgba(15,27,66,0.07)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -30, right: -30, width: 180, height: 180,
          borderRadius: "50%", border: "1px solid rgba(15,27,66,0.06)",
          pointerEvents: "none",
        }} />

        <div style={{ width: "100%", maxWidth: 360, position: "relative" }}>

          {/* Mobile-only logo */}
          <div style={{ display: "none", alignItems: "center", gap: 8, marginBottom: 32 }}>
            <WordMark color={NAVY} />
          </div>

          {/* Heading */}
          <div className="ln-1">
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "rgba(15,27,66,0.4)",
              marginBottom: 10,
            }}>
              Operations Dashboard
            </p>
            <h2 style={{
              fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.08,
              color: NAVY,
              marginBottom: 8,
            }}>
              Welcome back.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(15,27,66,0.5)", marginBottom: 36, lineHeight: 1.6 }}>
              Sign in to manage your production,<br />compliance, and barrel operations.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="ln-2">
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontSize: 10.5, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(15,27,66,0.45)", marginBottom: 8,
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@distillery.com"
                required
                autoFocus
                className="ln-input"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{
                display: "block", fontSize: 10.5, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(15,27,66,0.45)", marginBottom: 8,
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="ln-input"
                  style={{ paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(15,27,66,0.4)",
                    display: "flex", alignItems: "center", padding: 2,
                  }}
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={login.isPending} className="ln-btn">
              {login.isPending ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: "spin 0.8s linear infinite" }}>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="ln-3" style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(15,27,66,0.1)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(15,27,66,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: 11, color: "rgba(15,27,66,0.32)", letterSpacing: "0.05em" }}>
                256-bit encrypted
              </span>
            </div>
            <div style={{ flex: 1, height: 1, background: "rgba(15,27,66,0.1)" }} />
          </div>

          {/* Platform features */}
          <div className="ln-4" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {[
              "TTB Forms 5110.40 & 5000.24 auto-generation",
              "Multi-stage batch production tracking",
              "Real-time proof gallon & excise calculation",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <NavyCheckCircle />
                <span style={{ fontSize: 12.5, color: "rgba(15,27,66,0.5)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="ln-4" style={{ textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "rgba(15,27,66,0.45)" }}>
              Interested in Distillr?{" "}
              <a
                href="/signup"
                style={{ color: NAVY, fontWeight: 700, textDecoration: "none", borderBottom: `1.5px solid ${NAVY}` }}
              >
                Join the waitlist
              </a>
            </p>
            <p style={{ fontSize: 10.5, color: "rgba(15,27,66,0.25)", marginTop: 12 }}>
              Distillr &copy; {new Date().getFullYear()} &middot; All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
