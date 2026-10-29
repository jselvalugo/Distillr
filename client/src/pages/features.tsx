import { useLocation } from "wouter";
import { ArrowRight, Bot, FlaskConical, Landmark, Layers, Package, ShieldCheck, type LucideIcon } from "lucide-react";
import { PublicShell } from "../components/public/shell";
import { CheckDot } from "./landing";

const FEATURES: Array<{ num: string; title: string; desc: string; bullets: string[]; icon: LucideIcon; stat: [string, string] }> = [
  {
    num: "01",
    icon: ShieldCheck,
    title: "TTB Compliance Engine",
    desc: "Auto-generate Forms 5110.40 and 5000.24 from live batch data. Every number is sourced directly from your production records — no manual entry required.",
    bullets: ["Form 5110.40 Monthly Report of Production Operations", "Form 5000.24 Excise Tax Return with CBMA tier calculation", "Export to PDF, Excel or Word for your review and filing"],
    stat: ["$2.70", "per proof gallon · Craft Tier 1"],
  },
  {
    num: "02",
    icon: FlaskConical,
    title: "Batch Production",
    desc: "A 7-stage production workflow built around TTB operation categories. Track every batch from grain purchase to finished spirit with automatic proof gallon calculations at each stage transition.",
    bullets: ["Planning → Mash → Distillation → Barreling → Aging → Bottling → Closed", "Proof gallon tracking auto-calculated at each stage", "Batch codes and TTB operation tags on every record"],
    stat: ["7", "stages, mash to closed"],
  },
  {
    num: "03",
    icon: Layers,
    title: "Barrel Intelligence",
    desc: "Track every barrel from fill to dump. Distillr records gauging data, evaporation over time, and proof retention so your bonded warehouse records stay current and ready for TTB reporting.",
    bullets: ["Angel's share evaporation tracking and gauging", "Proof retention and aging milestones", "Bonded warehouse zone assignment"],
    stat: ["318.0", "proof gallons in bond"],
  },
  {
    num: "04",
    icon: Package,
    title: "Inventory & Lots",
    desc: "Real-time lot tracking across all raw materials, spirits in process, and finished goods. Every movement is categorized for TTB reporting with full chain of custody from receipt to sale.",
    bullets: ["TTB movement categories on every transaction", "Full chain of custody records", "Warehouse location tracking"],
    stat: ["381", "cases shipped this quarter"],
  },
  {
    num: "05",
    icon: Landmark,
    title: "Regulatory Tracking",
    desc: "Stay ahead of every filing deadline. Distillr tracks COLA registrations, state excise return schedules, and permit renewal dates with alerts before anything comes due.",
    bullets: ["State excise return preparation and tracking", "COLA and label registration tracking", "Permit expiration alerts"],
    stat: ["50 states", "excise return tracking"],
  },
  {
    num: "06",
    icon: Bot,
    title: "AI Operations Assistant",
    desc: "Ask questions about your distillery in plain English. The AI assistant reads your live production data and answers compliance questions with citations so you always know where the answer comes from.",
    bullets: ["Reads your live distillery data in real time", "Answers TTB compliance questions with citations", "Backed by Claude"],
    stat: ["Seconds", "to a sourced answer"],
  },
];

function FeatureMedia({ f }: { f: (typeof FEATURES)[number] }) {
  const Icon = f.icon;
  return (
    <div className="pub-feature-row__media">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="pub-card__icon" style={{ marginBottom: 0 }}>
          <Icon size={18} />
        </div>
        <span className="pub-card__num" style={{ margin: 0 }}>{f.num}</span>
      </div>
      <p className="display" style={{ fontSize: 40, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1 }}>{f.stat[0]}</p>
      <p style={{ fontSize: 13, color: "#64748B", margin: "8px 0 20px" }}>{f.stat[1]}</p>
      <div style={{ display: "grid", gap: 8 }}>
        {[100, 75, 50].map((w, i) => (
          <div key={w} style={{ height: 9, borderRadius: 100, width: `${w}%`, background: "#4F46E5", opacity: 1 - i * 0.25, marginLeft: `${i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [, navigate] = useLocation();
  return (
    <PublicShell>
      <section className="pub-hero" style={{ paddingBottom: 24 }}>
        <div className="pub-hero__glow" />
        <div className="pub-hero__grid" />
        <div className="pub-wrap pub-center pub-rise" style={{ position: "relative", zIndex: 1 }}>
          <p className="pub-eyebrow">Platform features</p>
          <h1 className="pub-h1" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}>Everything your distillery needs.</h1>
          <p className="pub-lead" style={{ margin: "0 auto" }}>One platform for production, compliance, and operations — built for licensed Distilled Spirits Plants.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
            <button className="pub-btn pub-btn--primary pub-btn--lg" onClick={() => navigate("/signup")}>
              Request access <ArrowRight size={16} />
            </button>
            <button className="pub-btn pub-btn--ghost pub-btn--lg" onClick={() => navigate("/pricing")}>
              See pricing
            </button>
          </div>
        </div>
      </section>

      <section className="pub-section" style={{ paddingTop: 24 }}>
        <div className="pub-wrap">
          {FEATURES.map((f, i) => (
            <div key={f.num} className={`pub-feature-row ${i % 2 ? "pub-feature-row--flip" : ""}`}>
              <FeatureMedia f={f} />
              <div>
                <p className="pub-eyebrow">{f.num}</p>
                <h2 className="pub-h2" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)" }}>{f.title}</h2>
                <p className="pub-lead" style={{ fontSize: 16 }}>{f.desc}</p>
                <ul className="pub-bullets">
                  {f.bullets.map((b) => (
                    <li key={b} className="pub-check">
                      <CheckDot />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ paddingBottom: 0 }}>
        <div className="pub-wrap">
          <div className="pub-band">
            <p className="pub-eyebrow">Get started</p>
            <h2 className="pub-h2">See it with your own numbers.</h2>
            <p className="pub-lead" style={{ margin: "0 auto 32px" }}>Import your batches and barrels in an afternoon and generate your first TTB report the same day.</p>
            <button className="pub-btn pub-btn--on-dark pub-btn--lg" onClick={() => navigate("/signup")}>
              Request access <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
