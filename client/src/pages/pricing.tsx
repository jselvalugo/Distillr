import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "../components/public/shell";
import { FaqItem, LANDING_PLANS, PlanCard } from "./landing";

const PRICING_FAQS = [
  { q: "What's included in the free trial?", a: "Full access to all Professional features for 14 days, no credit card required. You can import data, create batches, and generate TTB reports during the trial." },
  { q: "Can I switch plans later?", a: "Yes, upgrade or downgrade anytime from your account settings. Changes take effect at the start of the next billing cycle." },
  { q: "How does billing work?", a: "Monthly by default, and subscriptions renew automatically until you cancel. Annual billing saves 20% — contact us to switch. Your trial never converts to a paid plan unless you choose one." },
  { q: "What counts as a user?", a: "Anyone who logs into the platform. Operators, distillers, and admins each count as one user toward your plan's limit." },
  { q: "Is there a setup fee?", a: "No setup fees. No contracts. Just the monthly subscription. Most distilleries are fully set up within a day." },
  { q: "What payment methods do you accept?", a: "We set up payment with you when you move to a paid plan. Enterprise customers may pay by invoice." },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <PublicShell>
      <section className="pub-hero" style={{ paddingBottom: 24 }}>
        <div className="pub-hero__glow" />
        <div className="pub-hero__grid" />
        <div className="pub-wrap pub-center pub-rise" style={{ position: "relative", zIndex: 1 }}>
          <p className="pub-eyebrow">Pricing</p>
          <h1 className="pub-h1" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}>Simple, transparent pricing.</h1>
          <p className="pub-lead" style={{ margin: "0 auto" }}>Month-to-month. No lock-in. 14-day free trial on all plans.</p>
        </div>
      </section>

      <section className="pub-section" style={{ paddingTop: 36 }}>
        <div className="pub-wrap">
          <div className="pub-plans">
            {LANDING_PLANS.map((p) => (
              <PlanCard key={p.name} plan={p} onSelect={() => navigate("/signup")} />
            ))}
          </div>
          <p className="pub-center" style={{ marginTop: 22, fontSize: 13, color: "#64748B" }}>Annual billing saves 20%. Prices in USD. Taxes may apply.</p>
        </div>
      </section>

      <section className="pub-section" style={{ paddingTop: 0 }}>
        <div className="pub-wrap" style={{ maxWidth: 760 }}>
          <div className="pub-center" style={{ marginBottom: 28 }}>
            <p className="pub-eyebrow">Billing</p>
            <h2 className="pub-h2">Pricing FAQs.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PRICING_FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="pub-wrap">
          <div className="pub-band">
            <p className="pub-eyebrow">Ready?</p>
            <h2 className="pub-h2">Ready to get started?</h2>
            <p className="pub-lead" style={{ margin: "0 auto 32px" }}>Start your 14-day trial — no credit card, no contract.</p>
            <button className="pub-btn pub-btn--on-dark pub-btn--lg" onClick={() => navigate("/signup")}>
              Request access <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
