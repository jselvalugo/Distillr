import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const CREAM = "#FAF0E2";
const NAVY = "#0F1B42";

const PAGE_STYLES = `
  @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .lnd-btn-primary {
    background: ${NAVY};
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 26px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .lnd-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(15,27,66,0.28); }
  .lnd-btn-outline {
    background: transparent;
    color: ${NAVY};
    border: 1.5px solid ${NAVY};
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 11px 26px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
    line-height: 1;
  }
  .lnd-btn-outline:hover { transform: translateY(-2px); background: rgba(15,27,66,0.06); }
  .lnd-footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
  .lnd-footer-links { display: flex; gap: 28px; }
  @media (max-width: 767px) {
    .lnd-footer-inner { flex-direction: column; align-items: flex-start; gap: 20px; }
    .lnd-footer-links { flex-wrap: wrap; gap: 16px; }
    .feat-row { flex-direction: column !important; }
    .feat-row-reverse { flex-direction: column !important; }
  }
`;

function FooterBarrelMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="7"  rx="9" ry="3.5" stroke={CREAM} strokeWidth="1.6" />
      <ellipse cx="16" cy="25" rx="9" ry="3.5" stroke={CREAM} strokeWidth="1.6" />
      <line x1="7"  y1="7"  x2="7"  y2="25" stroke={CREAM} strokeWidth="1.6" />
      <line x1="25" y1="7"  x2="25" y2="25" stroke={CREAM} strokeWidth="1.6" />
      <ellipse cx="16" cy="13" rx="10" ry="3" stroke={CREAM} strokeOpacity="0.35" strokeWidth="1" />
      <ellipse cx="16" cy="19" rx="10" ry="3" stroke={CREAM} strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

const FEATURES = [
  {
    num: "01",
    title: "TTB Compliance Engine",
    desc: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Export to TTB PONL in one click. Every number is sourced directly from your production records — no manual entry required.",
    bullets: [
      "Form 5110.40 Monthly Report of Production Operations",
      "Form 5000.24 Excise Tax Return with CBMA tier calculation",
      "One-click export to Word/PDF for submission",
    ],
  },
  {
    num: "02",
    title: "Batch Production",
    desc: "A 7-stage production workflow built around TTB operation categories. Track every batch from grain purchase to finished spirit with automatic proof gallon calculations at each stage transition.",
    bullets: [
      "Planning → Mash → Distillation → Barreling → Aging → Bottling → Closed",
      "Proof gallon tracking auto-calculated at each stage",
      "Batch codes and TTB operation tags on every record",
    ],
  },
  {
    num: "03",
    title: "Barrel Intelligence",
    desc: "Track every barrel from fill to dump. Distillr records gauging data, evaporation over time, and proof retention so your bonded warehouse inventory is always accurate and TTB-ready.",
    bullets: [
      "Angel's share evaporation tracking and gauging",
      "Proof retention and aging milestones",
      "Bonded warehouse zone assignment",
    ],
  },
  {
    num: "04",
    title: "Inventory & Lots",
    desc: "Real-time lot tracking across all raw materials, spirits in process, and finished goods. Every movement is categorized for TTB reporting with full chain of custody from receipt to sale.",
    bullets: [
      "TTB movement categories on every transaction",
      "Full chain of custody records",
      "Warehouse location tracking",
    ],
  },
  {
    num: "05",
    title: "Regulatory Automation",
    desc: "Stay ahead of every filing deadline. Distillr tracks COLA registrations, 50-state excise return schedules, and permit renewal dates with automated alerts before anything comes due.",
    bullets: [
      "All 50-state excise return calculations",
      "COLA and label registration tracking",
      "Permit expiration alerts",
    ],
  },
  {
    num: "06",
    title: "AI Operations Assistant",
    desc: "Ask questions about your distillery in plain English. The AI assistant reads your live production data and answers compliance questions with citations so you always know where the answer comes from.",
    bullets: [
      "Reads your live distillery data in real time",
      "Answers TTB compliance questions with citations",
      "Backed by Claude Sonnet AI",
    ],
  },
];

const footerLinks = [
  { l: "Features", h: "/features" },
  { l: "Pricing", h: "/pricing" },
  { l: "FAQ", h: "/faq" },
];

export default function FeaturesPage() {
  const [, navigate] = useLocation();

  return (
    <div style={{
      background: CREAM,
      color: NAVY,
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      overflowX: "hidden",
    }}>
      <style>{PAGE_STYLES}</style>
      <LandingNav />

      {/* ── HERO ── */}
      <section style={{ background: CREAM, padding: "120px 48px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", animation: "fadein 0.7s ease-out both" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: `${NAVY}88`, marginBottom: 18 }}>
            Platform Features
          </p>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3.4rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
            color: NAVY,
            marginBottom: 20,
          }}>
            Everything your distillery needs.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: `${NAVY}99`, marginBottom: 36, maxWidth: 540, margin: "0 auto 36px" }}>
            One platform for production, compliance, and operations — built for licensed Distilled Spirits Plants.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/signup")} className="lnd-btn-primary" style={{ fontSize: 15, padding: "13px 32px" }}>
              Start Free Trial
            </button>
            <button onClick={() => navigate("/pricing")} className="lnd-btn-outline" style={{ fontSize: 15, padding: "13px 28px" }}>
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURE SECTIONS ── */}
      <section style={{ background: CREAM, padding: "0 48px 80px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          {FEATURES.map((f, i) => {
            const isEven = i % 2 === 1;
            return (
              <div
                key={f.num}
                className={isEven ? "feat-row-reverse" : "feat-row"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 64,
                  flexDirection: isEven ? "row-reverse" : "row",
                  padding: "64px 0",
                  borderTop: i === 0 ? "none" : `1px solid rgba(15,27,66,0.1)`,
                }}
              >
                {/* Text side */}
                <div style={{ flex: "0 0 52%", minWidth: 0 }}>
                  <p style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: `${NAVY}44`,
                    marginBottom: 14,
                    textTransform: "uppercase" as const,
                  }}>{f.num}</p>
                  <h2 style={{
                    fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: NAVY,
                    marginBottom: 16,
                    lineHeight: 1.15,
                  }}>{f.title}</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.75, color: `${NAVY}88`, marginBottom: 28 }}>{f.desc}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {f.bullets.map((b) => (
                      <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                          <circle cx="8" cy="8" r="8" fill={`rgba(15,27,66,0.1)`} />
                          <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: 13.5, color: `${NAVY}cc`, lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Number / visual side */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 340,
                    aspectRatio: "4/3",
                    background: `rgba(15,27,66,0.05)`,
                    border: `1.5px solid rgba(15,27,66,0.1)`,
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                  }}>
                    <span style={{
                      fontSize: "clamp(3rem, 8vw, 5.5rem)",
                      fontWeight: 900,
                      color: `rgba(15,27,66,0.08)`,
                      letterSpacing: "-0.05em",
                      lineHeight: 1,
                    }}>{f.num}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: `${NAVY}55`, letterSpacing: "0.02em" }}>{f.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ background: CREAM, padding: "0 48px 80px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{
            background: NAVY,
            borderRadius: 24,
            padding: "72px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              top: "-30%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 500,
              height: 320,
              background: `radial-gradient(ellipse, rgba(250,240,226,0.08) 0%, transparent 70%)`,
              filter: "blur(40px)",
              pointerEvents: "none",
            }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(250,240,226,0.5)", marginBottom: 18, position: "relative", zIndex: 1 }}>
              Start Today
            </p>
            <h2 style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: 16,
              position: "relative",
              zIndex: 1,
            }}>
              Ready to run a compliant distillery?
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 380, margin: "0 auto 32px", lineHeight: 1.7, position: "relative", zIndex: 1 }}>
              No credit card required. Get full access for 14 days.
            </p>
            <button
              onClick={() => navigate("/signup")}
              style={{
                background: CREAM,
                color: NAVY,
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                padding: "14px 40px",
                borderRadius: 100,
                transition: "transform 0.18s, box-shadow 0.18s",
                position: "relative",
                zIndex: 1,
              }}
            >
              Start Free Trial
            </button>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 16, position: "relative", zIndex: 1 }}>
              No credit card · 14-day trial · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: NAVY, padding: "40px 48px" }}>
        <div className="lnd-footer-inner" style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FooterBarrelMark />
            <span style={{ fontWeight: 800, fontSize: 15, color: CREAM, letterSpacing: "-0.03em" }}>Distillr</span>
          </div>
          <div className="lnd-footer-links">
            {footerLinks.map((lk) => (
              <a
                key={lk.l}
                href={lk.h}
                style={{ fontSize: 13, color: "rgba(250,240,226,0.45)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(250,240,226,0.85)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(250,240,226,0.45)")}
              >
                {lk.l}
              </a>
            ))}
            <button
              onClick={() => navigate("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(250,240,226,0.45)", padding: 0, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(250,240,226,0.85)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(250,240,226,0.45)")}
            >
              Sign in
            </button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(250,240,226,0.25)", margin: 0 }}>
            &copy; {new Date().getFullYear()} Distillr
          </p>
        </div>
      </footer>
    </div>
  );
}
