import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const STYLES = `
  @keyframes bar { 0%,100%{transform:scaleY(.25)} 50%{transform:scaleY(1)} }
  @keyframes drift { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-7px)} }
  @keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:.8} }
  @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slidedown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  .nav-link { font-size:13px; color:rgba(255,255,255,0.5); text-decoration:none; transition:color .15s; }
  .nav-link:hover { color:#fff; }
  .btn-ghost:hover { background:rgba(255,255,255,0.09) !important; color:#fff !important; }
  .btn-primary:hover { box-shadow:0 0 32px rgba(255,255,255,0.22) !important; opacity:0.93 !important; }
  .btn-outline:hover { background:rgba(255,255,255,0.09) !important; border-color:rgba(255,255,255,0.28) !important; color:#fff !important; }
  .feature-card:hover { background:rgba(255,255,255,0.09) !important; border-color:rgba(255,255,255,0.16) !important; }
  .faq-item { transition:all .2s; }

  /* ── Responsive ── */
  .nav-links-desktop { display:flex; }
  .nav-ctas-desktop { display:flex; }
  .hamburger-btn { display:none; }
  .hero-nodes { display:block; }
  .feature-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; align-items:start; }
  .hero-ctas { display:flex; justify-content:center; gap:10px; margin-bottom:56px; }
  .section-outer { padding:100px 48px; }
  .cta-inner { padding:72px 48px; }
  .footer-outer { padding:40px 48px; }
  .footer-inner { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:24px; }
  .footer-links { display:flex; gap:28px; }
  .mobile-menu { display:none; }

  @media (max-width: 768px) {
    .nav-links-desktop { display:none !important; }
    .nav-ctas-desktop { display:none !important; }
    .hamburger-btn { display:flex !important; }
    .hero-nodes { display:none !important; }
    .feature-grid { grid-template-columns:1fr !important; }
    .pricing-grid { grid-template-columns:1fr !important; }
    .hero-ctas { flex-direction:column; align-items:stretch; gap:10px; margin-bottom:40px; }
    .hero-ctas button { width:100%; }
    .section-outer { padding:64px 20px !important; }
    .cta-inner { padding:44px 24px !important; border-radius:18px !important; }
    .footer-outer { padding:32px 20px !important; }
    .footer-inner { flex-direction:column; align-items:flex-start; gap:20px; }
    .footer-links { flex-wrap:wrap; gap:16px; }
    .mobile-menu { display:flex !important; }
    .nav-bar { width:calc(100% - 32px) !important; }
  }

  @media (min-width:769px) and (max-width:1024px) {
    .feature-grid { grid-template-columns:repeat(2,1fr) !important; }
    .pricing-grid { grid-template-columns:repeat(2,1fr) !important; }
    .section-outer { padding:80px 32px !important; }
  }
`;

function Node({ label, sub, x, y, delay = 0 }: { label: string; sub?: string; x: string; y: string; delay?: number }) {
  return (
    <div className="hero-nodes" style={{ position: "absolute", left: x, top: y, animation: `drift 5s ease-in-out ${delay}s infinite`, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.55)", flexShrink: 0, animation: `pulse 3s ease-in-out ${delay}s infinite` }} />
        <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>{label}</span>
      </div>
      {sub && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", marginTop: 3, marginLeft: 11 }}>{sub}</div>}
    </div>
  );
}

function Waveform() {
  const bars = [0.4, 0.6, 1, 0.8, 0.5, 0.9, 0.7, 1, 0.6, 0.8, 0.4, 0.7, 0.9, 0.5, 0.6];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48, justifyContent: "center" }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, height: 48 * h, borderRadius: 4,
          background: `rgba(255,255,255,${0.08 + h * 0.09})`,
          animation: `bar ${1.2 + (i % 3) * 0.3}s ease-in-out ${i * 0.08}s infinite`,
          transformOrigin: "bottom",
        }} />
      ))}
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 8.5L7 10L10.5 6.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: "-0.02em" }}>Distillr</span>
    </div>
  );
}

function Check({ featured }: { featured?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7.5" cy="7.5" r="7" fill={featured ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"} />
      <path d="M4.5 7.5l2 2 4-4" stroke={featured ? "#fff" : "rgba(255,255,255,0.55)"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PLANS = [
  { name: "Starter Tier", price: "$99", per: "/mo", desc: "For small craft producers going digital.", featured: false,
    features: ["3 users", "Batch & production tracking", "Up to 50 barrels", "TTB report generation", "Email support"] },
  { name: "Professional Tier", price: "$299", per: "/mo", desc: "The complete platform for growing distilleries.", featured: true,
    features: ["15 users", "Unlimited batches & barrels", "Full TTB compliance engine", "All 50-state excise returns", "COLA & permit management", "AI operations assistant", "Priority support"] },
  { name: "Enterprise", price: "Custom", per: "", desc: "Multi-site operations and high-volume producers.", featured: false,
    features: ["Unlimited users & sites", "Multi-distillery management", "Custom integrations & API", "Dedicated account manager", "On-site onboarding & SLA"] },
];

const FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data — ready to export to the TTB PONL system in one click." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries are fully migrated within a single day." },
  { q: "Is there a long-term contract?", a: "No. Month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. Rates are maintained by our team and updated whenever states revise them." },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close mobile menu on scroll
  useEffect(() => {
    if (mobileMenuOpen) {
      const fn = () => setMobileMenuOpen(false);
      window.addEventListener("scroll", fn, { passive: true, once: true });
      return () => window.removeEventListener("scroll", fn);
    }
  }, [mobileMenuOpen]);

  const D = "rgba(255,255,255,0.05)";
  const DB = "rgba(255,255,255,0.09)";

  const navLinks = [{ l: "Features", h: "#features" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }];

  return (
    <div style={{ background: "#070707", color: "#fff", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX: "hidden" }}>
      <style>{STYLES}</style>

      {/* ── NAV ────────────────────────────────────────────────────────────────── */}
      <nav className="nav-bar" style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
        width: "calc(100% - 64px)", maxWidth: 960,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6px 0 16px", height: 50,
        background: scrolled ? "rgba(10,10,10,0.88)" : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14,
        transition: "background 0.3s, box-shadow 0.3s",
        boxShadow: scrolled ? "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)" : "0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 24 }}>
          <Logo />
        </button>

        {/* Desktop nav links */}
        <div className="nav-links-desktop" style={{ gap: 4, flex: 1 }}>
          {navLinks.map((n) => (
            <a key={n.l} href={n.h} className="nav-link" style={{ padding: "6px 12px", borderRadius: 8 }}>{n.l}</a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-ctas-desktop" style={{ gap: 6, alignItems: "center" }}>
          <button onClick={() => navigate("/login")} className="btn-ghost" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)", padding: "7px 16px", borderRadius: 9, transition: "all .15s", lineHeight: 1 }}>
            Sign in
          </button>
          <button onClick={() => navigate("/signup")} className="btn-primary" style={{ background: "#ffffff", color: "#070707", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 9, transition: "all .2s", lineHeight: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08), 0 0 16px rgba(255,255,255,0.06)" }}>
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", padding: "7px 10px", borderRadius: 9, alignItems: "center", justifyContent: "center", gap: 4, flexDirection: "column" }}
        >
          <span style={{ display: "block", width: 18, height: 1.5, background: "#fff", borderRadius: 2, transition: "transform .2s, opacity .2s", transform: mobileMenuOpen ? "translateY(3.5px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: 18, height: 1.5, background: "#fff", borderRadius: 2, transition: "opacity .2s", opacity: mobileMenuOpen ? 0 : 1 }} />
          <span style={{ display: "block", width: 18, height: 1.5, background: "#fff", borderRadius: 2, transition: "transform .2s, opacity .2s", transform: mobileMenuOpen ? "translateY(-3.5px) rotate(-45deg)" : "none" }} />
        </button>
      </nav>

      {/* ── MOBILE MENU ────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="mobile-menu" style={{
          position: "fixed", top: 78, left: 16, right: 16, zIndex: 99,
          background: "rgba(10,10,10,0.96)", backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
          flexDirection: "column", padding: "8px 8px 12px",
          animation: "slidedown 0.18s ease-out both",
          boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        }}>
          {navLinks.map((n) => (
            <a key={n.l} href={n.h} className="nav-link" onClick={() => setMobileMenuOpen(false)}
              style={{ display: "block", padding: "13px 16px", borderRadius: 10, fontSize: 15, fontWeight: 500 }}>
              {n.l}
            </a>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 8px" }} />
          <button onClick={() => { navigate("/login"); setMobileMenuOpen(false); }} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: "left" }}>
            Sign in
          </button>
          <button onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }} className="btn-primary" style={{ width: "100%", padding: "13px 16px", borderRadius: 10, background: "#fff", border: "none", color: "#070707", cursor: "pointer", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
            Get Started Free →
          </button>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 700, background: "radial-gradient(ellipse, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 60%)" }} />
        </div>

        <Node label="Batch WH-2025-047" sub="Wheat Whiskey · Aging stage" x="5%" y="22%" delay={0} />
        <Node label="4,821 Proof Gallons" sub="produced this month" x="68%" y="18%" delay={0.8} />
        <Node label="TTB Filing · Ready" sub="Form 5110.40 auto-generated" x="4%" y="52%" delay={1.4} />
        <Node label="147 Barrels Aging" sub="bonded warehouse A & B" x="72%" y="50%" delay={0.4} />
        <Node label="Compliance · 100%" sub="no outstanding deadlines" x="8%" y="76%" delay={1.8} />
        <Node label="Excise Due · $18,616" sub="July 2026 · TTB PONL" x="66%" y="78%" delay={1.0} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 680, padding: "0 24px", animation: "fadein 0.8s ease-out both", width: "100%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, padding: "5px 14px 5px 8px", marginBottom: 28 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><circle cx="4" cy="4" r="3" /></svg>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em" }}>Real-time Distillery Operations</span>
          </div>

          <h1 style={{ fontSize: "clamp(2.2rem,6vw,4.2rem)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#fff", margin: "0 0 18px" }}>
            One system for every<br />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>stage of production.</span>
          </h1>

          <p style={{ fontSize: "clamp(14px,3vw,16px)", lineHeight: 1.7, color: "rgba(255,255,255,0.45)", margin: "0 auto 32px", maxWidth: 520 }}>
            From grain to glass — batch tracking, TTB compliance, barrel intelligence, and regulatory automation built for craft distillers.
          </p>

          <div className="hero-ctas">
            <button onClick={() => navigate("/signup")} className="btn-primary" style={{ background: "#ffffff", color: "#070707", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "13px 32px", borderRadius: 11, transition: "all .2s", boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1), 0 0 24px rgba(255,255,255,0.1)" }}>
              Start Free Trial
            </button>
            <button onClick={() => navigate("/login")} className="btn-outline" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 15, fontWeight: 500, padding: "13px 28px", borderRadius: 11, transition: "all .2s" }}>
              Sign In →
            </button>
          </div>

          <Waveform />
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────────── */}
      <section id="features" className="section-outer" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Platform</p>
            <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", marginBottom: 14 }}>Built for every part of your operation.</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>Every workflow, every compliance deadline, every TTB report — in one system that actually talks to itself.</p>
          </div>
          <div className="feature-grid">
            {[
              { n: "01", t: "TTB Compliance Engine", d: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Export to TTB PONL in one click. CBMA credits included." },
              { n: "02", t: "Batch Production", d: "7-stage workflow from mash to bottle with proof gallon tracking and TTB operation tagging at every transition." },
              { n: "03", t: "Barrel Intelligence", d: "Track every barrel from fill to dump. Angel's share, proof retention, aging milestones, and bonded warehouse balance." },
              { n: "04", t: "Inventory & Lots", d: "Real-time lot tracking with TTB movement categories, warehouse locations, and full chain of custody records." },
              { n: "05", t: "Regulatory Automation", d: "COLA registrations, all 50-state excise returns, permit renewals — tracked with deadline alerts." },
              { n: "06", t: "AI Assistant", d: "Ask about compliance deadlines, batch status, or barrel inventory in plain English and get instant data-backed answers." },
            ].map((f) => (
              <div key={f.n} className="feature-card" style={{ background: D, border: `1px solid ${DB}`, borderRadius: 14, padding: "26px 24px", cursor: "default" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", marginBottom: 12 }}>{f.n}</p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 9 }}>{f.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.4)", margin: 0 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="section-outer" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Pricing</p>
            <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", marginBottom: 12 }}>Simple, transparent pricing.</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Month-to-month. No lock-in. 14-day free trial on all plans.</p>
          </div>
          <div className="pricing-grid">
            {PLANS.map((p) => (
              <div key={p.name} style={{ borderRadius: 18, padding: "34px 28px", position: "relative", background: p.featured ? "rgba(255,255,255,0.08)" : D, border: p.featured ? "1px solid rgba(255,255,255,0.18)" : `1px solid ${DB}`, boxShadow: p.featured ? "0 0 80px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.1)" : "none" }}>
                {p.featured && (
                  <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#070707", fontSize: 9.5, fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
                    Most Popular
                  </div>
                )}
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: p.featured ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)", marginBottom: 16 }}>{p.name}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 8 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.04em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button onClick={() => navigate("/signup")} className={p.featured ? "btn-primary" : "btn-outline"} style={{ width: "100%", padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 24, transition: "all .2s", background: p.featured ? "#ffffff" : "transparent", color: p.featured ? "#070707" : "rgba(255,255,255,0.7)", border: p.featured ? "none" : "1px solid rgba(255,255,255,0.15)", boxShadow: p.featured ? "0 2px 8px rgba(0,0,0,0.4), 0 0 24px rgba(255,255,255,0.08)" : "none" }}>
                  {p.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <Check featured={p.featured} />
                      <span style={{ fontSize: 12.5, color: p.featured ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────────── */}
      <section id="faq" className="section-outer" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff" }}>Common questions.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item" style={{ borderRadius: 12, border: `1px solid ${openFaq === i ? "rgba(255,255,255,0.15)" : DB}`, background: openFaq === i ? "rgba(255,255,255,0.05)" : D, overflow: "hidden" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "17px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", flexShrink: 0, transition: "transform .2s", transform: openFaq === i ? "rotate(45deg)" : "none", lineHeight: 1, display: "block" }}>+</span>
                </button>
                {openFaq === i && <div style={{ padding: "0 20px 18px" }}><p style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.45)", margin: 0 }}>{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────────── */}
      <section className="section-outer" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: 120 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div className="cta-inner" style={{ position: "relative", overflow: "hidden", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
            <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>Start Today</p>
            <h2 style={{ fontSize: "clamp(1.6rem,4vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>
              Your distillery deserves<br />better than spreadsheets.
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.7 }}>
              Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected tools with one platform.
            </p>
            <button onClick={() => navigate("/signup")} className="btn-primary" style={{ background: "#ffffff", color: "#070707", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "14px 40px", borderRadius: 11, transition: "all .2s", boxShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1), 0 0 32px rgba(255,255,255,0.1)" }}>
              Start Free Trial
            </button>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 14 }}>No credit card · 14-day trial · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer className="footer-outer" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="footer-inner" style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Logo />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: 0 }}>Built for craft distillers.</p>
          </div>
          <div className="footer-links">
            {navLinks.map((lk) => (
              <a key={lk.l} href={lk.h} className="nav-link" style={{ fontSize: 12 }}>{lk.l}</a>
            ))}
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.25)", padding: 0, transition: "color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>Sign in</button>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", margin: 0 }}>&copy; {new Date().getFullYear()} Distillr</p>
        </div>
      </footer>
    </div>
  );
}
