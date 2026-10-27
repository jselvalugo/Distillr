import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "../components/public/shell";
import { FaqItem } from "./landing";

const ALL_FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action is automatically tagged with TTB operation codes. Forms 5110.40 and 5000.24 pre-populate from your actual batch data — ready to export to the TTB PONL system in one click." },
  { q: "Can I import my existing records?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries are fully migrated within a single day." },
  { q: "Is there a long-term contract?", a: "No. Month-to-month with no lock-in. Annual billing is available at 20% off. Cancel anytime." },
  { q: "Which states are covered for excise returns?", a: "All 50 states plus DC. Rates are maintained by our team and updated whenever states revise them." },
  { q: "What is a Distilled Spirits Plant (DSP)?", a: "A DSP is a TTB-registered facility that produces, processes, stores, or uses distilled spirits. Distillr is purpose-built for DSP operations and TTB reporting requirements." },
  { q: "Does Distillr support multi-site operations?", a: "Yes, on our Enterprise plan. You can manage multiple DSP registrations, each with their own batch records, barrels, and TTB reports, from a single account." },
  { q: "How does the AI assistant work?", a: "The AI assistant connects to your live distillery data and uses it to answer questions in plain English. It can tell you batch status, barrel inventory, compliance deadlines, and answer TTB questions with citations." },
  { q: "Can I export my data?", a: "Yes. You can export batch records, barrel logs, and inventory to CSV at any time. Reports export to PDF, Excel and Word. You're never locked in." },
  { q: "How long does TTB report generation take?", a: "Seconds. Because Distillr tracks proof gallons and TTB operation codes throughout production, generating the monthly 5110.40 or the 5000.24 is just a click — the math is already done." },
  { q: "What happens if I exceed my user limit?", a: "We'll notify you before you hit the limit. You can upgrade your plan instantly from account settings — no downtime or data loss." },
  { q: "Is my data secure?", a: "Yes. Data is encrypted in transit (TLS) and at rest. Each distillery's data is isolated at the database level. We do not share or sell your production data." },
  { q: "What's the minimum contract length?", a: "There is no minimum. Distillr is month-to-month. You can cancel anytime from your account settings, and your data is exportable at any time." },
];

export default function FaqPage() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState<number | null>(0);
  const left = ALL_FAQS.filter((_, i) => i % 2 === 0);
  const right = ALL_FAQS.filter((_, i) => i % 2 === 1);
  const col = (items: typeof ALL_FAQS, offset: number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((f, i) => {
        const idx = i * 2 + offset;
        return <FaqItem key={f.q} q={f.q} a={f.a} open={open === idx} onToggle={() => setOpen(open === idx ? null : idx)} />;
      })}
    </div>
  );
  return (
    <PublicShell>
      <section className="pub-hero" style={{ paddingBottom: 24 }}>
        <div className="pub-hero__glow" />
        <div className="pub-hero__grid" />
        <div className="pub-wrap pub-center pub-rise" style={{ position: "relative", zIndex: 1 }}>
          <p className="pub-eyebrow">FAQ</p>
          <h1 className="pub-h1" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}>Frequently asked questions.</h1>
          <p className="pub-lead" style={{ margin: "0 auto" }}>Everything you need to know about Distillr, TTB compliance, and how the platform works.</p>
        </div>
      </section>

      <section className="pub-section" style={{ paddingTop: 36 }}>
        <div className="pub-wrap pub-grid-2" style={{ alignItems: "start" }}>
          {col(left, 0)}
          {col(right, 1)}
        </div>
      </section>

      <section>
        <div className="pub-wrap">
          <div className="pub-band">
            <p className="pub-eyebrow">Still curious?</p>
            <h2 className="pub-h2">Try Distillr free for 14 days.</h2>
            <p className="pub-lead" style={{ margin: "0 auto 32px" }}>No credit card. No contract. Your data is yours to export at any time.</p>
            <button className="pub-btn pub-btn--on-dark pub-btn--lg" onClick={() => navigate("/signup")}>
              Request access <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
