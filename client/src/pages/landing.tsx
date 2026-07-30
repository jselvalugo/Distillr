import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

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

    function resize() {
      w = canvas!.width  = canvas!.offsetWidth;
      h = canvas!.height = canvas!.offsetHeight;
    }

    function init() {
      resize();
      particles.length = 0;
      const count = Math.floor((w * h) / 14000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.4 + 0.1,
        });
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(255,255,255,${0.12 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    init();
    draw();

    const ro = new ResizeObserver(init);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}

const FEATURES = [
  {
    icon: "🥃",
    title: "Batch Production",
    desc: "7-stage workflow from mash to bottling with real-time proof gallon tracking at every step.",
  },
  {
    icon: "📋",
    title: "TTB Compliance",
    desc: "Auto-generated Forms 5110.40 and 5000.24 pulled directly from live production data.",
  },
  {
    icon: "🛢️",
    title: "Barrel Intelligence",
    desc: "Aging analytics, angel's share monitoring, and bonded storage balance at a glance.",
  },
  {
    icon: "📑",
    title: "Regulatory Automation",
    desc: "COLA tracking, state excise returns, and permit renewal alerts — all in one place.",
  },
  {
    icon: "📦",
    title: "Inventory Management",
    desc: "Real-time lot tracking, movements, and warehouse location management across your facility.",
  },
  {
    icon: "💼",
    title: "Sales & Distribution",
    desc: "Order management, client accounts, and fulfillment tracking from the same platform.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Create your account",
    desc: "Sign up in minutes, no credit card required. Your distillery profile is ready immediately.",
  },
  {
    num: "02",
    title: "Set up your distillery",
    desc: "Configure your DSP details, products, equipment, and team roles in a guided setup flow.",
  },
  {
    num: "03",
    title: "Start tracking",
    desc: "Log batches, manage barrels, and generate TTB reports automatically from day one.",
  },
];

const STATS = [
  { val: "7-Stage", label: "Production Workflow" },
  { val: "TTB Compliant", label: "5110.40 + 5000.24" },
  { val: "Real-Time", label: "Inventory Tracking" },
  { val: "Multi-Distillery", label: "Multi-site Support" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #2a2a2a, #000000)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M8 6V10M6 8H10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-white font-bold text-lg tracking-tight">Distillr</span>
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#080808", color: "#f5f0e8", minHeight: "100vh" }}>

      {/* ── Sticky Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(8,8,8,0.97)" : "rgba(8,8,8,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button onClick={() => navigate("/")} className="focus:outline-none">
          <Logo />
        </button>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium transition-colors duration-200"
            style={{ color: "rgba(245,240,232,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0e8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.6)")}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: "#ffffff",
              color: "#0a0a0a",
              boxShadow: "0 0 20px rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 28px rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 20px rgba(255,255,255,0.1)")}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100vh", paddingTop: "80px" }}
      >
        <AnimatedBackground />

        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,8,8,0.75) 0%, rgba(8,8,8,0.55) 50%, rgba(8,8,8,0.90) 100%)",
          }}
        />

        {/* Glow orbs */}
        <div
          className="absolute"
          style={{
            width: 700,
            height: 700,
            top: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center px-6 py-24 max-w-4xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-medium tracking-widest uppercase"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
            Distillery Technology Platform
          </div>

          {/* H1 */}
          <h1
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
            style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}
          >
            From grain to glass,
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #ffffff, #a0a0a0, #ffffff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              managed with precision.
            </span>
          </h1>

          {/* Sub */}
          <p
            className="text-lg leading-relaxed max-w-2xl mb-10"
            style={{ color: "rgba(245,240,232,0.55)" }}
          >
            The complete operations platform for craft distilleries — TTB compliance, batch
            intelligence, barrel tracking, and regulatory automation in one system.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <button
              onClick={() => navigate("/signup")}
              className="px-8 py-4 rounded-lg text-base font-semibold transition-all duration-200"
              style={{
                background: "#ffffff",
                color: "#0a0a0a",
                boxShadow: "0 0 32px rgba(255,255,255,0.15)",
                minWidth: 180,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 44px rgba(255,255,255,0.28)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 32px rgba(255,255,255,0.15)")}
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-4 rounded-lg text-base font-semibold transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#f5f0e8",
                border: "1px solid rgba(255,255,255,0.15)",
                minWidth: 180,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              }}
            >
              Sign in
            </button>
          </div>

          {/* Stat Row */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px w-full max-w-2xl rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.val}
                className="flex flex-col items-center py-4 px-3"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                <p className="text-sm font-bold" style={{ color: "#ffffff" }}>
                  {s.val}
                </p>
                <p className="text-[10px] mt-0.5 text-center" style={{ color: "rgba(245,240,232,0.4)" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section
        className="py-24 px-6"
        style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: "rgba(200,136,42,0.85)" }}
            >
              Platform Capabilities
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}
            >
              Everything your distillery needs
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(245,240,232,0.45)" }}>
              From production floors to TTB filings, every workflow your craft operation relies on —
              built into a single, cohesive platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl p-6 transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-semibold mb-2" style={{ color: "#f5f0e8" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        className="py-24 px-6"
        style={{
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ color: "rgba(200,136,42,0.85)" }}
            >
              Getting Started
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold"
              style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}
            >
              Up and running in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex flex-col">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-6 left-full w-full h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
                      width: "calc(100% - 3rem)",
                      left: "calc(3rem + 12px)",
                    }}
                  />
                )}

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span className="text-sm font-bold" style={{ color: "rgba(245,240,232,0.7)" }}>
                    {step.num}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#f5f0e8" }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-2xl p-16 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(180,120,30,0.15) 0%, rgba(200,136,42,0.08) 50%, rgba(180,120,30,0.12) 100%)",
              border: "1px solid rgba(200,136,42,0.2)",
            }}
          >
            {/* Subtle inner glow */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 50% 0%, rgba(200,136,42,0.08) 0%, transparent 60%)",
              }}
            />

            <h2
              className="text-4xl md:text-5xl font-bold mb-4 relative"
              style={{ color: "#f5f0e8", letterSpacing: "-0.02em" }}
            >
              Ready to modernize
              <br />your operations?
            </h2>
            <p
              className="text-base mb-10 max-w-md mx-auto relative"
              style={{ color: "rgba(245,240,232,0.5)" }}
            >
              Join craft distilleries using Distillr to manage production, compliance, and growth —
              no credit card required.
            </p>
            <button
              onClick={() => navigate("/signup")}
              className="relative px-10 py-4 rounded-lg text-base font-semibold transition-all duration-200"
              style={{
                background: "#ffffff",
                color: "#0a0a0a",
                boxShadow: "0 0 40px rgba(255,255,255,0.15)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 56px rgba(255,255,255,0.3)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.15)")}
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-10 px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Logo />
            <p className="text-xs" style={{ color: "rgba(245,240,232,0.25)" }}>
              &copy; 2025 Distillr. Built for craft distillers.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/login")}
              className="text-xs transition-colors duration-200"
              style={{ color: "rgba(245,240,232,0.35)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.35)")}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="text-xs transition-colors duration-200"
              style={{ color: "rgba(245,240,232,0.35)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,232,0.35)")}
            >
              Get Started
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
