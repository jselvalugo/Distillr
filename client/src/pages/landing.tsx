import { useState, useEffect } from "react";
import { useLocation } from "wouter";

// ─── Keyframe injection ───────────────────────────────────────────────────────
const STYLES = `
  @keyframes bar { 0%,100%{transform:scaleY(.25)} 50%{transform:scaleY(1)} }
  @keyframes drift { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-7px)} }
  @keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:.8} }
  @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
`;

// ─── Floating data node ───────────────────────────────────────────────────────
function Node({ label, sub, x, y, delay = 0 }: { label: string; sub?: string; x: string; y: string; delay?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, animation: `drift 5s ease-in-out ${delay}s infinite`, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.55)", flexShrink: 0, animation: `pulse 3s ease-in-out ${delay}s infinite` }} />
        <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" }}>{label}</span>
      </div>
      {sub && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", marginTop: 3, marginLeft: 11 }}>{sub}</div>}
    </div>
  );
}

// ─── Waveform bars ────────────────────────────────────────────────────────────
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

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 8.5L7 10L10.5 6.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>Distillr</span>
    </div>
  );
}

// ─── Check ────────────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6.5" stroke="rgba(255,255,255,0.2)" />
      <path d="M4 7l2 2 4-4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Plans ────────────────────────────────────────────────────────────────────
const PLANS = [
  { name: "Starter", price: "$149", per: "/mo", desc: "For small craft producers going digital.", featured: false,
    features: ["3 users", "Batch & production tracking", "Up to 50 barrels", "TTB report generation", "Email support"] },
  { name: "Professional", price: "$349", per: "/mo", desc: "The complete platform for growing distilleries.", featured: true,
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const D = "rgba(255,255,255,0.06)";
  const DB = "rgba(255,255,255,0.1)";

  return (
    <div style={{ background: "#070707", color: "#fff", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX: "hidden" }}>
      <style>{STYLES}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 60,
        background: scrolled ? "rgba(7,7,7,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
        transition: "all 0.3s",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo /></button>
        <div style={{ display: "flex", gap: 36 }}>
          {[{ l: "Features", h: "#features" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }].map((n) => (
            <a key={n.l} href={n.h} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>{n.l}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.5)", padding: "8px 14px", borderRadius: 8, transition: "color .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>Sign in</button>
          <button onClick={() => navigate("/signup")} style={{ background: "#fff", color: "#070707", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 8, transition: "opacity .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>Create Account</button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>

        {/* Central radial glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 700, background: "radial-gradient(ellipse, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 60%)" }} />
        </div>

        {/* Floating data nodes */}
        <Node label="Batch WH-2025-047" sub="Wheat Whiskey · Aging stage" x="5%" y="22%" delay={0} />
        <Node label="4,821 Proof Gallons" sub="produced this month" x="68%" y="18%" delay={0.8} />
        <Node label="TTB Filing · Ready" sub="Form 5110.40 auto-generated" x="4%" y="52%" delay={1.4} />
        <Node label="147 Barrels Aging" sub="bonded warehouse A & B" x="72%" y="50%" delay={0.4} />
        <Node label="Compliance · 100%" sub="no outstanding deadlines" x="8%" y="76%" delay={1.8} />
        <Node label="Excise Due · $18,616" sub="July 2026 · TTB PONL" x="66%" y="78%" delay={1.0} />

        {/* Connector lines (decorative) */}
        <div style={{ position: "absolute", top: "27%", left: "19%", width: 80, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1))", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "54%", left: "20%", width: 60, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "23%", right: "17%", width: 80, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)", pointerEvents: "none" }} />

        {/* Center content */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 680, padding: "0 24px", animation: "fadein 0.8s ease-out both" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, padding: "5px 14px 5px 8px", marginBottom: 32 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><circle cx="4" cy="4" r="3" /></svg>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em" }}>Real-time Distillery Operations</span>
          </div>

          <h1 style={{ fontSize: "clamp(2.8rem,5vw,4.2rem)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#fff", margin: "0 0 20px" }}>
            One system for every<br />
            <span style={{ color: "rgba(255,255,255,0.45)" }}>stage of production.</span>
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.45)", margin: "0 auto 36px", maxWidth: 520 }}>
            From grain to glass — batch tracking, TTB compliance, barrel intelligence, and regulatory automation built for craft distillers.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 56 }}>
            <button onClick={() => navigate("/signup")} style={{ background: "#fff", color: "#070707", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "12px 28px", borderRadius: 9, transition: "opacity .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>Start Free Trial</button>
            <button onClick={() => navigate("/login")} style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", fontSize: 14, fontWeight: 500, padding: "12px 24px", borderRadius: 9, transition: "background .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}>Sign In →</button>
          </div>

          <Waveform />
        </div>

        {/* Logo / trust strip */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 12 }}>Trusted by</span>
          {["TTB Compliant", "Supabase", "Railway", "PostgreSQL", "TypeScript", "Node.js"].map((b) => (
            <span key={b} style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)", letterSpacing: "0.02em" }}>{b}</span>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "100px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Platform</p>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", marginBottom: 14 }}>Built for every part of your operation.</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>Every workflow, every compliance deadline, every TTB report — in one system that actually talks to itself.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { n: "01", t: "TTB Compliance Engine", d: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Export to TTB PONL in one click. CBMA credits included." },
              { n: "02", t: "Batch Production", d: "7-stage workflow from mash to bottle with proof gallon tracking and TTB operation tagging at every transition." },
              { n: "03", t: "Barrel Intelligence", d: "Track every barrel from fill to dump. Angel's share, proof retention, aging milestones, and bonded warehouse balance." },
              { n: "04", t: "Inventory & Lots", d: "Real-time lot tracking with TTB movement categories, warehouse locations, and full chain of custody records." },
              { n: "05", t: "Regulatory Automation", d: "COLA registrations, all 50-state excise returns, permit renewals — tracked with deadline alerts." },
              { n: "06", t: "AI Assistant", d: "Ask about compliance deadlines, batch status, or barrel inventory in plain English and get instant data-backed answers." },
            ].map((f) => (
              <div key={f.n} style={{ background: D, border: `1px solid ${DB}`, borderRadius: 14, padding: "26px 24px", transition: "background .2s, border-color .2s", cursor: "default" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = D; (e.currentTarget as HTMLElement).style.borderColor = DB; }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", marginBottom: 12 }}>{f.n}</p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 9 }}>{f.t}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.4)", margin: 0 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "100px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Pricing</p>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", marginBottom: 12 }}>Simple, transparent pricing.</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Month-to-month. No lock-in. 14-day free trial on all plans.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{
                borderRadius: 18, padding: "34px 28px", position: "relative",
                background: p.featured ? "rgba(255,255,255,0.09)" : D,
                border: p.featured ? "1px solid rgba(255,255,255,0.2)" : `1px solid ${DB}`,
                boxShadow: p.featured ? "0 0 60px rgba(255,255,255,0.04)" : "none",
              }}>
                {p.featured && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#070707", fontSize: 9.5, fontWeight: 800, padding: "3px 12px", borderRadius: 100, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Most Popular</div>}
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>{p.name}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>{p.per}</span>}
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 24 }}>{p.desc}</p>
                <button onClick={() => navigate("/signup")} style={{ width: "100%", padding: "11px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 24, transition: "opacity .15s", background: p.featured ? "#fff" : "rgba(255,255,255,0.07)", color: p.featured ? "#070707" : "#fff", border: p.featured ? "none" : "1px solid rgba(255,255,255,0.12)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                  {p.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <Check />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "100px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#fff" }}>Common questions.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderRadius: 12, border: `1px solid ${openFaq === i ? "rgba(255,255,255,0.16)" : DB}`, background: openFaq === i ? "rgba(255,255,255,0.06)" : D, overflow: "hidden", transition: "all .2s" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "17px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", flexShrink: 0, transition: "transform .2s", transform: openFaq === i ? "rotate(45deg)" : "none", lineHeight: 1, display: "block" }}>+</span>
                </button>
                {openFaq === i && <div style={{ padding: "0 20px 18px" }}><p style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.45)", margin: 0 }}>{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 48px 120px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "72px 48px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
            <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>Start Today</p>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.8rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>
              Your distillery deserves<br />better than spreadsheets.
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", maxWidth: 400, margin: "0 auto 36px", lineHeight: 1.7 }}>
              Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected tools with one platform.
            </p>
            <button onClick={() => navigate("/signup")} style={{ background: "#fff", color: "#070707", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "14px 36px", borderRadius: 10, transition: "opacity .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              Start Free Trial
            </button>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginTop: 14 }}>No credit card · 14-day trial · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "40px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <Logo />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Built for craft distillers.</p>
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            {[{ l: "Features", h: "#features" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }].map((lk) => (
              <a key={lk.l} href={lk.h} style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>{lk.l}</a>
            ))}
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.25)", padding: 0, transition: "color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>Sign in</button>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>&copy; {new Date().getFullYear()} Distillr</p>
        </div>
      </footer>
    </div>
  );
}
