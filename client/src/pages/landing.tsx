import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

// ─── Animated particle background ────────────────────────────────────────────
function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let w = 0, h = 0;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    function resize() { w = canvas!.width = canvas!.offsetWidth; h = canvas!.height = canvas!.offsetHeight; }
    function init() {
      resize(); particles.length = 0;
      const count = Math.floor((w * h) / 12000);
      for (let i = 0; i < count; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.5 + 0.4, alpha: Math.random() * 0.35 + 0.08 });
    }
    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) { ctx!.beginPath(); ctx!.strokeStyle = `rgba(255,255,255,${0.1 * (1 - dist / 130)})`; ctx!.lineWidth = 0.5; ctx!.moveTo(particles[i].x, particles[i].y); ctx!.lineTo(particles[j].x, particles[j].y); ctx!.stroke(); }
      }
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fillStyle = `rgba(255,255,255,${p.alpha})`; ctx!.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    init(); draw();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 26 : 32;
  const fontSize = size === "sm" ? "1rem" : "1.125rem";
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: iconSize, height: iconSize, background: "linear-gradient(135deg, #2a2a2a, #000)" }}>
        <svg width={iconSize * 0.5} height={iconSize * 0.5} viewBox="0 0 16 16" fill="none">
          <path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
          <path d="M8 6V10M6 8H10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span className="font-bold tracking-tight" style={{ color: "#fff", fontSize }}> Distillr</span>
    </div>
  );
}

// ─── Fake product UI mockups ──────────────────────────────────────────────────
function MockupTTB() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
        <span className="ml-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>TTB Report — July 2025</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Form 5110.40 · Monthly</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(40,200,64,0.15)", color: "#28c840", border: "1px solid rgba(40,200,64,0.25)" }}>Auto-Generated</span>
        </div>
        {[
          { label: "Total Proof Gallons Produced", val: "4,821.3" },
          { label: "On-Premises Use", val: "286.5" },
          { label: "Tax-Determined (Bottled)", val: "3,102.7" },
          { label: "Excise Tax Due", val: "$18,616.20" },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{r.label}</span>
            <span className="text-xs font-semibold" style={{ color: "#f5f0e8" }}>{r.val}</span>
          </div>
        ))}
        <button className="w-full mt-2 py-2 rounded-lg text-xs font-semibold" style={{ background: "rgba(200,136,42,0.2)", color: "#c9952a", border: "1px solid rgba(200,136,42,0.3)" }}>
          Export to TTB PONL System →
        </button>
      </div>
    </div>
  );
}

function MockupBatch() {
  const stages = ["Mash", "Ferment", "Distill", "Proof", "Age", "Filter", "Bottle"];
  const active = 4;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-xs font-semibold" style={{ color: "#f5f0e8" }}>Batch #WH-2025-047 · Wheat Whiskey</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>In Progress</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-1 mb-5">
          {stages.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full h-1 rounded-full" style={{ background: i < active ? "#c9952a" : i === active ? "rgba(200,136,42,0.5)" : "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: 9, color: i <= active ? "rgba(200,136,42,0.9)" : "rgba(255,255,255,0.25)" }}>{s}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Proof Gallons", val: "312.8" },
            { label: "Still ABV", val: "71.4%" },
            { label: "Mash Date", val: "Jul 12" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-sm font-bold" style={{ color: "#f5f0e8" }}>{s.val}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(200,136,42,0.06)", border: "1px solid rgba(200,136,42,0.15)" }}>
          <p style={{ fontSize: 10, color: "rgba(200,136,42,0.85)" }}>⚡ Stage transition logged to TTB · 14 barrels allocated</p>
        </div>
      </div>
    </div>
  );
}

function MockupBarrel() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-xs font-semibold" style={{ color: "#f5f0e8" }}>Barrel #B-0441 · Bonded Warehouse A</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(200,136,42,0.15)", color: "#c9952a", border: "1px solid rgba(200,136,42,0.25)" }}>Aging · 847 days</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Fill Proof Gallons", val: "53.2" },
            { label: "Current Est.", val: "49.8 PG" },
            { label: "Angel's Share", val: "6.4%" },
            { label: "Est. Dump Date", val: "Mar 2026" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-sm font-bold" style={{ color: "#f5f0e8" }}>{s.val}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Proof gallon retention</span>
            <span style={{ fontSize: 10, color: "#c9952a" }}>93.6%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-1.5 rounded-full" style={{ width: "93.6%", background: "linear-gradient(90deg, #c9952a, #e8b86d)" }} />
          </div>
        </div>
        <div className="space-y-1.5">
          {["Color: Deep amber, hints of caramel", "Nose: Vanilla, oak, light spice", "Sample: 62.5% — target 62.0%"].map((n) => (
            <p key={n} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>• {n}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Check icon ───────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" fill="rgba(200,136,42,0.15)" stroke="rgba(200,136,42,0.4)" strokeWidth="1" />
      <path d="M5 8l2 2 4-4" stroke="#c9952a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "rgba(200,136,42,0.9)" }}>
      {children}
    </p>
  );
}

// ─── Pricing plans ────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    desc: "Perfect for small craft distilleries getting started with digital operations.",
    highlight: false,
    features: [
      "Up to 3 users",
      "Batch & production tracking",
      "Barrel management (up to 50 barrels)",
      "Basic inventory tracking",
      "TTB report generation",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: "$349",
    period: "/mo",
    desc: "The full platform for growing distilleries that need compliance automation and team tools.",
    highlight: true,
    features: [
      "Up to 15 users",
      "Unlimited batch & barrel tracking",
      "Full TTB compliance engine",
      "State excise returns (all 50 states)",
      "COLA & permit management",
      "Sales order & client management",
      "Floor plan & equipment tracking",
      "AI operations assistant",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For multi-site operations, contract distillers, and high-volume producers.",
    highlight: false,
    features: [
      "Unlimited users & sites",
      "Multi-distillery management",
      "Custom integrations & API access",
      "White-label options",
      "Dedicated account manager",
      "SLA & uptime guarantees",
      "On-site onboarding & training",
    ],
  },
];

const FEATURES_GRID = [
  { icon: "🥃", title: "Batch Production", desc: "7-stage workflow from mash to bottling with proof gallon tracking, still logs, and automatic TTB operation categorization at every stage." },
  { icon: "📋", title: "TTB Compliance Engine", desc: "Auto-generate Forms 5110.40 and 5000.24 directly from live production data. Export to the TTB PONL filing system in one click." },
  { icon: "🛢️", title: "Barrel Intelligence", desc: "Track every barrel from fill to dump. Monitor angel's share, proof gallon retention, aging milestones, and warehouse zone locations." },
  { icon: "📑", title: "Regulatory Automation", desc: "Manage COLA registrations, state excise returns, federal permits, and label records — with expiration alerts so nothing slips through." },
  { icon: "📦", title: "Inventory Management", desc: "Real-time lot tracking with movement history, TTB operation categories, proof gallon accounting, and multi-location support." },
  { icon: "💼", title: "Sales & Distribution", desc: "Manage client accounts, sales orders, line items, and fulfillment tracking from the same platform as your production data." },
  { icon: "👥", title: "Team & Staff", desc: "Role-based access for admins, distillers, and staff. Assign crew to jobs, track shifts, and manage permissions with granularity." },
  { icon: "📊", title: "Reports & Analytics", desc: "Month-over-month production trends, excise tax summaries, barrel aging curves, inventory valuations, and exportable TTB data." },
  { icon: "🤖", title: "AI Assistant", desc: "Ask questions about your operation in plain English. Get instant answers about batch status, barrel inventory, compliance deadlines, and more." },
];

const FAQS = [
  { q: "How does Distillr handle TTB compliance?", a: "Every production action you log — mash, distillation, proofing, bottling — is automatically categorized using TTB operation codes. When it's time to file, your Forms 5110.40 and 5000.24 are pre-populated from your actual data. No manual data entry, no spreadsheet math." },
  { q: "Can I migrate my existing data?", a: "Yes. We support CSV import for batches, barrels, and inventory. Most distilleries are fully migrated within a day. Our onboarding team can assist with more complex migrations on Professional and Enterprise plans." },
  { q: "Is my data secure?", a: "All data is encrypted in transit and at rest. Your distillery data is fully isolated — no other tenant can access it. We use SOC 2-compliant infrastructure hosted on Supabase with daily backups." },
  { q: "Do I need to sign a long-term contract?", a: "No. All plans are month-to-month with no lock-in. You can upgrade, downgrade, or cancel at any time. Annual billing is available at a 20% discount." },
  { q: "What states are covered for excise returns?", a: "All 50 states plus the District of Columbia. State excise return rates are maintained by our team and updated whenever states adjust their rates." },
];

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function Landing() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBtn = (label: string, path: string, primary = false) => (
    <button
      onClick={() => navigate(path)}
      className="text-sm font-medium transition-all duration-200"
      style={primary
        ? { background: "#fff", color: "#0a0a0a", padding: "8px 20px", borderRadius: 8, fontWeight: 600, boxShadow: "0 0 20px rgba(255,255,255,0.12)" }
        : { color: "rgba(245,240,232,0.6)", background: "none", border: "none", cursor: "pointer" }}
      onMouseEnter={(e) => { if (!primary) e.currentTarget.style.color = "#f5f0e8"; else e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.25)"; }}
      onMouseLeave={(e) => { if (!primary) e.currentTarget.style.color = "rgba(245,240,232,0.6)"; else e.currentTarget.style.boxShadow = "0 0 20px rgba(255,255,255,0.12)"; }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: "#080808", color: "#f5f0e8", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300"
        style={{ background: scrolled ? "rgba(8,8,8,0.98)" : "rgba(8,8,8,0.7)", backdropFilter: "blur(16px)", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent" }}>
        <button onClick={() => navigate("/")} className="focus:outline-none">
          <Logo />
        </button>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm transition-colors duration-200" style={{ color: "rgba(245,240,232,0.55)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0e8")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.55)")}>Features</a>
          <a href="#pricing" className="text-sm transition-colors duration-200" style={{ color: "rgba(245,240,232,0.55)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0e8")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.55)")}>Pricing</a>
          <a href="#faq" className="text-sm transition-colors duration-200" style={{ color: "rgba(245,240,232,0.55)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0e8")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.55)")}>FAQ</a>
        </div>
        <div className="flex items-center gap-4">
          {navBtn("Sign in", "/login")}
          {navBtn("Get Started Free", "/signup", true)}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden text-center" style={{ minHeight: "100vh", paddingTop: 80 }}>
        <AnimatedBackground />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,8,8,0.72) 0%, rgba(8,8,8,0.52) 40%, rgba(8,8,8,0.92) 100%)" }} />
        <div className="absolute" style={{ width: 800, height: 800, top: "0%", left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(200,136,42,0.06) 0%, transparent 65%)", borderRadius: "50%", filter: "blur(60px)" }} />

        <div className="relative z-10 px-6 py-20 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-medium tracking-widest uppercase"
            style={{ background: "rgba(200,136,42,0.1)", color: "#c9952a", border: "1px solid rgba(200,136,42,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#c9952a" }} />
            Built for Craft Distilleries
          </div>

          <h1 className="font-bold leading-none mb-6" style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)", letterSpacing: "-0.03em", color: "#f5f0e8" }}>
            Run your distillery<br />
            <span style={{ background: "linear-gradient(90deg, #c9952a 0%, #f0c878 40%, #c9952a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              like a modern operation.
            </span>
          </h1>

          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: "rgba(245,240,232,0.55)" }}>
            Distillr is the all-in-one ERP platform for craft distilleries — TTB compliance, batch intelligence, barrel tracking, and regulatory automation in a single system built for how you actually work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => navigate("/signup")} className="px-8 py-4 rounded-xl text-base font-bold transition-all duration-200"
              style={{ background: "#fff", color: "#0a0a0a", boxShadow: "0 0 40px rgba(255,255,255,0.18)", minWidth: 200 }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 60px rgba(255,255,255,0.3)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.18)")}>
              Start Free Trial
            </button>
            <button onClick={() => navigate("/login")} className="px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", color: "#f5f0e8", border: "1px solid rgba(255,255,255,0.12)", minWidth: 200 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}>
              Sign in to your account
            </button>
          </div>

          <p className="text-xs mb-10" style={{ color: "rgba(245,240,232,0.3)" }}>No credit card required · Setup in under 5 minutes · Cancel anytime</p>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden mx-auto max-w-3xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {[
              { val: "7-Stage", label: "Production Workflow" },
              { val: "TTB Ready", label: "Forms 5110.40 + 5000.24" },
              { val: "50 States", label: "Excise Return Coverage" },
              { val: "Real-Time", label: "Proof Gallon Tracking" },
            ].map((s, i, arr) => (
              <div key={s.val} className="flex flex-col items-center py-5 px-4"
                style={{ background: "rgba(255,255,255,0.03)", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <p className="text-sm font-bold mb-0.5" style={{ color: "#fff" }}>{s.val}</p>
                <p className="text-[10px] text-center" style={{ color: "rgba(245,240,232,0.38)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proof bar ── */}
      <div className="py-8 px-6" style={{ background: "rgba(200,136,42,0.04)", borderTop: "1px solid rgba(200,136,42,0.12)", borderBottom: "1px solid rgba(200,136,42,0.12)" }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {["TTB PONL Compatible", "All 50 State Excise Returns", "COLA & Label Management", "Supabase-Backed Data Security", "Real-Time Proof Gallon Accounting", "Role-Based Team Access"].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <Check />
              <span className="text-xs font-medium" style={{ color: "rgba(245,240,232,0.55)" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature Showcase 1: TTB Compliance ── */}
      <section className="py-28 px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <SectionLabel>TTB Compliance Engine</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#f5f0e8", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Stop filing by hand.<br />
              <span style={{ color: "rgba(245,240,232,0.45)" }}>Your data already knows the numbers.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(245,240,232,0.5)" }}>
              Every mash, distillation, proofing, and bottling operation you log is automatically tagged with TTB operation categories. When reporting time comes, your forms are already filled — pulled directly from the production records you've been keeping all month.
            </p>
            <div className="space-y-3 mb-10">
              {[
                "Auto-generates Forms 5110.40 and 5000.24 from live batch data",
                "One-click export to the TTB PONL filing system",
                "Excise tax calculation with CBMA small producer credits",
                "Federal bonded warehouse balance tracking",
                "Audit-ready records retained for 3+ years",
              ].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <Check />
                  <span className="text-sm" style={{ color: "rgba(245,240,232,0.65)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(200,136,42,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
            <MockupTTB />
          </div>
        </div>
      </section>

      {/* ── Feature Showcase 2: Batch Production ── */}
      <section className="py-28 px-6" style={{ background: "rgba(255,255,255,0.012)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="relative md:order-first order-last">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.07) 0%, transparent 70%)", filter: "blur(40px)" }} />
            <MockupBatch />
          </div>
          <div>
            <SectionLabel>Batch Production Tracking</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#f5f0e8", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Every stage logged.<br />
              <span style={{ color: "rgba(245,240,232,0.45)" }}>Every gallon accounted for.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(245,240,232,0.5)" }}>
              Follow each batch through your entire production cycle — from grain-in to bottle-out — with real-time proof gallon tracking at every transition. Distillr knows what stage each batch is in and what's expected next.
            </p>
            <div className="space-y-3 mb-10">
              {[
                "7-stage workflow: Mash → Ferment → Distill → Proof → Age → Filter → Bottle",
                "Proof gallon tracking with automatic TTB operation tagging",
                "Link batches to production records, barrels, and inventory lots",
                "Still logs with ABV, volume, and yield calculations",
                "Batch-level cost and yield analytics",
              ].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <Check />
                  <span className="text-sm" style={{ color: "rgba(245,240,232,0.65)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase 3: Barrel Intelligence ── */}
      <section className="py-28 px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <SectionLabel>Barrel Intelligence</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#f5f0e8", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Your warehouse,<br />
              <span style={{ color: "rgba(245,240,232,0.45)" }}>mapped and monitored.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(245,240,232,0.5)" }}>
              Know exactly what's in every barrel, where it is, and when to dump it. Distillr tracks angel's share evaporation, calculates proof gallon retention, and alerts you to aging milestones — so nothing gets forgotten in the warehouse.
            </p>
            <div className="space-y-3 mb-10">
              {[
                "Individual barrel tracking from fill to dump",
                "Angel's share and proof gallon retention calculations",
                "Warehouse zone and rack location management",
                "Tasting notes, color, and sample records per barrel",
                "Batch and lot linkage for full chain-of-custody",
                "Automated TTB bonded warehouse balance",
              ].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <Check />
                  <span className="text-sm" style={{ color: "rgba(245,240,232,0.65)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(200,136,42,0.07) 0%, transparent 70%)", filter: "blur(40px)" }} />
            <MockupBarrel />
          </div>
        </div>
      </section>

      {/* ── Full Feature Grid ── */}
      <section id="features" className="py-28 px-6" style={{ background: "rgba(255,255,255,0.012)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel>Complete Platform</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}>
              Everything you need, nothing you don't
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(245,240,232,0.45)" }}>
              Distillr replaces the patchwork of spreadsheets, binders, and disconnected tools most distilleries rely on today.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES_GRID.map((f) => (
              <div key={f.title} className="rounded-xl p-6 transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.065)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.13)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.035)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}>
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: "#f5f0e8" }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-28 px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel>Getting Started</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}>
              Up and running in minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {[
              { num: "01", title: "Create your account", desc: "Sign up with your distillery name and email. No credit card, no long onboarding form. Your operations dashboard is ready immediately." },
              { num: "02", title: "Configure your distillery", desc: "Enter your DSP number, products, equipment, and team. Import existing batch or barrel data via CSV. Most distilleries are live the same day." },
              { num: "03", title: "Track, file, and grow", desc: "Log production in real time. Generate TTB reports with one click. Manage compliance deadlines automatically. Let Distillr handle the paperwork." },
            ].map((step, i) => (
              <div key={step.num} className="relative">
                {i < 2 && <div className="hidden md:block absolute top-6 h-px" style={{ left: "calc(3.5rem + 8px)", right: "-50%", background: "linear-gradient(90deg, rgba(200,136,42,0.25) 0%, rgba(200,136,42,0.03) 100%)" }} />}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: "rgba(200,136,42,0.1)", border: "1px solid rgba(200,136,42,0.25)" }}>
                  <span className="text-sm font-bold" style={{ color: "#c9952a" }}>{step.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#f5f0e8" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-28 px-6" style={{ background: "rgba(255,255,255,0.012)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}>
              Simple, transparent pricing
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: "rgba(245,240,232,0.45)" }}>
              Month-to-month, no lock-in. Start free and upgrade when you're ready to scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div key={plan.name} className="rounded-2xl p-8 relative transition-all duration-300"
                style={{
                  background: plan.highlight ? "rgba(200,136,42,0.07)" : "rgba(255,255,255,0.03)",
                  border: plan.highlight ? "1px solid rgba(200,136,42,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: plan.highlight ? "0 0 60px rgba(200,136,42,0.1)" : "none",
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold px-4 py-1 rounded-full" style={{ background: "#c9952a", color: "#000" }}>Most Popular</span>
                  </div>
                )}
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: plan.highlight ? "#c9952a" : "rgba(245,240,232,0.4)" }}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="font-bold" style={{ fontSize: "2.5rem", color: "#f5f0e8", lineHeight: 1 }}>{plan.price}</span>
                  {plan.period && <span className="text-sm mb-1" style={{ color: "rgba(245,240,232,0.4)" }}>{plan.period}</span>}
                </div>
                <p className="text-xs mb-6" style={{ color: "rgba(245,240,232,0.45)", lineHeight: 1.6 }}>{plan.desc}</p>
                <button onClick={() => navigate("/signup")} className="w-full py-3 rounded-xl text-sm font-bold mb-6 transition-all duration-200"
                  style={plan.highlight
                    ? { background: "#c9952a", color: "#000", boxShadow: "0 0 28px rgba(200,136,42,0.35)" }
                    : { background: "rgba(255,255,255,0.07)", color: "#f5f0e8", border: "1px solid rgba(255,255,255,0.12)" }}
                  onMouseEnter={(e) => { if (plan.highlight) e.currentTarget.style.boxShadow = "0 0 40px rgba(200,136,42,0.55)"; else e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                  onMouseLeave={(e) => { if (plan.highlight) e.currentTarget.style.boxShadow = "0 0 28px rgba(200,136,42,0.35)"; else e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}>
                  {plan.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                </button>
                <div className="space-y-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <Check />
                      <span className="text-xs" style={{ color: "rgba(245,240,232,0.6)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs mt-8" style={{ color: "rgba(245,240,232,0.3)" }}>
            All plans include a 14-day free trial. Annual billing available at 20% off.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}>
              Common questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden transition-all duration-200"
                style={{ background: openFaq === i ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 focus:outline-none"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-sm font-semibold" style={{ color: "#f5f0e8" }}>{faq.q}</span>
                  <span className="text-lg flex-shrink-0 transition-transform duration-200" style={{ color: "rgba(245,240,232,0.4)", transform: openFaq === i ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.5)" }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl p-16 text-center overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(200,136,42,0.12) 0%, rgba(180,120,30,0.06) 50%, rgba(200,136,42,0.1) 100%)", border: "1px solid rgba(200,136,42,0.22)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(200,136,42,0.15) 0%, transparent 60%)" }} />
            <div className="relative z-10">
              <p className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: "rgba(200,136,42,0.8)" }}>Start Today</p>
              <h2 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: "#f5f0e8", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                Your distillery deserves<br />better than spreadsheets.
              </h2>
              <p className="text-base mb-10 max-w-lg mx-auto" style={{ color: "rgba(245,240,232,0.5)" }}>
                Join craft distilleries that have replaced manual TTB filings, lost barrel records, and disconnected spreadsheets with a single platform built for how they operate.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => navigate("/signup")} className="px-10 py-4 rounded-xl text-base font-bold transition-all duration-200"
                  style={{ background: "#fff", color: "#0a0a0a", boxShadow: "0 0 48px rgba(255,255,255,0.18)", minWidth: 200 }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 64px rgba(255,255,255,0.32)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 48px rgba(255,255,255,0.18)")}>
                  Start Free Trial
                </button>
                <p className="text-xs" style={{ color: "rgba(245,240,232,0.35)" }}>No credit card · 14-day trial · Cancel anytime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <div className="mb-4"><Logo /></div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(245,240,232,0.35)" }}>
                The complete ERP platform for craft distilleries — from grain to glass, from batch to barrel, from production to TTB filing.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-xs">
              {[
                { heading: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
                { heading: "Account", links: [{ label: "Sign in", path: "/login" }, { label: "Get Started", path: "/signup" }] },
                { heading: "Compliance", links: [{ label: "TTB Forms", href: "#features" }, { label: "State Excise", href: "#features" }, { label: "COLA & Permits", href: "#features" }] },
              ].map((col) => (
                <div key={col.heading}>
                  <p className="font-semibold mb-3" style={{ color: "rgba(245,240,232,0.55)" }}>{col.heading}</p>
                  <div className="space-y-2">
                    {col.links.map((link) => (
                      "path" in link
                        ? <button key={link.label} onClick={() => navigate(link.path!)} className="block transition-colors duration-200" style={{ color: "rgba(245,240,232,0.3)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.7)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.3)")}>{link.label}</button>
                        : <a key={link.label} href={link.href} className="block transition-colors duration-200" style={{ color: "rgba(245,240,232,0.3)", textDecoration: "none" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.7)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.3)")}>{link.label}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px]" style={{ color: "rgba(245,240,232,0.2)" }}>&copy; {new Date().getFullYear()} Distillr. Built for craft distillers.</p>
            <p className="text-[10px]" style={{ color: "rgba(245,240,232,0.2)" }}>All data encrypted · SOC 2-compliant infrastructure</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
