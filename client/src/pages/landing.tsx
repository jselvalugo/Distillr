import { useState } from "react";
import { useLocation } from "wouter";

// ─── Colours & tokens ─────────────────────────────────────────────────────────
const GOLD = "#c9952a";
const GOLD_DIM = "rgba(201,149,42,0.18)";
const GOLD_BORDER = "rgba(201,149,42,0.3)";
const TEXT = "#f5f0e8";
const TEXT_DIM = "rgba(245,240,232,0.45)";
const TEXT_FAINT = "rgba(245,240,232,0.22)";
const CARD = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#2a2a2a,#000)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
          <path d="M8 6V10M6 8H10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 17, color: "#fff", letterSpacing: "-0.02em" }}>Distillr</span>
    </div>
  );
}

// ─── Faithful recreation of the actual Distillr dashboard ─────────────────────
function ProductMockup() {
  const metricCards = [
    { label: "ACTIVE BATCHES", value: "12", sub: "in pipeline", accent: true,
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { label: "PROOF GALLONS", value: "4,821", sub: "produced",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(99,179,237,0.8)" strokeWidth="1.5"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/></svg> },
    { label: "CASES BOTTLED", value: "386", sub: "this period",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(104,211,145,0.8)" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg> },
    { label: "CASES SOLD", value: "214", sub: "fulfilled",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(196,181,253,0.8)" strokeWidth="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg> },
  ];

  const prodCards = [
    { label: "GALLONS DISTILLED", value: "2,104", sub: "US gallons" },
    { label: "PROOF GALLONS", value: "4,821", sub: "at proof" },
    { label: "TOTAL BATCHES", value: "47", sub: "all batches" },
    { label: "SCHEDULED BATCHES", value: "6", sub: "in planning" },
  ];

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 48px 120px rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)", maxWidth: 900, margin: "0 auto" }}>
      {/* Browser chrome */}
      <div style={{ background: "#1c1c1e", padding: "9px 14px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <div style={{ margin: "0 auto", background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "2px 14px", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.01em" }}>
          app.distillr.io
        </div>
      </div>

      {/* App top-bar */}
      <div style={{ background: "#0a0a0a", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg,#2a2a2a,#111)", border: "1px solid rgba(201,149,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z" stroke={GOLD} strokeWidth="1.5" strokeLinejoin="round" fill="none" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Lugo's Craft Distillery</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Powered by Distillr — A Loogo Labs Software</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>CL</div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Christian Lugo</span>
        </div>
      </div>

      {/* Dark hero section */}
      <div style={{ background: "#0e0e0e", padding: "20px 22px 22px" }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 6 }}>July 2026</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 3, letterSpacing: "-0.02em" }}>Operations Overview</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Live distillery metrics — batch pipeline, production & compliance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {metricCards.map((c) => (
            <div key={c.label} style={{ background: "#1a1a1a", borderRadius: 8, padding: "12px 14px", border: c.accent ? `1px solid ${GOLD_BORDER}` : "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
              {c.accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${GOLD},transparent)` }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{c.label}</span>
                {c.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Light section */}
      <div style={{ background: "#f5f5f4", padding: "16px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#333", textTransform: "uppercase" }}>Batch Pipeline</span>
            <div style={{ height: 1, width: 40, background: "rgba(0,0,0,0.12)" }} />
          </div>
          <span style={{ fontSize: 9, color: "#888" }}>View all →</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {prodCards.map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.05)", border: "2px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111", lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 8, color: "#999", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Glassmorphism floating stat ──────────────────────────────────────────────
function FloatCard({ style, label, value, trend }: { style?: React.CSSProperties; label: string; value: string; trend?: string }) {
  return (
    <div style={{
      position: "absolute", backdropFilter: "blur(16px)",
      background: "rgba(18,16,14,0.75)", border: "1px solid rgba(201,149,42,0.22)",
      borderRadius: 12, padding: "12px 16px", minWidth: 150,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)", ...style,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: trend ? 4 : 0 }}>{value}</div>
      {trend && <div style={{ fontSize: 9, color: GOLD }}>{trend}</div>}
    </div>
  );
}

// ─── Check mark ───────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="6.5" fill={GOLD_DIM} stroke={GOLD_BORDER} strokeWidth="1" />
      <path d="M4.5 7.5l2 2 4-4" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Plans ────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter", price: "$149", per: "/mo",
    desc: "For small craft producers getting their operations digital.",
    cta: "Start Free Trial", highlight: false,
    features: ["3 users", "Batch & production tracking", "Up to 50 barrels", "Basic inventory", "TTB report generation", "Email support"],
  },
  {
    name: "Professional", price: "$349", per: "/mo",
    desc: "The complete platform for growing distilleries.",
    cta: "Start Free Trial", highlight: true,
    features: ["15 users", "Unlimited batches & barrels", "Full TTB compliance engine", "All 50-state excise returns", "COLA & permit management", "Sales order management", "Floor plan & equipment", "AI operations assistant", "Priority support"],
  },
  {
    name: "Enterprise", price: "Custom", per: "",
    desc: "Multi-site operations, contract distillers, high-volume producers.",
    cta: "Contact Sales", highlight: false,
    features: ["Unlimited users & sites", "Multi-distillery management", "Custom integrations & API", "White-label options", "Dedicated account manager", "SLA & uptime guarantees", "On-site onboarding"],
  },
];

const FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action — mash, distillation, proofing, bottling — is automatically tagged with TTB operation codes. When filing time comes, Forms 5110.40 and 5000.24 are pre-populated from your actual batch data. No manual entry, no spreadsheet math." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries migrate in a day. Professional and Enterprise plans include hands-on onboarding support." },
  { q: "How is my data secured?", a: "All data is encrypted in transit and at rest. Every distillery's data is fully isolated — no cross-tenant access. We run on SOC 2-compliant infrastructure with daily backups." },
  { q: "Is there a long-term contract?", a: "No. All plans are month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. State excise rates are maintained by our team and updated whenever states revise them." },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Track scroll for nav
  if (typeof window !== "undefined") {
    const handler = () => setScrolled(window.scrollY > 30);
    if (!scrolled) window.addEventListener("scroll", handler, { once: false, passive: true });
  }

  const Btn = ({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) => (
    <button onClick={onClick} style={primary ? {
      background: "#fff", color: "#0a0a0a", fontWeight: 700, fontSize: 14,
      padding: "12px 28px", borderRadius: 9, border: "none", cursor: "pointer",
      boxShadow: "0 0 32px rgba(255,255,255,0.15)", transition: "box-shadow 0.2s",
    } : {
      background: "transparent", color: TEXT, fontWeight: 500, fontSize: 14,
      padding: "12px 24px", borderRadius: 9, border: `1px solid ${CARD_BORDER}`, cursor: "pointer",
      transition: "border-color 0.2s, background 0.2s",
    }}
      onMouseEnter={(e) => { if (primary) e.currentTarget.style.boxShadow = "0 0 48px rgba(255,255,255,0.28)"; else { e.currentTarget.style.background = CARD; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; } }}
      onMouseLeave={(e) => { if (primary) e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.15)"; else { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = CARD_BORDER; } }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "#0a0a0a", color: TEXT, minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 64,
        background: scrolled ? "rgba(10,10,10,0.95)" : "rgba(10,10,10,0.6)",
        backdropFilter: "blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Logo />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[{ label: "Features", id: "features" }, { label: "Pricing", id: "pricing" }, { label: "FAQ", id: "faq" }].map((l) => (
            <a key={l.id} href={`#${l.id}`} style={{ fontSize: 13, color: TEXT_DIM, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}>
              {l.label}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TEXT_DIM, padding: "8px 14px", borderRadius: 7, transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_DIM)}>
            Sign in
          </button>
          <button onClick={() => navigate("/signup")} style={{ background: "#fff", color: "#0a0a0a", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 7, boxShadow: "0 0 18px rgba(255,255,255,0.1)", transition: "box-shadow 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 28px rgba(255,255,255,0.22)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 18px rgba(255,255,255,0.1)")}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 0, position: "relative", textAlign: "center", overflow: "hidden" }}>

        {/* Subtle dot-grid texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)`, backgroundSize: "36px 36px", pointerEvents: "none" }} />

        {/* Gold glow */}
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 700, height: 400, background: `radial-gradient(ellipse, ${GOLD_DIM} 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, borderRadius: 100, padding: "5px 14px", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase" }}>Distillery Operations Platform</span>
          </div>

          <h1 style={{ fontSize: "clamp(2.6rem,5.5vw,4.4rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#fff", margin: "0 0 22px" }}>
            Run your distillery<br />
            <span style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #f0c878 45%, ${GOLD} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              like a modern operation.
            </span>
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.65, color: TEXT_DIM, maxWidth: 580, margin: "0 auto 36px" }}>
            Distillr is the all-in-one ERP for craft distilleries — TTB compliance, batch intelligence, barrel tracking, and regulatory automation built for how you actually work.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Btn label="Start Free Trial" onClick={() => navigate("/signup")} primary />
            <Btn label="Sign in to your account" onClick={() => navigate("/login")} />
          </div>
          <p style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 64 }}>No credit card required · Setup in under 5 minutes · Cancel anytime</p>
        </div>

        {/* Product mockup with floating cards */}
        <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto", padding: "0 24px 0" }}>
          {/* Floating cards */}
          <FloatCard label="Proof Gallons Produced" value="4,821" trend="↑ 18% vs last month" style={{ top: 40, left: -10, zIndex: 10 }} />
          <FloatCard label="TTB Filing" value="On Track" trend="Form 5110.40 ready" style={{ top: 50, right: -10, zIndex: 10 }} />
          <FloatCard label="Active Barrels" value="147" trend="23 due for dump" style={{ bottom: 100, left: 20, zIndex: 10 }} />
          <FloatCard label="Compliance Score" value="100%" style={{ bottom: 110, right: 20, zIndex: 10 }} />

          {/* Dashboard */}
          <div style={{ position: "relative", zIndex: 5 }}>
            <ProductMockup />
          </div>

          {/* Fade-out at bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(transparent, #0a0a0a)", pointerEvents: "none", zIndex: 20 }} />
        </div>
      </section>

      {/* ── PROOF BAR ───────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(201,149,42,0.04)", borderTop: `1px solid ${GOLD_BORDER}`, borderBottom: `1px solid ${GOLD_BORDER}`, padding: "20px 40px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px 40px" }}>
          {["TTB PONL Compatible", "All 50-State Excise Returns", "COLA & Label Management", "Role-Based Team Access", "Real-Time Proof Gallon Accounting", "Audit-Ready Record Retention"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check />
              <span style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "120px 40px", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Section header */}
          <div style={{ marginBottom: 70 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>Complete Platform</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
              <h2 style={{ fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", lineHeight: 1.1, margin: 0, maxWidth: 500 }}>
                Everything you need.<br /><span style={{ color: TEXT_DIM }}>Nothing you don't.</span>
              </h2>
              <p style={{ fontSize: 14, color: TEXT_DIM, maxWidth: 380, lineHeight: 1.7, margin: 0 }}>
                Distillr replaces the spreadsheets, binders, and disconnected tools most distilleries rely on — with a single platform that actually talks to itself.
              </p>
            </div>
          </div>

          {/* Large feature rows */}
          {[
            {
              tag: "TTB Compliance Engine",
              title: "Stop filing by hand. Your data already knows the numbers.",
              body: "Every mash, distillation, and bottling operation you log is automatically tagged with TTB operation codes. When reporting time comes, Forms 5110.40 and 5000.24 are pre-filled from your actual batch data — ready to export to the TTB PONL system in one click.",
              bullets: ["Auto-generates Forms 5110.40 and 5000.24", "One-click export to TTB PONL filing system", "CBMA small-producer excise tax credits", "Federal bonded warehouse balance tracking", "Audit-ready records retained 3+ years"],
              stat: { val: "0", label: "Manual data entry required" },
            },
            {
              tag: "Batch Production Tracking",
              title: "Every stage logged. Every proof gallon accounted for.",
              body: "Follow each batch through a 7-stage production cycle — grain-in to bottle-out — with real-time proof gallon tracking at every transition. Distillr knows what stage each batch is in, what's expected next, and automatically logs the move to TTB.",
              bullets: ["7-stage workflow: Mash → Ferment → Distill → Proof → Age → Filter → Bottle", "Proof gallon tracking with automatic TTB tagging", "Link batches to barrels, inventory lots, and sales orders", "Still logs with ABV, volume, and yield calculations"],
              stat: { val: "7", label: "Production stages tracked" },
            },
            {
              tag: "Barrel Intelligence",
              title: "Your warehouse, mapped and monitored.",
              body: "Know exactly what's in every barrel, where it sits, and when to dump it. Distillr tracks angel's share evaporation, calculates proof gallon retention, alerts you to aging milestones, and maintains your TTB bonded warehouse balance automatically.",
              bullets: ["Per-barrel tracking from fill to dump", "Angel's share and proof gallon retention", "Warehouse zone, rack, and location management", "Tasting notes, color, and sample records", "Automated bonded warehouse balance for TTB"],
              stat: { val: "100%", label: "Barrel accountability" },
            },
          ].map((f, i) => (
            <div key={f.tag} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center", marginBottom: i < 2 ? 100 : 0, direction: i === 1 ? "rtl" : "ltr" }}>
              <div style={{ direction: "ltr" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 14 }}>{f.tag}</p>
                <h3 style={{ fontSize: "clamp(1.5rem,2.5vw,2.1rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: TEXT_DIM, marginBottom: 24 }}>{f.body}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {f.bullets.map((b) => (
                    <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Check />
                      <span style={{ fontSize: 13, color: "rgba(245,240,232,0.65)" }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stat card */}
              <div style={{ direction: "ltr", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 380, borderRadius: 20, background: "rgba(255,255,255,0.025)", border: `1px solid ${CARD_BORDER}`, padding: 40, textAlign: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "5rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>{f.stat.val}</div>
                  <div style={{ fontSize: 13, color: TEXT_DIM }}>{f.stat.label}</div>
                  <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD_BORDER}, transparent)`, margin: "24px 0" }} />
                  <div style={{ fontSize: 11, color: TEXT_FAINT, fontStyle: "italic" }}>Built for the TTB. Loved by distillers.</div>
                </div>
              </div>
            </div>
          ))}

          {/* Feature grid */}
          <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { e: "📦", t: "Inventory Management", d: "Real-time lot tracking with movement history, TTB operation categories, and multi-location warehouse support." },
              { e: "💼", t: "Sales & Distribution", d: "Manage client accounts, sales orders, line items, and fulfillment tracking alongside your production data." },
              { e: "📑", t: "Regulatory Automation", d: "COLA registrations, state excise returns, permit renewals — all tracked with deadline alerts so nothing lapses." },
              { e: "👥", t: "Team Management", d: "Role-based access for admins, distillers, and staff. Assign crew, manage permissions with full granularity." },
              { e: "📊", t: "Reports & Analytics", d: "Production trends, excise summaries, barrel aging curves, inventory valuations, and exportable TTB data." },
              { e: "🤖", t: "AI Assistant", d: "Ask about batch status, barrel inventory, or compliance deadlines in plain English. Get instant, data-backed answers." },
            ].map((f) => (
              <div key={f.t} style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: "24px 22px", transition: "border-color 0.2s, background 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = CARD; (e.currentTarget as HTMLElement).style.borderColor = CARD_BORDER; }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.e}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{f.t}</div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: TEXT_DIM }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 40px", background: "rgba(255,255,255,0.012)", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>Getting Started</p>
          <h2 style={{ fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", textAlign: "center", marginBottom: 64 }}>
            Up and running in minutes
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 48, position: "relative" }}>
            {[
              { n: "01", t: "Create your account", d: "Sign up with your distillery name and email. No credit card, no lengthy form. Your operations dashboard is ready immediately." },
              { n: "02", t: "Configure your distillery", d: "Enter your DSP number, products, equipment, and team. Import existing data via CSV. Most distilleries are live the same day." },
              { n: "03", t: "Track, file, and grow", d: "Log production in real time. Generate TTB reports in one click. Let Distillr handle compliance so you can focus on craft." },
            ].map((s, i) => (
              <div key={s.n} style={{ position: "relative" }}>
                {i < 2 && <div style={{ position: "absolute", top: 22, left: "calc(3rem + 10px)", right: "-50%", height: 1, background: `linear-gradient(90deg, ${GOLD_BORDER}, transparent)` }} />}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{s.n}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{s.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: TEXT_DIM }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "120px 40px", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>Pricing</p>
          <h2 style={{ fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", textAlign: "center", marginBottom: 16 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: 14, color: TEXT_DIM, textAlign: "center", marginBottom: 64, maxWidth: 440, margin: "0 auto 64px" }}>
            Month-to-month, no lock-in. Start free and upgrade when you're ready to scale.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "start" }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{
                borderRadius: 18, padding: "36px 32px", position: "relative",
                background: p.highlight ? `linear-gradient(160deg, rgba(201,149,42,0.1), rgba(201,149,42,0.03))` : CARD,
                border: p.highlight ? `1px solid ${GOLD_BORDER}` : `1px solid ${CARD_BORDER}`,
                boxShadow: p.highlight ? `0 0 60px rgba(201,149,42,0.1)` : "none",
              }}>
                {p.highlight && (
                  <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: GOLD, color: "#000", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Most Popular
                  </div>
                )}
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: p.highlight ? GOLD : TEXT_DIM, marginBottom: 12 }}>{p.name}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button onClick={() => navigate("/signup")} style={{
                  width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 28, transition: "all 0.2s",
                  background: p.highlight ? GOLD : "transparent",
                  color: p.highlight ? "#000" : TEXT,
                  border: p.highlight ? "none" : `1px solid ${CARD_BORDER}`,
                  boxShadow: p.highlight ? `0 0 28px rgba(201,149,42,0.35)` : "none",
                }}
                  onMouseEnter={(e) => { if (p.highlight) e.currentTarget.style.boxShadow = `0 0 44px rgba(201,149,42,0.55)`; else { e.currentTarget.style.background = CARD; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; } }}
                  onMouseLeave={(e) => { if (p.highlight) e.currentTarget.style.boxShadow = `0 0 28px rgba(201,149,42,0.35)`; else { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = CARD_BORDER; } }}>
                  {p.cta}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <Check />
                      <span style={{ fontSize: 12, color: "rgba(245,240,232,0.6)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: TEXT_FAINT, marginTop: 28 }}>
            All plans include a 14-day free trial. Annual billing available at 20% off.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "120px 40px", background: "rgba(255,255,255,0.012)", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>FAQ</p>
          <h2 style={{ fontSize: "clamp(2rem,3vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", textAlign: "center", marginBottom: 56 }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${openFaq === i ? GOLD_BORDER : CARD_BORDER}`, background: openFaq === i ? "rgba(201,149,42,0.04)" : CARD, transition: "border-color 0.2s, background 0.2s" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{faq.q}</span>
                  <span style={{ fontSize: 20, color: TEXT_DIM, flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none", display: "block", lineHeight: 1 }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 22px 20px" }}>
                    <p style={{ fontSize: 13, lineHeight: 1.75, color: TEXT_DIM, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ borderRadius: 24, padding: "80px 60px", textAlign: "center", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, rgba(201,149,42,0.1), rgba(201,149,42,0.04) 50%, rgba(201,149,42,0.09))`, border: `1px solid ${GOLD_BORDER}` }}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 200, background: `radial-gradient(ellipse, rgba(201,149,42,0.12) 0%, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase", marginBottom: 20 }}>Start Today</p>
              <h2 style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.08, marginBottom: 20 }}>
                Your distillery deserves<br />better than spreadsheets.
              </h2>
              <p style={{ fontSize: 15, color: TEXT_DIM, maxWidth: 460, margin: "0 auto 40px", lineHeight: 1.7 }}>
                Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected spreadsheets with a single platform.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
                <button onClick={() => navigate("/signup")} style={{ background: "#fff", color: "#0a0a0a", fontSize: 15, fontWeight: 700, padding: "14px 36px", borderRadius: 10, border: "none", cursor: "pointer", boxShadow: "0 0 48px rgba(255,255,255,0.18)", transition: "box-shadow 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 64px rgba(255,255,255,0.32)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 48px rgba(255,255,255,0.18)")}>
                  Start Free Trial
                </button>
              </div>
              <p style={{ fontSize: 11, color: TEXT_FAINT }}>No credit card · 14-day trial · Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${CARD_BORDER}`, padding: "48px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 40, marginBottom: 40 }}>
            <div style={{ maxWidth: 280 }}>
              <div style={{ marginBottom: 14 }}><Logo /></div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_FAINT }}>The complete ERP platform for craft distilleries — from grain to glass, from batch to barrel, from production to TTB filing.</p>
            </div>
            <div style={{ display: "flex", gap: 60, flexWrap: "wrap" }}>
              {[
                { heading: "Product", items: [{ l: "Features", h: "#features" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }] },
                { heading: "Account", items: [{ l: "Sign in", p: "/login" }, { l: "Get Started", p: "/signup" }] },
                { heading: "Compliance", items: [{ l: "TTB Forms", h: "#features" }, { l: "State Excise", h: "#features" }, { l: "COLA & Permits", h: "#features" }] },
              ].map((col) => (
                <div key={col.heading}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(245,240,232,0.55)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>{col.heading}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.items.map((item) => (
                      "p" in item
                        ? <button key={item.l} onClick={() => navigate(item.p!)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TEXT_FAINT, textAlign: "left", transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_DIM)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_FAINT)}>{item.l}</button>
                        : <a key={item.l} href={item.h} style={{ fontSize: 13, color: TEXT_FAINT, textDecoration: "none", transition: "color 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_DIM)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_FAINT)}>{item.l}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <p style={{ fontSize: 11, color: TEXT_FAINT }}>&copy; {new Date().getFullYear()} Distillr. Built for craft distillers.</p>
            <p style={{ fontSize: 11, color: TEXT_FAINT }}>All data encrypted · SOC 2-compliant infrastructure</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
