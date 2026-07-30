import { useState } from "react";
import { useLocation } from "wouter";

// ─── Design tokens — light gray + glass ──────────────────────────────────────
const BG       = "#efefed";
const GLASS    = "rgba(255,255,255,0.62)";
const GLASS_BD = "rgba(255,255,255,0.85)";
const GLASS_SH = "0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)";
const TEXT     = "#111111";
const TEXT_2   = "#555555";
const TEXT_3   = "#999999";
const INK_BTN  = { background: "#111", color: "#fff" } as const;

const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: GLASS,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${GLASS_BD}`,
  boxShadow: GLASS_SH,
  ...extra,
});

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ dark = true }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: dark ? "#111" : "rgba(255,255,255,0.25)", border: dark ? "none" : "1px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
          <path d="M8 6V10M6 8H10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 16, color: dark ? TEXT : "#fff", letterSpacing: "-0.02em" }}>Distillr</span>
    </div>
  );
}

// ─── Actual product dashboard recreation ─────────────────────────────────────
function ProductMockup() {
  const metrics = [
    { label: "ACTIVE BATCHES", value: "12", sub: "in pipeline", first: true },
    { label: "PROOF GALLONS", value: "4,821", sub: "produced" },
    { label: "CASES BOTTLED", value: "386", sub: "this period" },
    { label: "CASES SOLD", value: "214", sub: "fulfilled" },
  ];
  const prod = [
    { label: "GALLONS DISTILLED", value: "2,104", sub: "US gallons" },
    { label: "PROOF GALLONS", value: "4,821", sub: "at proof" },
    { label: "TOTAL BATCHES", value: "47", sub: "all batches" },
    { label: "SCHEDULED", value: "6", sub: "in planning" },
  ];

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.18)", border: "1px solid rgba(0,0,0,0.08)" }}>
      {/* Browser chrome */}
      <div style={{ background: "#e8e8e6", padding: "9px 14px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <div style={{ margin: "0 auto", background: "rgba(0,0,0,0.07)", borderRadius: 5, padding: "3px 16px", fontSize: 10, color: "rgba(0,0,0,0.35)", letterSpacing: "0.01em" }}>
          app.distillr.io
        </div>
      </div>
      {/* App header */}
      <div style={{ background: "#0a0a0a", padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" fill="none" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Lugo's Craft Distillery</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Powered by Distillr</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>CL</div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Christian Lugo</span>
        </div>
      </div>
      {/* Dark ops section */}
      <div style={{ background: "#0e0e0e", padding: "18px 20px 20px" }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 5 }}>July 2026</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3, letterSpacing: "-0.02em" }}>Operations Overview</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 14 }}>Live distillery metrics — batch pipeline, production & compliance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {metrics.map((c) => (
            <div key={c.label} style={{ background: "#1a1a1a", borderRadius: 8, padding: "11px 12px", border: c.first ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
              {c.first && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, rgba(255,255,255,0.6), transparent)" }} />}
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: 3 }}>{c.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Light section */}
      <div style={{ background: "#f5f5f3", padding: "16px 20px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#555", textTransform: "uppercase", marginBottom: 12 }}>Production</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {prod.map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "11px 12px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.04)", border: "2px solid rgba(0,0,0,0.07)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111", lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 8, color: "#999", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Glassmorphism floating stat card ─────────────────────────────────────────
function FloatCard({ label, value, note, style }: { label: string; value: string; note?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ ...glass({ borderRadius: 12, padding: "13px 17px", minWidth: 155, position: "absolute" }), ...style }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: TEXT_3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1, marginBottom: note ? 3 : 0 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: TEXT_2 }}>{note}</div>}
    </div>
  );
}

// ─── Check ────────────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="7" fill="rgba(0,0,0,0.06)" stroke="rgba(0,0,0,0.14)" strokeWidth="1" />
      <path d="M4.5 7.5l2 2 4-4" stroke="#111" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Plans ────────────────────────────────────────────────────────────────────
const PLANS = [
  { name: "Starter", price: "$149", per: "/mo", desc: "For small craft producers getting their operations digital.", cta: "Start Free Trial", featured: false,
    features: ["3 users", "Batch & production tracking", "Up to 50 barrels", "Basic inventory", "TTB report generation", "Email support"] },
  { name: "Professional", price: "$349", per: "/mo", desc: "The complete platform for growing distilleries.", cta: "Start Free Trial", featured: true,
    features: ["15 users", "Unlimited batches & barrels", "Full TTB compliance engine", "All 50-state excise returns", "COLA & permit management", "Sales order management", "Floor plan & equipment", "AI operations assistant", "Priority support"] },
  { name: "Enterprise", price: "Custom", per: "", desc: "Multi-site operations, contract distillers, high-volume producers.", cta: "Contact Sales", featured: false,
    features: ["Unlimited users & sites", "Multi-distillery management", "Custom integrations & API", "White-label options", "Dedicated account manager", "SLA & uptime guarantees", "On-site onboarding"] },
];

const FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action — mash, distillation, proofing, bottling — is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data. No manual entry, no spreadsheet math." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries migrate in a single day. Professional and Enterprise plans include hands-on onboarding support." },
  { q: "How is my data secured?", a: "All data is encrypted in transit and at rest. Every distillery's data is completely isolated — no cross-tenant access. We run on SOC 2-compliant infrastructure with daily backups." },
  { q: "Is there a long-term contract?", a: "No. All plans are month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime from your settings." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. State excise rates are maintained by our team and updated whenever states revise them — no manual rate lookup required." },
];

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ tag, title, sub, center = false }: { tag: string; title: React.ReactNode; sub?: string; center?: boolean }) {
  return (
    <div style={{ textAlign: center ? "center" : "left", marginBottom: 64 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: TEXT_3, textTransform: "uppercase", marginBottom: 14 }}>{tag}</p>
      <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: TEXT, lineHeight: 1.12, margin: "0 0 16px" }}>{title}</h2>
      {sub && <p style={{ fontSize: 15, color: TEXT_2, lineHeight: 1.7, maxWidth: center ? 480 : 560, margin: center ? "0 auto" : 0 }}>{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  if (typeof window !== "undefined") {
    window.onscroll = () => setScrolled(window.scrollY > 30);
  }

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX: "hidden" }}>

      {/* Background blobs that make glass cards pop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-10%", left: "15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,200,200,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", top: "30%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(180,185,200,0.35) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(210,210,205,0.4) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{ ...glass({ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, borderTop: "none", borderLeft: "none", borderRight: "none", borderRadius: 0, borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent", boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.06)" : "none" }), display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 62, transition: "box-shadow 0.3s, border-color 0.3s" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[{ l: "Features", id: "features" }, { l: "Pricing", id: "pricing" }, { l: "FAQ", id: "faq" }].map((n) => (
            <a key={n.id} href={`#${n.id}`} style={{ fontSize: 13, color: TEXT_2, textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_2)}>{n.l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: TEXT_2, padding: "8px 14px", borderRadius: 8, transition: "color 0.15s, background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = TEXT; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_2; e.currentTarget.style.background = "none"; }}>
            Sign in
          </button>
          <button onClick={() => navigate("/signup")} style={{ ...INK_BTN, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "9px 20px", borderRadius: 8, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: 130, textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          {/* Badge */}
          <div style={{ ...glass({ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 100, padding: "6px 16px", marginBottom: 28 }) }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#333", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_2, letterSpacing: "0.07em", textTransform: "uppercase" }}>Distillery Operations Platform</span>
          </div>

          <h1 style={{ fontSize: "clamp(2.8rem,5.5vw,4.6rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.06, color: TEXT, margin: "0 0 22px" }}>
            Run your distillery<br />
            <span style={{ color: TEXT_3 }}>like a modern operation.</span>
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.7, color: TEXT_2, maxWidth: 560, margin: "0 auto 36px" }}>
            The all-in-one ERP for craft distilleries — TTB compliance, batch intelligence, barrel tracking, and regulatory automation in a single system built for how you actually work.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => navigate("/signup")} style={{ ...INK_BTN, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "14px 32px", borderRadius: 10, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Start Free Trial
            </button>
            <button onClick={() => navigate("/login")} style={{ ...glass({ borderRadius: 10, padding: "14px 28px" }), border: `1px solid rgba(0,0,0,0.12)`, background: GLASS, cursor: "pointer", fontSize: 15, fontWeight: 600, color: TEXT, transition: "box-shadow 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.12)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = GLASS_SH)}>
              Sign in to your account
            </button>
          </div>
          <p style={{ fontSize: 11, color: TEXT_3, marginBottom: 72 }}>No credit card required · Setup in under 5 minutes · Cancel anytime</p>
        </div>

        {/* Product mockup + floating cards */}
        <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
          <FloatCard label="Proof Gallons" value="4,821" note="↑ 18% vs last month" style={{ top: 36, left: -10, zIndex: 10 }} />
          <FloatCard label="TTB Filing" value="On Track" note="Form 5110.40 ready" style={{ top: 44, right: -10, zIndex: 10 }} />
          <FloatCard label="Active Barrels" value="147" note="23 due for dump" style={{ bottom: 120, left: 20, zIndex: 10 }} />
          <FloatCard label="Compliance" value="100%" style={{ bottom: 128, right: 20, zIndex: 10 }} />
          <div style={{ position: "relative", zIndex: 5 }}><ProductMockup /></div>
          {/* Fade bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 180, background: `linear-gradient(transparent, ${BG})`, pointerEvents: "none", zIndex: 20 }} />
        </div>
      </section>

      {/* ── PROOF BAR ────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ ...glass({ borderRadius: 0, borderLeft: "none", borderRight: "none", padding: "18px 40px" }) }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px 40px" }}>
            {["TTB PONL Compatible", "All 50-State Excise Returns", "COLA & Label Management", "Role-Based Team Access", "Real-Time Proof Gallon Accounting", "Audit-Ready Record Retention"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check />
                <span style={{ fontSize: 12, color: TEXT_2, fontWeight: 500 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ position: "relative", zIndex: 1, padding: "120px 40px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <SectionHead tag="Platform" title={<>Everything you need.<br /><span style={{ color: TEXT_3 }}>Nothing you don't.</span></>}
            sub="Distillr replaces the patchwork of spreadsheets, binders, and disconnected tools most distilleries rely on today." />

          {/* Feature rows */}
          {[
            { tag: "TTB Compliance Engine",
              title: "Stop filing by hand. Your data already knows the numbers.",
              body: "Every mash, distillation, and bottling operation you log is automatically tagged with TTB operation codes. When reporting time comes, Forms 5110.40 and 5000.24 are pre-filled from your actual batch data — ready to export to the TTB PONL system in one click.",
              bullets: ["Auto-generates Forms 5110.40 and 5000.24", "One-click export to TTB PONL filing system", "CBMA small-producer excise tax credits", "Federal bonded warehouse balance", "Audit-ready retention 3+ years"],
              stat: "0 hours of manual TTB data entry" },
            { tag: "Batch Production",
              title: "Every stage logged. Every proof gallon accounted for.",
              body: "Follow each batch through a 7-stage production cycle — grain-in to bottle-out — with real-time proof gallon tracking at every transition. Distillr knows what stage each batch is in and automatically logs operations to TTB.",
              bullets: ["7-stage workflow: Mash → Ferment → Distill → Proof → Age → Filter → Bottle", "Proof gallon tracking with automatic TTB tagging", "Link batches to barrels, inventory, and sales orders", "Still logs with ABV, volume, and yield calculations"],
              stat: "7 production stages tracked end-to-end" },
            { tag: "Barrel Intelligence",
              title: "Your warehouse, mapped and monitored.",
              body: "Know exactly what's in every barrel, where it sits, and when to dump it. Distillr tracks angel's share, calculates proof gallon retention, alerts you to aging milestones, and maintains your TTB bonded warehouse balance automatically.",
              bullets: ["Per-barrel tracking from fill to dump", "Angel's share and proof gallon retention", "Warehouse zone and rack location management", "Tasting notes, color, and sample records", "Automated bonded warehouse balance for TTB"],
              stat: "100% barrel accountability" },
          ].map((f, i) => (
            <div key={f.tag} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center", marginBottom: i < 2 ? 96 : 0, direction: i === 1 ? "rtl" : "ltr" }}>
              <div style={{ direction: "ltr" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_3, marginBottom: 14 }}>{f.tag}</p>
                <h3 style={{ fontSize: "clamp(1.5rem,2.2vw,1.9rem)", fontWeight: 800, letterSpacing: "-0.02em", color: TEXT, lineHeight: 1.15, marginBottom: 16 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: TEXT_2, marginBottom: 22 }}>{f.body}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {f.bullets.map((b) => (
                    <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><Check /><span style={{ fontSize: 13, color: TEXT_2 }}>{b}</span></div>
                  ))}
                </div>
              </div>
              <div style={{ direction: "ltr", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ ...glass({ borderRadius: 20, padding: "44px 36px", textAlign: "center", width: "100%", maxWidth: 360 }) }}>
                  <div style={{ fontSize: "3.4rem", fontWeight: 900, color: TEXT, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14 }}>{f.stat.split(" ")[0]}</div>
                  <div style={{ fontSize: 13, color: TEXT_2, lineHeight: 1.5 }}>{f.stat.split(" ").slice(1).join(" ")}</div>
                  <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "24px 0" }} />
                  <div style={{ fontSize: 11, color: TEXT_3, fontStyle: "italic" }}>Built for the TTB. Loved by distillers.</div>
                </div>
              </div>
            </div>
          ))}

          {/* Feature card grid */}
          <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { e: "📦", t: "Inventory Management", d: "Real-time lot tracking with movement history, TTB operation categories, and multi-location warehouse support." },
              { e: "💼", t: "Sales & Distribution", d: "Client accounts, sales orders, line items, and fulfillment tracking alongside your production data." },
              { e: "📑", t: "Regulatory Automation", d: "COLA registrations, state excise returns, permit renewals — all tracked with deadline alerts so nothing lapses." },
              { e: "👥", t: "Team Management", d: "Role-based access for admins, distillers, and staff with full permission granularity." },
              { e: "📊", t: "Reports & Analytics", d: "Production trends, excise summaries, barrel aging curves, inventory valuations, and exportable TTB data." },
              { e: "🤖", t: "AI Assistant", d: "Ask about batch status, barrel inventory, or compliance deadlines in plain English and get instant answers." },
            ].map((f) => (
              <div key={f.t} style={{ ...glass({ borderRadius: 14, padding: "24px 22px" }), cursor: "default", transition: "box-shadow 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 16px 48px rgba(0,0,0,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = GLASS_SH)}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.e}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{f.t}</div>
                <div style={{ fontSize: 12, lineHeight: 1.65, color: TEXT_2 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "100px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <SectionHead tag="Getting Started" title="Up and running in minutes" center />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, position: "relative" }}>
            {[
              { n: "01", t: "Create your account", d: "Sign up with your distillery name and email. No credit card, no lengthy form. Your dashboard is ready immediately." },
              { n: "02", t: "Configure your distillery", d: "Enter your DSP number, products, equipment, and team. Import existing data via CSV. Most distilleries are live the same day." },
              { n: "03", t: "Track, file, and grow", d: "Log production in real time. Generate TTB reports in one click. Let Distillr handle compliance so you can focus on craft." },
            ].map((s, i) => (
              <div key={s.n} style={{ ...glass({ borderRadius: 16, padding: "32px 28px", position: "relative" }) }}>
                {i < 2 && <div style={{ position: "absolute", top: 28, right: -14, zIndex: 2, width: 28, height: 28, borderRadius: "50%", ...glass({ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: TEXT_3 }) }}>→</div>}
                <div style={{ fontSize: 11, fontWeight: 800, color: TEXT_3, letterSpacing: "0.04em", marginBottom: 16 }}>{s.n}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 10 }}>{s.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: TEXT_2, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ position: "relative", zIndex: 1, padding: "100px 40px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <SectionHead tag="Pricing" title="Simple, transparent pricing" sub="Month-to-month, no lock-in. Start free and upgrade when you're ready to scale." center />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{ ...(p.featured ? { background: "#111", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" } : glass({})), borderRadius: 18, padding: "36px 30px", position: "relative", transition: "box-shadow 0.2s" }}>
                {p.featured && <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#111", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Most Popular</div>}
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: p.featured ? "rgba(255,255,255,0.45)" : TEXT_3, marginBottom: 14 }}>{p.name}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: p.featured ? "#fff" : TEXT, lineHeight: 1, letterSpacing: "-0.03em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 13, color: p.featured ? "rgba(255,255,255,0.4)" : TEXT_3, marginBottom: 6 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 12, color: p.featured ? "rgba(255,255,255,0.45)" : TEXT_2, lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button onClick={() => navigate("/signup")} style={{ width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 28, transition: "opacity 0.15s", ...(p.featured ? { background: "#fff", color: "#111", border: "none" } : { ...INK_BTN, border: "none" }) }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                  {p.cta}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      {p.featured
                        ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}><circle cx="7.5" cy="7.5" r="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" /><path d="M4.5 7.5l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <Check />}
                      <span style={{ fontSize: 12, color: p.featured ? "rgba(255,255,255,0.6)" : TEXT_2 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: TEXT_3, marginTop: 24 }}>All plans include a 14-day free trial. Annual billing available at 20% off.</p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ position: "relative", zIndex: 1, padding: "100px 40px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <SectionHead tag="FAQ" title="Common questions" center />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ ...glass({ borderRadius: 12, overflow: "hidden" }), border: openFaq === i ? "1px solid rgba(0,0,0,0.16)" : `1px solid ${GLASS_BD}`, transition: "border-color 0.2s" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: TEXT_3, flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none", display: "block", lineHeight: 1 }}>+</span>
                </button>
                {openFaq === i && <div style={{ padding: "0 22px 20px" }}><p style={{ fontSize: 13, lineHeight: 1.75, color: TEXT_2, margin: 0 }}>{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 40px 120px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ ...glass({ borderRadius: 24, padding: "80px 56px", textAlign: "center" }), border: "1px solid rgba(0,0,0,0.1)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: TEXT_3, marginBottom: 18 }}>Start Today</p>
            <h2 style={{ fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, letterSpacing: "-0.03em", color: TEXT, lineHeight: 1.1, marginBottom: 18 }}>
              Your distillery deserves<br />better than spreadsheets.
            </h2>
            <p style={{ fontSize: 15, color: TEXT_2, maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.7 }}>
              Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected spreadsheets with a single platform.
            </p>
            <button onClick={() => navigate("/signup")} style={{ ...INK_BTN, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "14px 40px", borderRadius: 10, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Start Free Trial — It's Free
            </button>
            <p style={{ fontSize: 11, color: TEXT_3, marginTop: 14 }}>No credit card · 14-day trial · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(0,0,0,0.08)", padding: "48px 40px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 40, marginBottom: 36 }}>
            <div style={{ maxWidth: 260 }}>
              <div style={{ marginBottom: 12 }}><Logo /></div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_3 }}>The complete ERP platform for craft distilleries — from grain to glass, batch to barrel, production to TTB filing.</p>
            </div>
            <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
              {[
                { h: "Product", links: [{ l: "Features", href: "#features" }, { l: "Pricing", href: "#pricing" }, { l: "FAQ", href: "#faq" }] },
                { h: "Account", links: [{ l: "Sign in", path: "/login" }, { l: "Get Started", path: "/signup" }] },
                { h: "Compliance", links: [{ l: "TTB Forms", href: "#features" }, { l: "State Excise", href: "#features" }, { l: "COLA & Permits", href: "#features" }] },
              ].map((col) => (
                <div key={col.h}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_3, marginBottom: 14 }}>{col.h}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.links.map((lk) => (
                      "path" in lk
                        ? <button key={lk.l} onClick={() => navigate(lk.path!)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TEXT_3, textAlign: "left", padding: 0, transition: "color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_2)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_3)}>{lk.l}</button>
                        : <a key={lk.l} href={lk.href} style={{ fontSize: 13, color: TEXT_3, textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_2)} onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_3)}>{lk.l}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <p style={{ fontSize: 11, color: TEXT_3 }}>&copy; {new Date().getFullYear()} Distillr. Built for craft distillers.</p>
            <p style={{ fontSize: 11, color: TEXT_3 }}>All data encrypted · SOC 2-compliant infrastructure</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
