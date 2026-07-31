import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CREAM = "#FAF0E2";
const NAVY  = "#0F1B42";
const NAVY2 = "#162050";

const STYLES = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes barrelFloat { 0%,100%{transform:rotate(-1deg) translateY(0)} 50%{transform:rotate(1deg) translateY(-8px)} }

  .sgn-input {
    width: 100%;
    padding: 11px 14px;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    background: rgba(15,27,66,0.05);
    border: 1.5px solid rgba(15,27,66,0.18);
    color: ${NAVY};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  .sgn-input::placeholder { color: rgba(15,27,66,0.35); }
  .sgn-input:focus {
    border-color: rgba(15,27,66,0.55);
    box-shadow: 0 0 0 3px rgba(15,27,66,0.08);
    background: rgba(15,27,66,0.03);
  }

  .sgn-btn {
    width: 100%;
    padding: 13px;
    border-radius: 100px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
    border: none;
    cursor: pointer;
    background: ${NAVY};
    color: #fff;
    transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  .sgn-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(15,27,66,0.32); }
  .sgn-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .sgn-check {
    width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px;
  }

  @media (max-width: 900px) {
    .sgn-left  { display: none !important; }
    .sgn-right { width: 100% !important; }
  }
`;

function BarrelIllustration() {
  const W = 160, H = 210;
  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      style={{ animation: "barrelFloat 7s ease-in-out infinite", display: "block" }}
    >
      <defs>
        <linearGradient id="sb-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1a2d5a" />
          <stop offset="45%"  stopColor="#253870" />
          <stop offset="100%" stopColor="#111f46" />
        </linearGradient>
        <linearGradient id="sb-hoop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#8fa3d0" />
          <stop offset="50%" stopColor="#c8d8f4" />
          <stop offset="100%" stopColor="#6a82b8" />
        </linearGradient>
        <radialGradient id="sb-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%"  stopColor="rgba(200,216,244,0.18)" />
          <stop offset="100%" stopColor="rgba(200,216,244,0)" />
        </radialGradient>
      </defs>

      {/* Glow */}
      <ellipse cx={W/2} cy={H*0.42} rx={W*0.52} ry={H*0.52} fill="url(#sb-glow)" />

      {/* Barrel body */}
      <path
        d={`M${W*0.18},${H*0.14} Q${W*0.06},${H*0.42} ${W*0.18},${H*0.78}
           L${W*0.82},${H*0.78} Q${W*0.94},${H*0.42} ${W*0.82},${H*0.14} Z`}
        fill="url(#sb-body)"
      />

      {/* Stave lines */}
      {[0.34, 0.5, 0.66].map((x) => (
        <line key={x}
          x1={W*x} y1={H*0.16} x2={W*x} y2={H*0.76}
          stroke="rgba(200,216,244,0.1)" strokeWidth="1"
        />
      ))}

      {/* Top cap */}
      <ellipse cx={W/2} cy={H*0.14} rx={W*0.32} ry={H*0.055} fill="#1e3060" stroke="#3a5090" strokeWidth="1" />
      {/* Bottom cap */}
      <ellipse cx={W/2} cy={H*0.78} rx={W*0.32} ry={H*0.055} fill="#182848" stroke="#2e4280" strokeWidth="1" />

      {/* Hoops */}
      {[0.25, 0.46, 0.67].map((yFrac) => (
        <ellipse key={yFrac}
          cx={W/2} cy={H*yFrac}
          rx={W * (0.36 + 0.04 * Math.sin(Math.PI * (yFrac - 0.14) / 0.64))}
          ry={H*0.028}
          fill="url(#sb-hoop)" fillOpacity="0.85"
          stroke="rgba(200,216,244,0.3)" strokeWidth="0.5"
        />
      ))}

      {/* Bung */}
      <ellipse cx={W/2} cy={H*0.46} rx={6} ry={3.5} fill="#2a4070" stroke="#7090c0" strokeWidth="0.8" />
      <ellipse cx={W/2} cy={H*0.46} rx={2.5} ry={1.5} fill="#4070b0" />
    </svg>
  );
}

function WordMark({ color }: { color: string }) {
  return (
    <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 26, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
      Distillr
    </span>
  );
}

function NavyCheck() {
  return (
    <svg className="sgn-check" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill={NAVY} />
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CreamCheck() {
  return (
    <svg className="sgn-check" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(250,240,226,0.15)" />
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Signup() {
  const { signup, user } = useAuth();
  const [, navigate] = useLocation();

  const [distilleryName, setDistilleryName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (distilleryName.trim().length < 2) {
      toast.error("Distillery name must be at least 2 characters");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsPending(true);
    try {
      await signup.mutateAsync({ distilleryName: distilleryName.trim(), adminName: adminName.trim(), email, password });
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      overflowX: "hidden",
    }}>
      <style>{STYLES}</style>

      {/* ── LEFT PANEL — navy ── */}
      <div
        className="sgn-left"
        style={{
          flex: "0 0 52%",
          background: NAVY,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "48px 56px",
        }}
      >
        {/* Stave texture overlay */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={i} x1={`${(i / 17) * 100}%`} y1="0" x2={`${(i / 17) * 100}%`} y2="100%"
              stroke={CREAM} strokeWidth="1" />
          ))}
        </svg>

        {/* Subtle top-right glow */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 340, height: 340,
          background: "radial-gradient(circle, rgba(250,240,226,0.06) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none",
        }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: "auto", animation: "fadeIn 0.6s ease-out both" }}>
          <WordMark color={CREAM} />
        </div>

        {/* Center content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, marginBottom: 40 }}>
          {/* Barrel */}
          <div style={{ animation: "fadeUp 0.7s ease-out 0.1s both" }}>
            <BarrelIllustration />
          </div>

          {/* Headline */}
          <div style={{ textAlign: "center", animation: "fadeUp 0.7s ease-out 0.2s both" }}>
            <h1 style={{
              fontSize: "clamp(1.7rem, 2.8vw, 2.4rem)",
              fontWeight: 800,
              color: CREAM,
              letterSpacing: "-0.03em",
              lineHeight: 1.12,
              marginBottom: 12,
            }}>
              Your distillery,<br />fully connected.
            </h1>
            <p style={{ fontSize: 14, color: "rgba(250,240,226,0.55)", lineHeight: 1.65, maxWidth: 340 }}>
              From grain to glass — batch tracking, TTB compliance, and barrel intelligence in one platform.
            </p>
          </div>

          {/* Feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 340, animation: "fadeUp 0.7s ease-out 0.3s both" }}>
            {[
              "7-stage batch production workflow",
              "TTB Forms 5110.40 & 5000.24 auto-generated",
              "Real-time proof gallon tracking",
              "No credit card required to start",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CreamCheck />
                <span style={{ fontSize: 13.5, color: "rgba(250,240,226,0.75)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          borderTop: `1px solid rgba(250,240,226,0.12)`,
          paddingTop: 24,
          animation: "fadeUp 0.7s ease-out 0.4s both",
        }}>
          {[
            { val: "7-Stage", label: "Production Workflow" },
            { val: "50-State", label: "Excise Coverage" },
            { val: "Real-Time", label: "Proof Gallon Calc" },
          ].map((s, i) => (
            <div key={s.val} style={{
              textAlign: "center",
              padding: "0 12px",
              borderLeft: i > 0 ? `1px solid rgba(250,240,226,0.1)` : "none",
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: CREAM, letterSpacing: "-0.02em" }}>{s.val}</div>
              <div style={{ fontSize: 10.5, color: "rgba(250,240,226,0.4)", marginTop: 3, letterSpacing: "0.02em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — cream ── */}
      <div style={{
        flex: 1,
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 40px",
        position: "relative",
        minHeight: "100vh",
      }}>
        {/* Decorative rings top-right */}
        <div style={{ position: "absolute", top: -60, right: -60, pointerEvents: "none" }}>
          {[200, 280, 360].map((size) => (
            <div key={size} style={{
              position: "absolute",
              width: size, height: size,
              border: `1px solid rgba(15,27,66,${size === 200 ? 0.07 : size === 280 ? 0.05 : 0.03})`,
              borderRadius: "50%",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
            }} />
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>
          {/* Mobile brand */}
          <div className="sgn-left" style={{
            display: "none",
            alignItems: "center", gap: 8, marginBottom: 32,
          }}>
            <WordMark color={NAVY} />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32, animation: "fadeUp 0.6s ease-out both" }}>
            <h2 style={{
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              marginBottom: 10,
            }}>
              Start your<br />free trial.
            </h2>
            <p style={{ fontSize: 14, color: `${NAVY}88`, lineHeight: 1.6 }}>
              Set up your distillery in minutes — no credit card required.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.6s ease-out 0.1s both" }}>

            {/* Distillery name */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: `${NAVY}99`, marginBottom: 6, letterSpacing: "0.02em" }}>
                Distillery name
              </label>
              <input
                className="sgn-input"
                type="text"
                value={distilleryName}
                onChange={(e) => setDistilleryName(e.target.value)}
                placeholder="Copper Ridge Distillery"
                required
                minLength={2}
                autoFocus
              />
            </div>

            {/* Admin name */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: `${NAVY}99`, marginBottom: 6, letterSpacing: "0.02em" }}>
                Your name
              </label>
              <input
                className="sgn-input"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: `${NAVY}99`, marginBottom: 6, letterSpacing: "0.02em" }}>
                Email address
              </label>
              <input
                className="sgn-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@distillery.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: `${NAVY}99`, marginBottom: 6, letterSpacing: "0.02em" }}>
                Password
              </label>
              <input
                className="sgn-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p style={{ fontSize: 11, color: `${NAVY}55`, marginTop: 5 }}>Minimum 8 characters</p>
            </div>

            <button type="submit" disabled={isPending} className="sgn-btn" style={{ marginTop: 4 }}>
              {isPending ? "Creating account…" : "Create free account →"}
            </button>
          </form>

          {/* Trust row */}
          <div style={{
            display: "flex",
            gap: 20,
            marginTop: 24,
            paddingTop: 20,
            borderTop: `1px solid rgba(15,27,66,0.1)`,
            animation: "fadeUp 0.6s ease-out 0.2s both",
          }}>
            {[
              "No credit card",
              "14-day free trial",
              "Cancel anytime",
            ].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <NavyCheck />
                <span style={{ fontSize: 11.5, color: `${NAVY}99`, whiteSpace: "nowrap" }}>{t}</span>
              </div>
            ))}
          </div>

          {/* Sign in link */}
          <p style={{ textAlign: "center", fontSize: 13, color: `${NAVY}77`, marginTop: 32, animation: "fadeUp 0.6s ease-out 0.25s both" }}>
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: NAVY,
                padding: 0,
                borderBottom: `1px solid ${NAVY}`,
                lineHeight: 1.2,
                fontFamily: "inherit",
              }}
            >
              Sign in
            </button>
          </p>

          <p style={{ textAlign: "center", fontSize: 11, color: `${NAVY}44`, marginTop: 20 }}>
            &copy; {new Date().getFullYear()} Distillr — Distillery Technology Platform
          </p>
        </div>
      </div>
    </div>
  );
}
