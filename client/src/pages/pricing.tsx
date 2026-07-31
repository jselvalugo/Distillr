import { useState } from "react";
import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const CREAM = "#FAF0E2";
const NAVY = "#0F1B42";

const PAGE_STYLES = `
  @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
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
  .lnd-plan-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,27,66,0.25); }
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
  .lnd-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: start; }
  .lnd-footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
  .lnd-footer-links { display: flex; gap: 28px; }
  @media (max-width: 767px) {
    .lnd-pricing-grid { grid-template-columns: 1fr !important; }
    .lnd-footer-inner { flex-direction: column; align-items: flex-start; gap: 20px; }
    .lnd-footer-links { flex-wrap: wrap; gap: 16px; }
  }
  @media (min-width: 768px) and (max-width: 1024px) {
    .lnd-pricing-grid { grid-template-columns: 1fr !important; }
  }
`;

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

const PRICING_FAQS = [
  { q: "What's included in the free trial?", a: "Full access to all Professional features for 14 days, no credit card required. You can import data, create batches, and generate TTB reports during the trial." },
  { q: "Can I switch plans later?", a: "Yes, upgrade or downgrade anytime from your account settings. Changes take effect at the start of the next billing cycle." },
  { q: "How does billing work?", a: "Monthly by default. Annual billing saves 20% — just choose the annual option at checkout or contact us to switch." },
  { q: "What counts as a user?", a: "Anyone who logs into the platform. Operators, distillers, and admins each count as one user toward your plan's limit." },
  { q: "Is there a setup fee?", a: "No setup fees. No contracts. Just the monthly subscription. Most distilleries are fully set up within a day." },
  { q: "What payment methods do you accept?", a: "All major credit cards and ACH bank transfer via Stripe. Enterprise customers may also pay by invoice." },
];

function PricingCheck({ featured }: { featured: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={featured ? "rgba(255,255,255,0.12)" : "rgba(15,27,66,0.1)"} />
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={featured ? "#fff" : NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

const footerLinks = [
  { l: "Features", h: "/features" },
  { l: "Pricing", h: "/pricing" },
  { l: "FAQ", h: "/faq" },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      <section style={{ background: CREAM, padding: "120px 48px 72px", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", animation: "fadein 0.7s ease-out both" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: `${NAVY}88`, marginBottom: 18 }}>
            Pricing
          </p>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3.4rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
            color: NAVY,
            marginBottom: 18,
          }}>
            Simple, transparent pricing.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: `${NAVY}99` }}>
            Month-to-month. No lock-in. 14-day free trial on all plans.
          </p>
        </div>
      </section>

      {/* ── PRICING GRID ── */}
      <section style={{ background: CREAM, padding: "0 48px 80px" }}>
        <div style={{ maxWidth: 1020, margin: "0 auto" }}>
          <div className="lnd-pricing-grid">
            {PLANS.map((p) => (
              <div key={p.name} style={{
                borderRadius: 20,
                padding: "36px 28px",
                position: "relative",
                background: p.featured ? NAVY : "#fff",
                border: p.featured ? `2px solid ${NAVY}` : `1.5px solid rgba(15,27,66,0.12)`,
                boxShadow: p.featured ? `0 20px 60px rgba(15,27,66,0.28)` : "0 2px 16px rgba(15,27,66,0.06)",
              }}>
                {p.featured && (
                  <div style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: CREAM,
                    color: NAVY,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "5px 16px",
                    borderRadius: 100,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    whiteSpace: "nowrap" as const,
                    boxShadow: `0 4px 16px rgba(15,27,66,0.3)`,
                  }}>
                    Most Popular
                  </div>
                )}
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: p.featured ? "rgba(250,240,226,0.55)" : `${NAVY}88`, marginBottom: 16 }}>
                  {p.name}
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 8 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: p.featured ? CREAM : NAVY, lineHeight: 1, letterSpacing: "-0.04em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 14, color: p.featured ? "rgba(250,240,226,0.45)" : `${NAVY}66`, marginBottom: 6 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 13, color: p.featured ? "rgba(250,240,226,0.55)" : `${NAVY}77`, lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button
                  onClick={() => navigate("/signup")}
                  className="lnd-plan-btn"
                  style={{
                    background: p.featured ? CREAM : NAVY,
                    color: p.featured ? NAVY : "#fff",
                    border: "none",
                  }}
                >
                  {p.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <PricingCheck featured={p.featured} />
                      <span style={{ fontSize: 13, color: p.featured ? "rgba(250,240,226,0.75)" : `${NAVY}cc`, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: CREAM, padding: "40px 48px 80px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: `${NAVY}88`, marginBottom: 12 }}>Common Questions</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: NAVY }}>
              Pricing FAQs.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PRICING_FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 12,
                  border: `1.5px solid ${openFaq === i ? `rgba(15,27,66,0.28)` : "rgba(15,27,66,0.1)"}`,
                  background: openFaq === i ? "rgba(15,27,66,0.04)" : "#fff",
                  overflow: "hidden",
                  transition: "background 0.2s, border-color 0.2s",
                }}
              >
                <button
                  className="lnd-faq-btn"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>{faq.q}</span>
                  <span style={{
                    fontSize: 20,
                    color: openFaq === i ? NAVY : `${NAVY}66`,
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
                    <p style={{ fontSize: 13.5, lineHeight: 1.75, color: `${NAVY}88`, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
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
              Get Started
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
              Ready to get started?
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 380, margin: "0 auto 32px", lineHeight: 1.7, position: "relative", zIndex: 1 }}>
              14-day free trial. No credit card. Cancel anytime.
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
