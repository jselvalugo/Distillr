import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bot, Check, FlaskConical, Landmark, Layers, Package, ShieldCheck } from "lucide-react";
import { PublicShell } from "../components/public/shell";
import { DistillrMark } from "../components/brand/logo";

const PLANS = [
  {
    name: "Starter",
    price: "$99",
    per: "/mo",
    desc: "For small craft producers going digital.",
    featured: false,
    features: ["1 user", "Batch & production tracking", "Up to 50 barrels", "TTB report generation", "Email support"],
  },
  {
    name: "Professional",
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

const FEATURES = [
  { n: "01", icon: ShieldCheck, t: "TTB Compliance Engine", d: "Forms 5110.40 and 5000.24 built from live batch data, with CBMA rate tiers applied. Export to PDF, Excel or Word in one click." },
  { n: "02", icon: FlaskConical, t: "Batch Production", d: "A 7-stage workflow from mash to bottle, with proof gallons calculated and TTB operations tagged at every step." },
  { n: "03", icon: Layers, t: "Barrel Intelligence", d: "Every barrel from fill to dump: gauge readings, angel's share, aging milestones and your bonded warehouse balance." },
  { n: "04", icon: Package, t: "Inventory & Lots", d: "Lot tracking with TTB movement categories, warehouse locations and a full chain of custody." },
  { n: "05", icon: Landmark, t: "Regulatory Automation", d: "COLA registrations, 50-state excise returns and permit renewals, tracked with deadline alerts." },
  { n: "06", icon: Bot, t: "AI Assistant", d: "Ask about deadlines, batch status or barrel inventory in plain English and get answers backed by your data." },
];

export function CheckDot({ dark = false }: { dark?: boolean }) {
  return (
    <span className="pub-check__dot" style={dark ? { background: "rgba(129,140,248,0.25)" } : undefined}>
      <Check size={11} strokeWidth={3} color={dark ? "#C7D2FE" : "#4F46E5"} />
    </span>
  );
}

export function PlanCard({ plan, onSelect }: { plan: (typeof PLANS)[number]; onSelect: () => void }) {
  return (
    <div className={`pub-plan ${plan.featured ? "pub-plan--featured" : ""}`}>
      {plan.featured && <span className="pub-plan__tag">Most popular</span>}
      <p className="pub-plan__name">{plan.name}</p>
      <div className="pub-plan__price">
        <strong>{plan.price}</strong>
        {plan.per && <span>{plan.per}</span>}
      </div>
      <p className="pub-plan__desc">{plan.desc}</p>
      <button className={`pub-btn ${plan.featured ? "pub-btn--primary" : "pub-btn--ghost"}`} onClick={onSelect} style={{ width: "100%" }}>
        {plan.price === "Custom" ? "Contact sales" : "Request access"}
      </button>
      <ul className="pub-plan__list">
        {plan.features.map((f) => (
          <li key={f}>
            <CheckDot dark={plan.featured} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`pub-faq ${open ? "pub-faq--open" : ""}`}>
      <button className="pub-faq__btn" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <span className="pub-faq__plus" aria-hidden>
          +
        </span>
      </button>
      {open && <div className="pub-faq__body">{a}</div>}
    </div>
  );
}

export { PLANS as LANDING_PLANS };

export default function Landing() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <PublicShell>
      {/* ── Hero ── */}
      <section className="pub-hero">
        <div className="pub-hero__glow" />
        <div className="pub-hero__grid" />
        <div className="pub-wrap pub-hero__inner">
          <div className="pub-rise">
            <div className="pub-badge">
              <DistillrMark size={16} />
              Distillery operations platform
            </div>
            <h1 className="pub-h1">
              Run the distillery.
              <br />
              <em>Distillr</em> handles the paperwork.
            </h1>
            <p className="pub-lead">
              Batch production, barrels, inventory and sales in one place — with TTB forms, excise returns and state filings generated from the records you already keep.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
              <button className="pub-btn pub-btn--primary pub-btn--lg" onClick={() => navigate("/signup")}>
                Request access <ArrowRight size={16} />
              </button>
              <button className="pub-btn pub-btn--ghost pub-btn--lg" onClick={() => navigate("/login")}>
                Sign in
              </button>
            </div>
            <p className="pub-hero__note">
              <strong>No credit card required</strong> · 14-day free trial · Month-to-month
            </p>
          </div>

          <div className="pub-rise-2" style={{ position: "relative" }}>
            <div className="pub-frame">
              <div className="pub-frame__bar">
                <span className="pub-frame__dots"><span /><span /><span /></span>
                <span className="pub-frame__url">app.distillrsoftware.com/dashboard</span>
              </div>
              <img src="/dashboard-screenshot.png" alt="Distillr operations dashboard" />
            </div>
            <div className="pub-chip" style={{ bottom: -18, left: 18 }}>
              <p className="pub-chip__label">Proof gallons in bond</p>
              <p className="pub-chip__value">
                1,264.8<small>PG</small>
              </p>
            </div>
            <div className="pub-chip" style={{ bottom: -18, right: 18, animationDelay: "1.4s" }}>
              <p className="pub-chip__label">Excise due · Oct</p>
              <p className="pub-chip__value">$1,098.48</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="pub-trust" style={{ marginTop: 40 }}>
        <div className="pub-wrap pub-trust__inner" style={{ padding: 0 }}>
          {[
            ["5110.40 · 5000.24", "TTB forms, filled from your data"],
            ["50 + DC", "State excise rates maintained"],
            ["7 stages", "Mash to bottle, proof gallons at each"],
            ["< 1 day", "Typical migration from spreadsheets"],
          ].map(([v, l]) => (
            <div key={l} className="pub-trust__item">
              <p className="pub-trust__value">{v}</p>
              <p className="pub-trust__label">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is Distillr ── */}
      <section className="pub-section">
        <div className="pub-wrap pub-split">
          <div className="pub-frame" style={{ boxShadow: "0 30px 60px -40px rgba(15,23,42,0.45)" }}>
            <img src="/dashboard-screenshot.png" alt="Distillr dashboard" />
          </div>
          <div>
            <p className="pub-eyebrow">What is Distillr</p>
            <h2 className="pub-h2">One system for the whole operation.</h2>
            <p className="pub-lead">
              Distillr is an end-to-end distillery management platform — batch production, barrel tracking, inventory, sales, and the TTB and state compliance that comes with them.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "26px 0" }}>
              {["7-stage batch production tracking", "TTB Forms 5110.40 and 5000.24, generated for you", "Real-time proof gallon and excise calculation", "Clean PDF, Excel and Word exports"].map((item) => (
                <div key={item} className="pub-check">
                  <CheckDot />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link href="/features" className="pub-link">
              See how it works <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="pub-section" style={{ paddingTop: 0 }}>
        <div className="pub-wrap">
          <div className="pub-center" style={{ marginBottom: 44 }}>
            <p className="pub-eyebrow">Platform</p>
            <h2 className="pub-h2">Built for every part of your operation.</h2>
            <p className="pub-lead">Every workflow, every compliance deadline, every TTB report — in one system.</p>
          </div>
          <div className="pub-grid-3">
            {FEATURES.map((f) => (
              <div key={f.n} className="pub-card">
                <div className="pub-card__icon">
                  <f.icon size={18} strokeWidth={2} />
                </div>
                <p className="pub-card__num">{f.n}</p>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="pub-section" style={{ paddingTop: 0 }}>
        <div className="pub-wrap">
          <div className="pub-center" style={{ marginBottom: 44 }}>
            <p className="pub-eyebrow">Pricing</p>
            <h2 className="pub-h2">Simple, transparent pricing.</h2>
            <p className="pub-lead">Month-to-month. No lock-in. 14-day free trial on all plans.</p>
          </div>
          <div className="pub-plans">
            {PLANS.map((p) => (
              <PlanCard key={p.name} plan={p} onSelect={() => navigate("/signup")} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="pub-section" style={{ paddingTop: 0 }}>
        <div className="pub-wrap" style={{ maxWidth: 760 }}>
          <div className="pub-center" style={{ marginBottom: 32 }}>
            <p className="pub-eyebrow">FAQ</p>
            <h2 className="pub-h2">Common questions.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
            ))}
          </div>
          <p className="pub-center" style={{ marginTop: 20, fontSize: 14, color: "#64748b" }}>
            <Link href="/faq" className="pub-link">
              More questions answered <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="pub-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="pub-wrap">
          <div className="pub-band">
            <p className="pub-eyebrow">Start today</p>
            <h2 className="pub-h2" style={{ fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)" }}>
              Your distillery deserves better than spreadsheets.
            </h2>
            <p className="pub-lead" style={{ margin: "0 auto 32px" }}>
              Join craft distilleries that replaced manual TTB filings, lost barrel records and disconnected tools with one platform.
            </p>
            <button className="pub-btn pub-btn--on-dark pub-btn--lg" onClick={() => navigate("/signup")}>
              Request access <ArrowRight size={16} />
            </button>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 16 }}>We'll reach out within 24 hours.</p>
          </div>
        </div>
      </section>

    </PublicShell>
  );
}
