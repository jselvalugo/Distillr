import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const FEATURES = [
  { label: "Batch Intelligence", desc: "7-stage production workflow with real-time proof gallon tracking" },
  { label: "TTB Compliance Engine", desc: "Auto-generated Forms 5110.40 and 5000.24 from live batch data" },
  { label: "Barrel Analytics", desc: "Angel's share monitoring, aging curves, and bonded storage balance" },
  { label: "Regulatory Automation", desc: "COLA tracking, state excise returns, permit renewal alerts" },
];

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

      // Draw connections
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

      // Draw particles
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

export default function Login() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    const t = setInterval(() => setActiveFeature((i) => (i + 1) % FEATURES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080808" }}>

      {/* Left panel — hero */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        <AnimatedBackground />

        {/* Dark overlay gradient */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(8,8,8,0.88) 0%, rgba(15,15,15,0.72) 50%, rgba(8,8,8,0.92) 100%)" }}
        />

        {/* White glow orbs */}
        <div
          className="absolute"
          style={{
            width: 600, height: 600,
            top: "10%", left: "15%",
            background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 300, height: 300,
            bottom: "20%", right: "10%",
            background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(30px)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-14">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-auto">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2a2a2a, #000000)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z"
                  stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                <path d="M8 6V10M6 8H10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Distillr</span>
          </div>

          {/* Main copy */}
          <div className="mb-14">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium tracking-widest uppercase"
              style={{ background: "rgba(255,255,255,0.08)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
              Distillery Technology Platform
            </div>

            <h1 className="text-5xl font-bold leading-tight mb-5" style={{ color: "#f5f0e8" }}>
              Craft spirit<br />
              <span style={{ background: "linear-gradient(90deg, #ffffff, #a0a0a0, #ffffff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                operations,
              </span>
              <br />reimagined.
            </h1>

            <p className="text-base leading-relaxed max-w-md" style={{ color: "rgba(245,240,232,0.55)" }}>
              From grain to glass — manage every stage of production with precision tooling built for TTB compliance, barrel intelligence, and craft distillery scale.
            </p>
          </div>

          {/* Rotating feature highlight */}
          <div
            className="rounded-xl p-5 mb-8"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
          >
            <div className="flex gap-2 mb-4">
              {FEATURES.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setActiveFeature(i)}
                  className="h-0.5 flex-1 rounded-full cursor-pointer transition-all duration-500"
                  style={{ background: i === activeFeature ? "#ffffff" : "rgba(255,255,255,0.12)" }}
                />
              ))}
            </div>
            <p className="text-xs font-semibold mb-1" style={{ color: "#ffffff", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {FEATURES[activeFeature].label}
            </p>
            <p className="text-sm" style={{ color: "rgba(245,240,232,0.65)" }}>
              {FEATURES[activeFeature].desc}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { val: "7-Stage", label: "Production Workflow" },
              { val: "TTB", label: "5110.40 + 5000.24" },
              { val: "Real-Time", label: "Proof Gallon Calc" },
            ].map((s) => (
              <div key={s.val}>
                <p className="text-xl font-bold" style={{ color: "#ffffff" }}>{s.val}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(245,240,232,0.4)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="w-full lg:w-[440px] flex flex-col items-center justify-center px-8 py-12 relative"
        style={{ background: "#0d0d0d", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Top subtle glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: 300, height: 200,
            background: "radial-gradient(ellipse, rgba(200,136,42,0.1) 0%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2a2a2a, #000000)" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4L8 1Z"
                  stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span className="text-white font-bold tracking-tight">Distillr</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: "#f5f0e8" }}>Welcome back</h2>
            <p className="text-sm" style={{ color: "rgba(245,240,232,0.4)" }}>
              Sign in to your operations dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "rgba(245,240,232,0.6)" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@distillery.com"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f5f0e8",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(200,136,42,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "rgba(245,240,232,0.6)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f5f0e8",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(200,136,42,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all mt-2"
              style={{
                background: login.isPending ? "rgba(255,255,255,0.5)" : "#ffffff",
                color: "#0a0a0a",
                opacity: login.isPending ? 0.7 : 1,
                cursor: login.isPending ? "not-allowed" : "pointer",
                boxShadow: login.isPending ? "none" : "0 0 24px rgba(255,255,255,0.12)",
              }}
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs" style={{ color: "rgba(245,240,232,0.2)" }}>secure access</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "⚡", label: "Real-time sync", sub: "Live batch updates" },
              { icon: "🔐", label: "Role-based access", sub: "Admin & staff tiers" },
              { icon: "📊", label: "TTB reporting", sub: "Auto-generated filings" },
              { icon: "🥃", label: "Craft-first design", sub: "Built for distillers" },
            ].map((b) => (
              <div
                key={b.label}
                className="rounded-lg p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(245,240,232,0.7)" }}>
                  {b.label}
                </p>
                <p className="text-[10px]" style={{ color: "rgba(245,240,232,0.3)" }}>{b.sub}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] mt-8" style={{ color: "rgba(245,240,232,0.2)" }}>
            Distillr — Distillery Technology Platform &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
