import { useState } from "react";
import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const WHITE = "#ffffff";
const BLACK = "#000000";
const OFF   = "#0a0a0a";

const PLANS = [
  {
    name: "Starter Tier",
    price: "$99",
    per: "/mo",
    desc: "For small craft producers going digital.",
    featured: false,
    features: ["1 user", "Batch & production tracking", "Up to 50 barrels", "TTB report generation", "Email support"],
  },
  {
    name: "Professional Tier",
    price: "$299",
    per: "/mo",
    desc: "The complete platform for growing distilleries.",
    featured: true,
    features: ["2–15 users", "Unlimited batches & barrels", "Full TTB compliance engine", "All 50-state excise returns", "COLA & permit management", "AI operations assistant", "Priority support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    desc: "Multi-site operations and high-volume producers.",
    featured: false,
    features: ["Unlimited users & sites", "Multi-distillery management", "Custom integrations & API", "Dedicated account manager", "On-site onboarding & SLA"],
  },
];

const FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data — ready to export to the TTB PONL system in one click." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries are fully migrated within a single day." },
  { q: "Is there a long-term contract?", a: "No. Month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. Rates are maintained by our team and updated whenever states revise them." },
];

const STYLES = `
  @keyframes fadein    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slidedown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes floatUp   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes scanline  { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .lnd-hero-gradient-text {
    background: linear-gradient(
      110deg,
      #ffffff 0%,
      #c8c8c8 20%,
      #ffffff 35%,
      #8a8a8a 50%,
      #ffffff 65%,
      #c8c8c8 80%,
      #ffffff 100%
    );
    background-size: 250% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 6s linear infinite;
  }

  .lnd-hero-gradient-span {
    background: linear-gradient(
      110deg,
      #ffffff 0%,
      #a0a0a0 30%,
      #ffffff 50%,
      #606060 70%,
      #ffffff 100%
    );
    background-size: 300% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .lnd-nav-link {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .lnd-nav-link:hover { background: rgba(255,255,255,0.07); color: #fff; }

  .lnd-btn-primary {
    background: ${WHITE};
    color: ${BLACK};
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 26px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .lnd-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(255,255,255,0.25); background: #e8e8e8; }

  .lnd-btn-outline {
    background: transparent;
    color: rgba(255,255,255,0.7);
    border: 1.5px solid rgba(255,255,255,0.22);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    padding: 11px 26px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s, background 0.18s, border-color 0.18s, color 0.18s;
    line-height: 1;
    backdrop-filter: blur(8px);
  }
  .lnd-btn-outline:hover { transform: translateY(-2px); background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.4); color: #fff; }

  .lnd-btn-signin {
    background: transparent;
    color: rgba(255,255,255,0.5);
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 8px;
    transition: background 0.15s, color 0.15s;
    line-height: 1;
  }
  .lnd-btn-signin:hover { background: rgba(255,255,255,0.07); color: #fff; }

  .lnd-btn-getstarted {
    background: ${WHITE};
    color: ${BLACK};
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    padding: 9px 20px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s;
    line-height: 1;
  }
  .lnd-btn-getstarted:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(255,255,255,0.2); }

  .lnd-feature-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 28px 24px;
    transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    cursor: default;
    backdrop-filter: blur(12px);
  }
  .lnd-feature-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.16);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(255,255,255,0.04);
  }

  .lnd-faq-btn {
    width: 100%;
    text-align: left;
    padding: 18px 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    background: none;
    border: none;
    cursor: pointer;
  }

  .lnd-plan-btn {
    width: 100%;
    padding: 12px;
    border-radius: 100px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-bottom: 24px;
    transition: transform 0.18s, box-shadow 0.18s;
  }
  .lnd-plan-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,255,255,0.15); }

  /* Responsive */
  .lnd-nav-links { display: flex; align-items: center; }
  .lnd-nav-ctas  { display: flex; align-items: center; gap: 4px; }
  .lnd-hamburger { display: none; }
  .lnd-mobile-menu { display: none; }

  .lnd-hero-inner {
    display: flex;
    align-items: center;
    gap: 48px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 48px;
    min-height: 100vh;
    padding-top: 80px;
    padding-bottom: 60px;
  }
  .lnd-hero-left  { flex: 0 0 55%; min-width: 0; }
  .lnd-hero-right { flex: 0 0 45%; min-width: 0; }

  .lnd-what-inner {
    display: flex;
    align-items: center;
    gap: 56px;
    max-width: 1060px;
    margin: 0 auto;
    padding: 80px 48px;
  }
  .lnd-what-left  { flex: 0 0 48%; min-width: 0; }
  .lnd-what-right { flex: 1; min-width: 0; }

  .lnd-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lnd-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: start; }

  .lnd-section-pad { padding: 80px 48px; }
  .lnd-footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
  .lnd-footer-links { display: flex; gap: 28px; }

  @media (max-width: 767px) {
    .lnd-nav-links { display: none !important; }
    .lnd-nav-ctas  { display: none !important; }
    .lnd-hamburger { display: flex !important; }
    .lnd-mobile-menu { display: flex !important; }

    .lnd-hero-inner {
      flex-direction: column;
      padding: 100px 20px 48px;
      min-height: auto;
      gap: 32px;
    }
    .lnd-hero-left  { flex: none; width: 100%; }
    .lnd-hero-right { flex: none; width: 100%; }

    .lnd-what-inner {
      flex-direction: column;
      padding: 60px 20px;
      gap: 36px;
    }
    .lnd-what-left  { flex: none; width: 100%; }
    .lnd-what-right { flex: none; width: 100%; }

    .lnd-feature-grid { grid-template-columns: 1fr !important; }
    .lnd-pricing-grid { grid-template-columns: 1fr !important; }
    .lnd-section-pad  { padding: 60px 20px !important; }
    .lnd-footer-inner { flex-direction: column; align-items: flex-start; gap: 20px; }
    .lnd-footer-links { flex-wrap: wrap; gap: 16px; }
  }

  @media (min-width: 768px) and (max-width: 1024px) {
    .lnd-feature-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .lnd-pricing-grid { grid-template-columns: 1fr !important; }
    .lnd-hero-inner   { padding: 100px 32px 60px; gap: 32px; }
    .lnd-what-inner   { padding: 60px 32px; gap: 36px; }
    .lnd-section-pad  { padding: 70px 32px !important; }
  }
`;

function FooterBarrelMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="7"  rx="9" ry="3.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" />
      <ellipse cx="16" cy="25" rx="9" ry="3.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" />
      <line x1="7"  y1="7"  x2="7"  y2="25" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" />
      <line x1="25" y1="7"  x2="25" y2="25" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" />
      <ellipse cx="16" cy="13" rx="10" ry="3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <ellipse cx="16" cy="19" rx="10" ry="3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  );
}

function CreamCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="9" cy="9" r="9" fill="rgba(255,255,255,0.08)" />
      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingCheck({ featured }: { featured: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={featured ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)"} />
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={featured ? "#000" : "rgba(255,255,255,0.7)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const footerLinks = [
  { l: "Features", h: "/features" },
  { l: "Pricing",  h: "/pricing" },
  { l: "FAQ",      h: "/faq" },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{
      background: BLACK,
      color: WHITE,
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      overflowX: "hidden",
    }}>
      <style>{STYLES}</style>

      <LandingNav />

      {/* ── HERO SECTION ── */}
      <section style={{ background: BLACK, position: "relative", overflow: "hidden" }}>

        {/* Futuristic background aura */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-20%", left: "30%", width: 700, height: 500, background: "radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 65%)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", bottom: 0, right: "10%", width: 400, height: 300, background: "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)", filter: "blur(50px)" }} />
          {/* Subtle grid lines */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }} />
        </div>

        <div className="lnd-hero-inner" style={{ position: "relative", zIndex: 1 }}>

          {/* Left column */}
          <div className="lnd-hero-left" style={{ animation: "fadein 0.7s ease-out both" }}>
            {/* Label badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 100,
              padding: "5px 14px 5px 8px",
              marginBottom: 28,
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: WHITE }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.03em" }}>Distillery Operations Platform</span>
            </div>

            {/* Headline — glass gradient shimmer */}
            <h1 className="lnd-hero-gradient-text" style={{
              fontSize: "clamp(2.4rem, 4.5vw, 3.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.08,
              marginBottom: 22,
            }}>
              The modern ERP for{" "}
              <span className="lnd-hero-gradient-span" style={{ display: "inline" }}>
                craft spirits
              </span>
              <br />
              producers.
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 36,
              maxWidth: 480,
            }}>
              From grain to glass — batch tracking, TTB compliance, barrel intelligence, and regulatory automation built for craft distillers.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <button
                onClick={() => navigate("/signup")}
                className="lnd-btn-primary"
                style={{ fontSize: 15, padding: "13px 32px" }}
              >
                Request Access
              </button>
              <button
                onClick={() => navigate("/login")}
                className="lnd-btn-outline"
                style={{ fontSize: 15, padding: "13px 28px" }}
              >
                Sign In →
              </button>
            </div>

            {/* Social proof micro-line */}
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", letterSpacing: "0.01em" }}>
              ✓ No credit card required &nbsp;·&nbsp; 14-day free trial
            </p>
          </div>

          {/* Right column — screenshot */}
          <div className="lnd-hero-right" style={{ position: "relative" }}>
            {/* Screenshot frame */}
            <div style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
              overflow: "hidden",
              position: "relative",
              backdropFilter: "blur(12px)",
            }}>
              {/* Browser chrome bar */}
              <div style={{
                background: "rgba(255,255,255,0.05)",
                padding: "9px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
                </div>
                <div style={{
                  flex: 1,
                  maxWidth: 280,
                  margin: "0 auto",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 5,
                  padding: "3px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.01em" }}>app.distillr.io/dashboard</span>
                </div>
              </div>
              <img
                src="/dashboard-screenshot.png"
                alt="Distillr Operations Dashboard"
                style={{ width: "100%", display: "block" }}
              />
            </div>

            {/* Floating stat chip — left */}
            <div style={{
              position: "absolute",
              bottom: -16,
              left: 20,
              zIndex: 3,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12,
              padding: "10px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              animation: "floatUp 5s ease-in-out infinite",
              backdropFilter: "blur(16px)",
            }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>Proof Gallons</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: WHITE, lineHeight: 1, letterSpacing: "-0.03em" }}>265.4</p>
            </div>

            {/* Floating stat chip — right */}
            <div style={{
              position: "absolute",
              bottom: -16,
              right: 20,
              zIndex: 3,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12,
              padding: "10px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              animation: "floatUp 5s ease-in-out 1.5s infinite",
              backdropFilter: "blur(16px)",
            }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>Cases Bottled</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: WHITE, lineHeight: 1, letterSpacing: "-0.03em" }}>248</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section style={{ background: BLACK, paddingTop: 48, paddingBottom: 0 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 48px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", letterSpacing: "0.01em", marginBottom: 20 }}>
            Trusted by craft distilleries across the United States.
          </p>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{ height: 80, background: BLACK }} />

      {/* ── WHAT IS DISTILLR ── */}
      <section style={{ background: OFF }}>
        <div className="lnd-what-inner">

          {/* Left: screenshot */}
          <div className="lnd-what-left">
            <div style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}>
              <img
                src="/dashboard-screenshot.png"
                alt="Distillr Dashboard"
                style={{ width: "100%", display: "block" }}
              />
            </div>
          </div>

          {/* Right: copy */}
          <div className="lnd-what-right">
            <h2 style={{
              fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: WHITE,
              lineHeight: 1.12,
              marginBottom: 18,
            }}>
              What is Distillr?
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,0.45)", marginBottom: 22 }}>
              Distillr is an end-to-end distillery management platform — handling everything from batch production and barrel tracking to TTB compliance and state excise returns.
            </p>
            <a
              href="/features"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                textDecoration: "underline",
                textDecorationColor: "rgba(255,255,255,0.3)",
                textUnderlineOffset: "4px",
                display: "inline-block",
                marginBottom: 32,
                transition: "color 0.15s",
              }}
            >
              See how it works →
            </a>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "7-stage batch production tracking",
                "TTB Forms 5110.40 & 5000.24 auto-generated",
                "Real-time proof gallon & excise calculation",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <CreamCheck />
                  <span style={{ fontSize: 14.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="features" style={{ background: OFF, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 48px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Platform</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: WHITE, marginBottom: 14 }}>
              Built for every part of your operation.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              Every workflow, every compliance deadline, every TTB report — in one system.
            </p>
          </div>
          <div className="lnd-feature-grid">
            {[
              { n: "01", t: "TTB Compliance Engine", d: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Export to TTB PONL in one click. CBMA credits included." },
              { n: "02", t: "Batch Production", d: "7-stage workflow from mash to bottle with proof gallon tracking and TTB operation tagging at every transition." },
              { n: "03", t: "Barrel Intelligence", d: "Track every barrel from fill to dump. Angel's share, proof retention, aging milestones, and bonded warehouse balance." },
              { n: "04", t: "Inventory & Lots", d: "Real-time lot tracking with TTB movement categories, warehouse locations, and full chain of custody records." },
              { n: "05", t: "Regulatory Automation", d: "COLA registrations, all 50-state excise returns, permit renewals — tracked with deadline alerts." },
              { n: "06", t: "AI Assistant", d: "Ask about compliance deadlines, batch status, or barrel inventory in plain English and get instant data-backed answers." },
            ].map((f) => (
              <div key={f.n} className="lnd-feature-card">
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>{f.n}</p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 9 }}>{f.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.4)", margin: 0 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 48px" }} />

      {/* ── PRICING ── */}
      <section id="pricing" className="lnd-section-pad" style={{ background: BLACK }}>
        <div style={{ maxWidth: 1020, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: WHITE, marginBottom: 12 }}>
              Simple, transparent pricing.
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>Month-to-month. No lock-in. 14-day free trial on all plans.</p>
          </div>
          <div className="lnd-pricing-grid">
            {PLANS.map((p) => (
              <div key={p.name} style={{
                borderRadius: 20,
                padding: "36px 28px",
                position: "relative",
                background: p.featured ? WHITE : "rgba(255,255,255,0.04)",
                border: p.featured ? `1px solid rgba(255,255,255,0.9)` : "1px solid rgba(255,255,255,0.1)",
                boxShadow: p.featured ? `0 0 0 1px rgba(255,255,255,0.2), 0 20px 60px rgba(255,255,255,0.08)` : "none",
                backdropFilter: p.featured ? "none" : "blur(12px)",
              }}>
                {p.featured && (
                  <div style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: BLACK,
                    color: WHITE,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "5px 16px",
                    borderRadius: 100,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}>
                    Most Popular
                  </div>
                )}
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: p.featured ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                  {p.name}
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 8 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: p.featured ? BLACK : WHITE, lineHeight: 1, letterSpacing: "-0.04em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 14, color: p.featured ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)", marginBottom: 6 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 13, color: p.featured ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button
                  onClick={() => navigate("/signup")}
                  className="lnd-plan-btn"
                  style={{
                    background: p.featured ? BLACK : WHITE,
                    color: p.featured ? WHITE : BLACK,
                    border: "none",
                  }}
                >
                  {p.price === "Custom" ? "Contact Sales" : "Request Access"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <PricingCheck featured={p.featured} />
                      <span style={{ fontSize: 13, color: p.featured ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="lnd-section-pad" style={{ background: BLACK, paddingTop: 40 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: WHITE }}>
              Common questions.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${openFaq === i ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                  background: openFaq === i ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                  overflow: "hidden",
                  transition: "background 0.2s, border-color 0.2s",
                  backdropFilter: "blur(8px)",
                }}
              >
                <button
                  className="lnd-faq-btn"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: openFaq === i ? WHITE : "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{
                    fontSize: 20,
                    color: openFaq === i ? WHITE : "rgba(255,255,255,0.3)",
                    flexShrink: 0,
                    transition: "transform .2s, color .2s",
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    lineHeight: 1,
                    display: "block",
                    fontWeight: 300,
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 22px 18px" }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.45)", margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="lnd-section-pad" style={{ background: BLACK }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 24,
            padding: "72px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.4)",
          }}>
            {/* Glass highlight orb */}
            <div style={{
              position: "absolute",
              top: "-40%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 600,
              height: 360,
              background: "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 65%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 18, position: "relative", zIndex: 1 }}>
              Start Today
            </p>
            <h2 style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: WHITE,
              lineHeight: 1.1,
              marginBottom: 16,
              position: "relative",
              zIndex: 1,
            }}>
              Your distillery deserves<br />better than spreadsheets.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", maxWidth: 420, margin: "0 auto 32px", lineHeight: 1.7, position: "relative", zIndex: 1 }}>
              Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected tools with one platform.
            </p>
            <button
              onClick={() => navigate("/signup")}
              className="lnd-btn-primary"
              style={{ fontSize: 15, padding: "14px 40px", position: "relative", zIndex: 1 }}
            >
              Request Access
            </button>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 16, position: "relative", zIndex: 1 }}>
              We'll reach out within 24 hours
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: OFF, padding: "40px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="lnd-footer-inner" style={{ maxWidth: 1060, margin: "0 auto" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FooterBarrelMark />
            <span style={{ fontWeight: 800, fontSize: 15, color: WHITE, letterSpacing: "-0.03em" }}>Distillr</span>
          </div>
          {/* Nav links */}
          <div className="lnd-footer-links">
            {footerLinks.map((lk) => (
              <a
                key={lk.l}
                href={lk.h}
                style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              >
                {lk.l}
              </a>
            ))}
            <button
              onClick={() => navigate("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.3)", padding: 0, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
            >
              Sign in
            </button>
          </div>
          {/* Copyright */}
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", margin: 0 }}>
            &copy; {new Date().getFullYear()} Distillr &middot; A Loogo Labs Software
          </p>
        </div>

        {/* Legal links row */}
        <div style={{ maxWidth: 1060, margin: "20px auto 0", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "8px 24px", justifyContent: "center" }}>
          {[
            { l: "Privacy Policy", h: "/privacy" },
            { l: "Terms of Service", h: "/terms" },
            { l: "Acceptable Use", h: "/acceptable-use" },
          ].map(lk => (
            <a
              key={lk.l}
              href={lk.h}
              style={{ fontSize: 11.5, color: "rgba(255,255,255,0.18)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
            >
              {lk.l}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
