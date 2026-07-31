import { useState } from "react";
import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const CREAM = "#FAF0E2";
const NAVY = "#0F1B42";

const PAGE_STYLES = `
  @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
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
  .lnd-footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
  .lnd-footer-links { display: flex; gap: 28px; }
  .faq-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; align-items: start; }
  @media (max-width: 767px) {
    .faq-grid { grid-template-columns: 1fr !important; }
    .lnd-footer-inner { flex-direction: column; align-items: flex-start; gap: 20px; }
    .lnd-footer-links { flex-wrap: wrap; gap: 16px; }
  }
`;

const ALL_FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data — ready to export to the TTB PONL system in one click." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries are fully migrated within a single day." },
  { q: "Is there a long-term contract?", a: "No. Month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. Rates are maintained by our team and updated whenever states revise them." },
  { q: "What is a Distilled Spirits Plant (DSP)?", a: "A DSP is a TTB-registered facility that produces, processes, stores, or uses distilled spirits. Distillr is purpose-built for DSP operations and TTB reporting requirements." },
  { q: "Does Distillr support multi-site operations?", a: "Yes, on our Enterprise plan. You can manage multiple DSP registrations, each with their own batch records, barrels, and TTB reports, from a single account." },
  { q: "How does the AI assistant work?", a: "The AI assistant connects to your live distillery data and uses it to answer questions in plain English. It can tell you batch status, barrel inventory, compliance deadlines, and answer TTB questions with citations. It's powered by Claude Sonnet." },
  { q: "Can I export my data?", a: "Yes. You can export batch records, barrel logs, and inventory to CSV at any time. TTB reports export to Word and PDF. You're never locked in." },
  { q: "How long does TTB report generation take?", a: "Seconds. Because Distillr tracks proof gallons and TTB operation codes throughout production, generating the monthly 5110.40 or quarterly 5000.24 is just a click — the math is already done." },
  { q: "What happens if I exceed my user limit?", a: "We'll notify you before you hit the limit. You can upgrade your plan instantly from account settings — no downtime or data loss." },
  { q: "Is my data secure?", a: "Yes. Data is encrypted in transit (TLS) and at rest. Each distillery's data is isolated at the database level. We do not share or sell your production data." },
  { q: "What's the minimum contract length?", a: "There is no minimum. Distillr is month-to-month. You can cancel anytime from your account settings, and your data is exportable at any time." },
];

// Split FAQs into two columns
const LEFT_FAQS = ALL_FAQS.filter((_, i) => i % 2 === 0);
const RIGHT_FAQS = ALL_FAQS.filter((_, i) => i % 2 === 1);

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

function FaqItem({ faq, index, openId, setOpenId }: { faq: { q: string; a: string }; index: number; openId: number | null; setOpenId: (id: number | null) => void }) {
  const isOpen = openId === index;
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1.5px solid ${isOpen ? `rgba(15,27,66,0.28)` : "rgba(15,27,66,0.1)"}`,
        background: isOpen ? "rgba(15,27,66,0.04)" : "#fff",
        overflow: "hidden",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <button
        className="lnd-faq-btn"
        onClick={() => setOpenId(isOpen ? null : index)}
      >
        <span style={{ fontSize: 14.5, fontWeight: 600, color: NAVY, lineHeight: 1.4 }}>{faq.q}</span>
        <span style={{
          fontSize: 20,
          color: isOpen ? NAVY : `${NAVY}66`,
          flexShrink: 0,
          transition: "transform .2s, color .2s",
          transform: isOpen ? "rotate(45deg)" : "none",
          lineHeight: 1,
          display: "block",
          fontWeight: 300,
        }}>+</span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 22px 18px" }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.75, color: `${NAVY}88`, margin: 0 }}>{faq.a}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [, navigate] = useLocation();
  const [openId, setOpenId] = useState<number | null>(null);

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
            FAQ
          </p>
          <h1 style={{
            fontSize: "clamp(2rem, 4vw, 3.4rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
            color: NAVY,
            marginBottom: 18,
          }}>
            Frequently asked questions.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: `${NAVY}99` }}>
            Everything you need to know about Distillr, TTB compliance, and how the platform works.
          </p>
        </div>
      </section>

      {/* ── FAQ GRID ── */}
      <section style={{ background: CREAM, padding: "0 48px 80px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div className="faq-grid">
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LEFT_FAQS.map((faq, i) => {
                const globalIndex = i * 2;
                return (
                  <FaqItem
                    key={globalIndex}
                    faq={faq}
                    index={globalIndex}
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                );
              })}
            </div>
            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {RIGHT_FAQS.map((faq, i) => {
                const globalIndex = i * 2 + 1;
                return (
                  <FaqItem
                    key={globalIndex}
                    faq={faq}
                    index={globalIndex}
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                );
              })}
            </div>
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
              Still have questions?
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
              Try Distillr free for 14 days.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.7, position: "relative", zIndex: 1 }}>
              No credit card required. Full access to all Professional features during your trial.
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
