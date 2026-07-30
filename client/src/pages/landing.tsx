import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = "#ededeb";
const GLASS   = "rgba(255,255,255,0.65)";
const GLASS_BD = "rgba(255,255,255,0.9)";
const TEXT    = "#0f0f0f";
const TEXT_2  = "#525252";
const TEXT_3  = "#9a9a9a";

const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: GLASS,
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid ${GLASS_BD}`,
  boxShadow: "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)",
  ...extra,
});

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: light ? "rgba(255,255,255,0.15)" : "#111",
        border: light ? "1px solid rgba(255,255,255,0.3)" : "none",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.0899 14.5 8 14.5C4.9101 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z"
            stroke="white" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
          <path d="M5.5 8.5L7 10L10.5 6.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{
        fontWeight: 700, fontSize: 16,
        color: light ? "#fff" : TEXT,
        letterSpacing: "-0.02em",
      }}>Distillr</span>
    </div>
  );
}

// ─── ProductMockup ────────────────────────────────────────────────────────────
function ProductMockup() {
  const navItems = [
    { label: "Dashboard", active: true },
    { label: "Production", active: false },
    { label: "Barrels", active: false },
    { label: "Inventory", active: false },
    { label: "Compliance", active: false },
    { label: "Sales Orders", active: false },
    { label: "Reports", active: false },
    { label: "Settings", active: false },
  ];

  const metrics = [
    { label: "ACTIVE BATCHES", value: "12", sub: "in pipeline", highlight: true },
    { label: "PROOF GALLONS", value: "4,821", sub: "produced this month" },
    { label: "CASES BOTTLED", value: "386", sub: "this period" },
    { label: "CASES SOLD", value: "214", sub: "fulfilled" },
  ];

  const batches = [
    { code: "WH-2025-047", name: "Wheat Whiskey", badge: "Aging", badgeColor: "#3b82f6", progress: 72 },
    { code: "RY-2025-041", name: "Rye Mash", badge: "Distilling", badgeColor: "#f59e0b", progress: 45 },
    { code: "BO-2025-038", name: "Bourbon Mash", badge: "Fermenting", badgeColor: "#22c55e", progress: 28 },
  ];

  const ttbRows = [
    { label: "Proof Gallons Produced", value: "4,821.3" },
    { label: "Tax-Determined (Bottled)", value: "3,102.7" },
    { label: "Excise Tax Due", value: "$18,616" },
  ];

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 40px 100px rgba(0,0,0,0.22), 0 8px 32px rgba(0,0,0,0.1)",
      border: "1px solid rgba(0,0,0,0.1)",
      fontSize: 12,
    }}>
      {/* Browser chrome */}
      <div style={{
        background: "#e2e2e0", padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 6,
        borderBottom: "1px solid rgba(0,0,0,0.09)",
      }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", flexShrink: 0 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", flexShrink: 0 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", flexShrink: 0 }} />
        <div style={{
          flex: 1, textAlign: "center",
          background: "rgba(0,0,0,0.07)", borderRadius: 5,
          padding: "3px 0", fontSize: 9.5,
          color: "rgba(0,0,0,0.38)", letterSpacing: "0.01em",
          maxWidth: 220, margin: "0 auto",
        }}>
          app.distillr.io
        </div>
      </div>

      {/* App shell */}
      <div style={{ display: "flex", height: 420 }}>

        {/* Sidebar */}
        <div style={{
          width: 200, background: "#0c0c0c",
          display: "flex", flexDirection: "column",
          flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Logo area */}
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 5,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.0899 14.5 8 14.5C4.9101 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z"
                    stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Distillr</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.01em" }}>
              Lugo's Craft Distillery
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding: "8px 0", flex: 1, overflow: "hidden" }}>
            {navItems.map((item) => (
              <div key={item.label} style={{
                padding: "7px 16px",
                display: "flex", alignItems: "center", gap: 9,
                background: item.active ? "rgba(255,255,255,0.07)" : "transparent",
                borderLeft: item.active ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent",
                cursor: "default",
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: item.active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11.5, fontWeight: item.active ? 600 : 400,
                  color: item.active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.38)",
                }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* User */}
          <div style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "#3730a3",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>CL</div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Christian Lugo</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Admin</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top dark section */}
          <div style={{ background: "#0e0e0e", padding: "16px 20px 18px", flexShrink: 0 }}>
            <div style={{
              fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4,
            }}>JULY 2026</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 2 }}>
              Operations Overview
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginBottom: 14 }}>
              Live distillery metrics — batch pipeline, production &amp; compliance
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {metrics.map((card) => (
                <div key={card.label} style={{
                  background: "#1a1a1a",
                  border: card.highlight ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8, padding: "10px 12px",
                  position: "relative", overflow: "hidden",
                }}>
                  {card.highlight && (
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, transparent 100%)",
                    }} />
                  )}
                  <div style={{
                    fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 7,
                  }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: 3 }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.26)" }}>{card.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom light section */}
          <div style={{ background: "#f5f5f3", flex: 1, padding: "14px 18px", display: "flex", gap: 16, overflow: "hidden" }}>

            {/* Batch pipeline */}
            <div style={{ flex: "0 0 60%", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                  color: "#888", textTransform: "uppercase",
                }}>BATCH PIPELINE</span>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {batches.map((batch) => (
                  <div key={batch.code} style={{
                    background: "#fff", borderRadius: 7, padding: "9px 11px",
                    border: "1px solid rgba(0,0,0,0.07)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <div>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: TEXT, marginRight: 5 }}>{batch.code}</span>
                        <span style={{ fontSize: 9, color: TEXT_3 }}>· {batch.name}</span>
                      </div>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                        background: `${batch.badgeColor}18`,
                        color: batch.badgeColor, letterSpacing: "0.04em",
                      }}>{batch.badge}</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${batch.progress}%`,
                        background: batch.badgeColor, borderRadius: 2,
                        opacity: 0.7,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TTB Report */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                  color: "#888", textTransform: "uppercase",
                }}>TTB REPORT · JULY 2025</span>
              </div>
              <div style={{ background: "#fff", borderRadius: 7, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                {ttbRows.map((row, i) => (
                  <div key={row.label} style={{
                    padding: "9px 11px",
                    borderBottom: i < ttbRows.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 9, color: TEXT_3 }}>{row.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEXT }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <button style={{
                marginTop: 10, width: "100%", padding: "7px 0",
                background: "transparent", border: "1px solid rgba(0,0,0,0.14)",
                borderRadius: 6, fontSize: 9.5, fontWeight: 600, color: TEXT_2,
                cursor: "pointer", letterSpacing: "0.01em",
              }}>Export to PONL →</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Check icon ───────────────────────────────────────────────────────────────
function Check({ light = false }: { light?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7.5" cy="7.5" r="7"
        fill={light ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
        stroke={light ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.13)"}
        strokeWidth="1" />
      <path d="M4.5 7.5l2 2 4-4"
        stroke={light ? "#fff" : "#111"}
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Plan data ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter", price: "$149", per: "/mo",
    desc: "For small craft producers getting their operations digital.",
    cta: "Start Free Trial", featured: false,
    features: [
      "3 users",
      "Batch & production tracking",
      "Up to 50 barrels",
      "Basic inventory management",
      "TTB report generation",
      "Email support",
    ],
  },
  {
    name: "Professional", price: "$349", per: "/mo",
    desc: "The complete platform for growing distilleries that need every tool.",
    cta: "Start Free Trial", featured: true,
    features: [
      "15 users",
      "Unlimited batches & barrels",
      "Full TTB compliance engine",
      "All 50-state excise returns",
      "COLA & permit management",
      "Sales order management",
      "AI operations assistant",
      "Priority support",
    ],
  },
  {
    name: "Enterprise", price: "Custom", per: "",
    desc: "Multi-site operations, contract distillers, and high-volume producers.",
    cta: "Contact Sales", featured: false,
    features: [
      "Unlimited users & sites",
      "Multi-distillery management",
      "Custom integrations & API",
      "White-label options",
      "Dedicated account manager",
      "SLA & uptime guarantees",
      "On-site onboarding",
    ],
  },
];

const FAQS = [
  {
    q: "How does Distillr handle TTB compliance?",
    a: "Every production action — mash, distillation, proofing, bottling — is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data. No manual entry, no spreadsheet math.",
  },
  {
    q: "Can I import my existing records?",
    a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries migrate in a single day. Professional and Enterprise plans include hands-on onboarding support.",
  },
  {
    q: "How is my data secured?",
    a: "All data is encrypted in transit and at rest. Every distillery's data is completely isolated — no cross-tenant access. We run on SOC 2-compliant infrastructure with daily backups.",
  },
  {
    q: "Is there a long-term contract?",
    a: "No. All plans are month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime from your settings.",
  },
  {
    q: "Which states are covered for excise returns?",
    a: "All 50 states plus DC. State excise rates are maintained by our team and updated whenever states revise them — no manual rate lookup required.",
  },
];

const FEATURES = [
  {
    title: "TTB Compliance Engine",
    body: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Export to TTB PONL in one click.",
  },
  {
    title: "Batch Production",
    body: "7-stage workflow from mash to bottle with proof gallon tracking and TTB operation tagging at every step.",
  },
  {
    title: "Barrel Intelligence",
    body: "Track every barrel from fill to dump. Angel's share, proof retention, aging milestones, bonded warehouse balance.",
  },
  {
    title: "Inventory & Lots",
    body: "Real-time lot tracking with TTB movement categories, warehouse locations, and full chain of custody.",
  },
  {
    title: "Regulatory Automation",
    body: "COLA registrations, state excise returns for all 50 states, permit renewals — all tracked with deadline alerts.",
  },
  {
    title: "AI Operations Assistant",
    body: "Ask about compliance deadlines, batch status, or barrel inventory in plain English and get instant answers.",
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // shared section wrapper style
  const section = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: "relative", zIndex: 1,
    padding: "120px 48px",
    ...extra,
  });

  const maxW = (w = 1080): React.CSSProperties => ({
    maxWidth: w, margin: "0 auto",
  });

  return (
    <div style={{
      background: BG, color: TEXT,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      overflowX: "hidden", lineHeight: 1.5,
    }}>

      {/* ── Fixed background blobs ──────────────────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-12%", left: "8%",
          width: 760, height: 760, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(205,205,200,0.55) 0%, transparent 70%)",
          filter: "blur(90px)",
        }} />
        <div style={{
          position: "absolute", top: "35%", right: "-8%",
          width: 560, height: 560, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(185,188,200,0.38) 0%, transparent 70%)",
          filter: "blur(80px)",
        }} />
        <div style={{
          position: "absolute", bottom: "8%", left: "-6%",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(215,212,205,0.42) 0%, transparent 70%)",
          filter: "blur(70px)",
        }} />
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        ...glass({
          position: "fixed", top: 0, left: 0, right: 0,
          zIndex: 200,
          borderRadius: 0,
          borderTop: "none", borderLeft: "none", borderRight: "none",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
          boxShadow: scrolled
            ? "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)"
            : "none",
          background: scrolled ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.5)",
        }),
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 44px", height: 64,
        transition: "box-shadow 0.3s, border-color 0.3s, background 0.3s",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, outline: "none" }}
        >
          <Logo />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {[
            { label: "Features", id: "features" },
            { label: "Pricing", id: "pricing" },
            { label: "FAQ", id: "faq" },
          ].map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              style={{ fontSize: 13.5, color: TEXT_2, textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_2)}
            >{n.label}</a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate("/login")}
            style={{
              background: "none", border: "none", cursor: "pointer", outline: "none",
              fontSize: 13.5, fontWeight: 500, color: TEXT_2,
              padding: "8px 16px", borderRadius: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = TEXT;
              e.currentTarget.style.background = "rgba(0,0,0,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = TEXT_2;
              e.currentTarget.style.background = "none";
            }}
          >Sign in</button>
          <button
            onClick={() => navigate("/signup")}
            style={{
              background: "#111", color: "#fff", border: "none", cursor: "pointer", outline: "none",
              fontSize: 13.5, fontWeight: 700, padding: "9px 22px", borderRadius: 9,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >Get Started Free</button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex", alignItems: "center",
        paddingTop: 80,
      }}>
        <div style={{ ...maxW(1100), padding: "0 48px", width: "100%", display: "flex", alignItems: "center", gap: 72 }}>

          {/* Left column — 45% */}
          <div style={{ flex: "0 0 45%", maxWidth: "45%" }}>
            {/* Label */}
            <div style={{ marginBottom: 22 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                color: TEXT_3, textTransform: "uppercase",
              }}>Enterprise Distillery ERP</span>
            </div>

            {/* H1 */}
            <h1 style={{
              fontSize: "clamp(2.6rem,3.8vw,3.8rem)",
              fontWeight: 900,
              letterSpacing: "-0.035em",
              lineHeight: 1.06,
              color: TEXT,
              margin: "0 0 22px",
            }}>
              The operating system<br />
              <span style={{ color: TEXT_2 }}>for craft distilleries.</span>
            </h1>

            {/* Subtext */}
            <p style={{
              fontSize: 15, lineHeight: 1.72, color: TEXT_2,
              margin: "0 0 36px", maxWidth: 440,
            }}>
              From batch to barrel to TTB filing — Distillr gives your entire distillery team a single source of truth, built for how you actually operate.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 10, marginBottom: 36, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/signup")}
                style={{
                  background: "#111", color: "#fff", border: "none", cursor: "pointer", outline: "none",
                  fontSize: 14.5, fontWeight: 700, padding: "13px 30px", borderRadius: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >Start Free Trial</button>
              <button
                onClick={() => {}}
                style={{
                  ...glass({ borderRadius: 10, padding: "13px 26px" }),
                  border: "1px solid rgba(0,0,0,0.12)",
                  cursor: "pointer", outline: "none",
                  fontSize: 14.5, fontWeight: 600, color: TEXT,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)")}
              >Request a Demo</button>
            </div>

            {/* Trust stats */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {[
                "4,800+ Proof Gallons Tracked",
                "50 States Covered",
                "1-Click TTB Filing",
              ].map((stat, i) => (
                <div key={stat} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <div style={{
                      width: 1, height: 28, background: "rgba(0,0,0,0.14)",
                      margin: "0 18px",
                    }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_2 }}>{stat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — 55% with tilted mockup */}
          <div style={{ flex: "0 0 55%", maxWidth: "55%", position: "relative" }}>
            {/* Floating card: top-left */}
            <div style={{
              ...glass({ borderRadius: 12, padding: "12px 16px" }),
              position: "absolute", top: 40, left: -28, zIndex: 10, minWidth: 220,
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_3, marginBottom: 4 }}>TTB Filing</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 2 }}>On Track</div>
              <div style={{ fontSize: 10.5, color: TEXT_2 }}>Form 5110.40 auto-generated</div>
            </div>

            {/* Floating card: bottom-right */}
            <div style={{
              ...glass({ borderRadius: 12, padding: "12px 16px" }),
              position: "absolute", bottom: 80, right: -28, zIndex: 10, minWidth: 210,
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_3, marginBottom: 4 }}>Active Barrels</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 2 }}>147</div>
              <div style={{ fontSize: 10.5, color: TEXT_2 }}>23 due for dump this quarter</div>
            </div>

            {/* Tilted mockup */}
            <div style={{
              transform: "perspective(1400px) rotateY(-10deg) rotateX(4deg) scale(0.96)",
              transformOrigin: "60% 50%",
              position: "relative", zIndex: 5,
            }}>
              <ProductMockup />
            </div>
          </div>

        </div>
      </section>

      {/* ── PROOF BAR ────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{
          ...glass({ borderRadius: 0, borderLeft: "none", borderRight: "none" }),
          padding: "18px 48px",
        }}>
          <div style={{
            ...maxW(1100),
            display: "flex", flexWrap: "wrap",
            justifyContent: "center", alignItems: "center",
            gap: "12px 36px",
          }}>
            {[
              "TTB PONL Compatible",
              "All 50-State Excise Returns",
              "COLA & Label Management",
              "Role-Based Team Access",
              "Real-Time Proof Gallon Accounting",
              "Audit-Ready Record Retention",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check />
                <span style={{ fontSize: 12.5, color: TEXT_2, fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" style={section()}>
        <div style={maxW()}>
          {/* Section heading */}
          <div style={{ marginBottom: 72 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              color: TEXT_3, textTransform: "uppercase", marginBottom: 14,
            }}>PLATFORM CAPABILITIES</p>
            <h2 style={{
              fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800,
              letterSpacing: "-0.026em", color: TEXT, lineHeight: 1.1,
              margin: "0 0 16px",
            }}>Built for every part of your operation.</h2>
            <p style={{ fontSize: 15, color: TEXT_2, lineHeight: 1.72, maxWidth: 560, margin: 0 }}>
              From the still room to the boardroom — every workflow, every report, every compliance deadline in one system.
            </p>
          </div>

          {/* 2×3 feature card grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  ...glass({ borderRadius: 16, padding: "28px 28px" }),
                  cursor: "default",
                  transition: "box-shadow 0.2s, transform 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.08)",
                  marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(0,0,0,0.25)" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.68, color: TEXT_2 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={section({ padding: "100px 48px" })}>
        <div style={maxW(960)}>
          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              color: TEXT_3, textTransform: "uppercase", marginBottom: 14,
            }}>Getting Started</p>
            <h2 style={{
              fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800,
              letterSpacing: "-0.026em", color: TEXT, lineHeight: 1.1, margin: 0,
            }}>Up and running in minutes.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, position: "relative" }}>
            {[
              {
                n: "01",
                title: "Create your account",
                body: "Sign up with your distillery name and email. No credit card, no lengthy form. Your dashboard is ready immediately.",
              },
              {
                n: "02",
                title: "Configure your distillery",
                body: "Enter your DSP number, products, equipment, and team. Import existing data via CSV. Most distilleries are live the same day.",
              },
              {
                n: "03",
                title: "Track, file, and grow",
                body: "Log production in real time. Generate TTB reports in one click. Let Distillr handle compliance so you can focus on craft.",
              },
            ].map((step, i) => (
              <div key={step.n} style={{ position: "relative" }}>
                <div style={{ ...glass({ borderRadius: 18, padding: "32px 28px" }) }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
                    color: TEXT_3, marginBottom: 18,
                  }}>{step.n}</div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, color: TEXT, marginBottom: 10, lineHeight: 1.25 }}>{step.title}</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.7, color: TEXT_2, margin: 0 }}>{step.body}</p>
                </div>
                {i < 2 && (
                  <div style={{
                    position: "absolute", top: "50%", right: -20,
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    ...glass({ borderRadius: "50%", width: 36, height: 36 }),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: TEXT_3,
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={section({ padding: "100px 48px" })}>
        <div style={maxW()}>
          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              color: TEXT_3, textTransform: "uppercase", marginBottom: 14,
            }}>Pricing</p>
            <h2 style={{
              fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800,
              letterSpacing: "-0.026em", color: TEXT, lineHeight: 1.1, margin: "0 0 16px",
            }}>Simple, transparent pricing.</h2>
            <p style={{ fontSize: 15, color: TEXT_2, lineHeight: 1.72, maxWidth: 440, margin: "0 auto" }}>
              Month-to-month, no lock-in. Start free and upgrade when you're ready to scale.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                style={{
                  borderRadius: 20,
                  padding: "36px 30px",
                  position: "relative",
                  ...(plan.featured
                    ? {
                        background: "#111",
                        border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
                      }
                    : glass({})),
                }}
              >
                {plan.featured && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%",
                    transform: "translateX(-50%)",
                    background: "#fff", color: "#111",
                    fontSize: 9.5, fontWeight: 800,
                    padding: "4px 14px", borderRadius: 100,
                    letterSpacing: "0.07em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>Most Popular</div>
                )}

                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: plan.featured ? "rgba(255,255,255,0.4)" : TEXT_3,
                  marginBottom: 14,
                }}>{plan.name}</p>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
                    color: plan.featured ? "#fff" : TEXT,
                  }}>{plan.price}</span>
                  {plan.per && (
                    <span style={{
                      fontSize: 13, marginBottom: 6,
                      color: plan.featured ? "rgba(255,255,255,0.38)" : TEXT_3,
                    }}>{plan.per}</span>
                  )}
                </div>

                <p style={{
                  fontSize: 12.5, lineHeight: 1.65, marginBottom: 24,
                  color: plan.featured ? "rgba(255,255,255,0.44)" : TEXT_2,
                }}>{plan.desc}</p>

                <button
                  onClick={() => navigate("/signup")}
                  style={{
                    width: "100%", padding: "12px 0",
                    borderRadius: 10, fontSize: 13.5, fontWeight: 700,
                    cursor: "pointer", marginBottom: 28, border: "none", outline: "none",
                    ...(plan.featured
                      ? { background: "#fff", color: "#111" }
                      : { background: "#111", color: "#fff" }),
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >{plan.cta}</button>

                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <Check light={plan.featured} />
                      <span style={{
                        fontSize: 12.5,
                        color: plan.featured ? "rgba(255,255,255,0.58)" : TEXT_2,
                      }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 11.5, color: TEXT_3, marginTop: 24 }}>
            All plans include a 14-day free trial. Annual billing available at 20% off.
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" style={section({ padding: "100px 48px" })}>
        <div style={maxW(680)}>
          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              color: TEXT_3, textTransform: "uppercase", marginBottom: 14,
            }}>FAQ</p>
            <h2 style={{
              fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800,
              letterSpacing: "-0.026em", color: TEXT, lineHeight: 1.1, margin: 0,
            }}>Common questions.</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  ...glass({
                    borderRadius: 13,
                    overflow: "hidden",
                    border: openFaq === i ? "1px solid rgba(0,0,0,0.15)" : `1px solid ${GLASS_BD}`,
                  }),
                  transition: "border-color 0.2s",
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "18px 22px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                    background: "none", border: "none", cursor: "pointer", outline: "none",
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: TEXT }}>{faq.q}</span>
                  <span style={{
                    fontSize: 20, color: TEXT_3, flexShrink: 0,
                    display: "block", lineHeight: 1,
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    transition: "transform 0.22s",
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 22px 22px" }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.78, color: TEXT_2, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section style={section({ padding: "80px 48px 120px" })}>
        <div style={maxW(820)}>
          <div style={{
            ...glass({ borderRadius: 24, padding: "80px 60px" }),
            textAlign: "center",
            border: "1px solid rgba(0,0,0,0.09)",
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
              color: TEXT_3, textTransform: "uppercase", marginBottom: 20,
            }}>Start Today</p>
            <h2 style={{
              fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900,
              letterSpacing: "-0.03em", color: TEXT, lineHeight: 1.1, margin: "0 0 20px",
            }}>
              Your distillery deserves<br />better than spreadsheets.
            </h2>
            <p style={{
              fontSize: 15, color: TEXT_2, lineHeight: 1.72,
              maxWidth: 440, margin: "0 auto 36px",
            }}>
              Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected spreadsheets with a single platform.
            </p>
            <button
              onClick={() => navigate("/signup")}
              style={{
                background: "#111", color: "#fff", border: "none", cursor: "pointer", outline: "none",
                fontSize: 15, fontWeight: 700, padding: "14px 44px", borderRadius: 11,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >Start Free Trial</button>
            <p style={{ fontSize: 11.5, color: TEXT_3, marginTop: 14 }}>
              No credit card required · 14-day trial · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{
        position: "relative", zIndex: 1,
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "52px 48px 40px",
      }}>
        <div style={maxW()}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", flexWrap: "wrap", gap: 48, marginBottom: 44,
          }}>
            {/* Brand */}
            <div style={{ maxWidth: 260 }}>
              <div style={{ marginBottom: 14 }}><Logo /></div>
              <p style={{ fontSize: 12.5, lineHeight: 1.72, color: TEXT_3, margin: 0 }}>
                The complete ERP platform for craft distilleries — from grain to glass, batch to barrel, production to TTB filing.
              </p>
            </div>

            {/* Link columns */}
            <div style={{ display: "flex", gap: 64, flexWrap: "wrap" }}>
              {[
                {
                  heading: "Product",
                  links: [
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "#pricing" },
                    { label: "FAQ", href: "#faq" },
                  ],
                },
                {
                  heading: "Account",
                  links: [
                    { label: "Sign in", path: "/login" },
                    { label: "Get Started", path: "/signup" },
                  ],
                },
                {
                  heading: "Compliance",
                  links: [
                    { label: "TTB Forms", href: "#features" },
                    { label: "State Excise", href: "#features" },
                    { label: "COLA & Permits", href: "#features" },
                  ],
                },
              ].map((col) => (
                <div key={col.heading}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: TEXT_3, marginBottom: 16,
                  }}>{col.heading}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {col.links.map((lk) => (
                      "path" in lk ? (
                        <button
                          key={lk.label}
                          onClick={() => navigate((lk as { label: string; path: string }).path)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", outline: "none",
                            fontSize: 13.5, color: TEXT_3, textAlign: "left", padding: 0,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_2)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_3)}
                        >{lk.label}</button>
                      ) : (
                        <a
                          key={lk.label}
                          href={(lk as { label: string; href: string }).href}
                          style={{ fontSize: 13.5, color: TEXT_3, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_2)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_3)}
                        >{lk.label}</a>
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 24,
            display: "flex", justifyContent: "space-between",
            flexWrap: "wrap", gap: 10,
          }}>
            <p style={{ fontSize: 11.5, color: TEXT_3, margin: 0 }}>
              &copy; {new Date().getFullYear()} Distillr. Built for craft distillers.
            </p>
            <p style={{ fontSize: 11.5, color: TEXT_3, margin: 0 }}>
              All data encrypted · SOC 2-compliant infrastructure
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
