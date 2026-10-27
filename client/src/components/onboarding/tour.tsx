import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { SafeUser } from "@shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { DistillrLogo, DistillrMark } from "../brand/logo";

/**
 * First-login welcome + a short guided tour.
 *
 * Steps anchor to elements tagged with `data-tour="<id>"` in the app shell.
 * Completion is stored on the user (POST /api/auth/onboarding) so the tour
 * shows once per person, on any device. `window.dispatchEvent(new Event(
 * "distillr:replay-tour"))` starts it again on demand (User menu → Take the tour).
 */

type Step = {
  target: string;
  title: string;
  body: string;
  /** Route the step needs; the tour navigates there before measuring. */
  route?: string;
  /** Open the launchpad popover for this step so the user sees it. */
  openLaunchpad?: boolean;
  /** Prefer the panel on this side of the target. */
  place?: "below" | "above" | "left" | "right";
};

const STEPS: Step[] = [
  {
    target: "launchpad-panel",
    route: "/",
    openLaunchpad: true,
    title: "The Launchpad",
    body: "Every part of Distillr starts here — the grid icon at the top left opens it. Pick a category (Operations, Compliance, Sales, Admin…) and you'll land on its first page.",
    place: "right",
  },
  {
    target: "category-nav",
    route: "/production",
    title: "Pages in a category",
    body: "Once you're inside a category, its pages sit in this thin bar. The underline follows you so you always know where you are.",
    place: "below",
  },
  {
    target: "dashboard-home",
    route: "/",
    title: "Your dashboard",
    body: "This icon brings you back to the overview: active batches, proof gallons, cases and sales for the month. Step through months with the arrows, or press Customize to rearrange the widgets.",
    place: "below",
  },
  {
    target: "ai-assistant",
    route: "/",
    title: "Ask Distillr",
    body: "Stuck on a TTB question or want a quick number? The assistant answers from your own batches, barrels and inventory.",
    place: "left",
  },
  {
    target: "user-menu",
    route: "/",
    title: "Your account",
    body: "Settings live here: company info, your logo and colors, a light or dark dashboard, and your team. You can replay this tour from the same menu anytime.",
    place: "below",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;

function measure(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

function setLaunchpad(open: boolean) {
  const btn = document.querySelector<HTMLButtonElement>('[data-tour="launchpad"]');
  if (!btn) return;
  const isOpen = btn.getAttribute("aria-expanded") === "true";
  if (isOpen !== open) btn.click();
}

export function OnboardingTour() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [location, navigate] = useLocation();
  const [phase, setPhase] = useState<"idle" | "welcome" | "tour" | "done">("idle");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [startedFor, setStartedFor] = useState<string | null>(null);

  // Show once per user: when the server has no onboardedAt for them.
  const userId = user?.id ?? null;
  const needsTour = !!user && !user.onboardedAt;
  useEffect(() => {
    if (!userId || !needsTour || startedFor === userId) return;
    const t = setTimeout(() => { setStartedFor(userId); setPhase("welcome"); }, 600);
    return () => clearTimeout(t);
  }, [userId, needsTour, startedFor]);

  // Replay from the user menu.
  useEffect(() => {
    const replay = () => { setStep(0); setPhase("welcome"); };
    window.addEventListener("distillr:replay-tour", replay);
    return () => window.removeEventListener("distillr:replay-tour", replay);
  }, []);

  const finish = useCallback(async () => {
    setLaunchpad(false);
    setPhase("idle");
    try {
      const { onboardedAt } = await apiRequest<{ onboardedAt: string | null }>("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({ done: true }),
      });
      qc.setQueryData<SafeUser | null>(["/api/auth/me"], (u) => (u ? { ...u, onboardedAt } : u));
    } catch {
      /* best effort — the tour simply shows again next login */
    }
  }, [qc]);

  // Make sure the current step's page and launchpad state are right, then measure.
  const current = STEPS[step];
  useEffect(() => {
    if (phase !== "tour") return;
    if (current.route && location !== current.route) {
      navigate(current.route);
      return;
    }
    setLaunchpad(!!current.openLaunchpad);
  }, [phase, step, location, current, navigate]);

  useLayoutEffect(() => {
    if (phase !== "tour") return;
    let raf = 0;
    let tries = 0;
    const tick = () => {
      const r = measure(current.target);
      if (r) setRect(r);
      else if (tries++ < 60) raf = requestAnimationFrame(tick); // wait for the page/popover to mount
      else setRect(null);
    };
    tick();
    const onResize = () => { const r = measure(current.target); if (r) setRect(r); };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [phase, step, location, current.target]);

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      if (phase === "tour" && e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (phase === "tour" && e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function next() {
    if (step >= STEPS.length - 1) { setLaunchpad(false); setPhase("done"); return; }
    setStep((s) => s + 1);
  }
  function back() {
    if (step === 0) { setLaunchpad(false); setPhase("welcome"); return; }
    setStep((s) => s - 1);
  }

  if (phase === "idle" || !user) return null;
  const firstName = user.name?.split(" ")[0] || "there";

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Welcome to Distillr">
      {phase === "welcome" && (
        <div className="tour-scrim tour-scrim--solid">
          <div className="tour-card tour-card--welcome tour-rise">
            <DistillrMark size={40} />
            <p className="tour-eyebrow">Welcome</p>
            <h2 className="tour-h">Hi {firstName}, welcome to Distillr.</h2>
            <p className="tour-p">
              Everything from mash to TTB filing lives here. A 60-second tour shows you how to get around — the Launchpad, the dashboard, and where to find your settings.
            </p>
            <ul className="tour-list">
              <li><Check size={14} /> Find any page in two clicks</li>
              <li><Check size={14} /> Read the dashboard at a glance</li>
              <li><Check size={14} /> Brand the workspace for your team</li>
            </ul>
            <div className="tour-actions">
              <button className="tour-btn tour-btn--primary" onClick={() => { setStep(0); setPhase("tour"); }} autoFocus>
                Take the tour <ArrowRight size={15} />
              </button>
              <button className="tour-btn tour-btn--ghost" onClick={finish}>Skip for now</button>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="tour-scrim tour-scrim--solid">
          <div className="tour-card tour-card--welcome tour-rise">
            <div className="tour-done-mark"><Check size={22} strokeWidth={2.5} /></div>
            <h2 className="tour-h">You're all set.</h2>
            <p className="tour-p">
              Head to Operations → Production to log your first batch, or open Reports when you're ready to file. You can replay this tour from your account menu.
            </p>
            <div className="tour-actions">
              <button className="tour-btn tour-btn--primary" onClick={finish} autoFocus>Start using Distillr</button>
            </div>
            <p className="tour-foot"><DistillrLogo height={14} /></p>
          </div>
        </div>
      )}

      {phase === "tour" && (
        <>
          {/* Spotlight: the target rect stays clear, the box-shadow dims everything else. */}
          {rect ? (
            <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
          ) : (
            <div className="tour-scrim" />
          )}
          <StepPanel rect={rect} step={step} total={STEPS.length} data={current} onNext={next} onBack={back} onSkip={finish} />
        </>
      )}
    </div>,
    document.body,
  );
}

function StepPanel({ rect, step, total, data, onNext, onBack, onSkip }: {
  rect: Rect | null; step: number; total: number; data: Step; onNext: () => void; onBack: () => void; onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: "up" | "down" | "right" | "left" | "none"; arrowX: number }>({ top: 80, left: 24, arrow: "none", arrowX: 24 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, gap = 14, m = 12;
    if (!rect) { setPos({ top: Math.max(m, (vh - h) / 2), left: Math.max(m, (vw - w) / 2), arrow: "none", arrowX: 0 }); return; }
    const cx = rect.left + rect.width / 2;
    let left = Math.min(Math.max(m, cx - w / 2), vw - w - m);
    let top: number; let arrow: typeof pos.arrow;
    if (data.place === "left" && rect.left - gap - w >= m) {
      left = rect.left - gap - w; top = Math.min(Math.max(m, rect.top + rect.height / 2 - h / 2), vh - h - m); arrow = "right";
    } else if (data.place === "right" && rect.left + rect.width + gap + w <= vw - m) {
      left = rect.left + rect.width + gap; top = Math.min(Math.max(m, rect.top + 8), vh - h - m); arrow = "left";
    } else if (data.place === "above" && rect.top - gap - h >= m) {
      top = rect.top - gap - h; arrow = "down";
    } else if (rect.top + rect.height + gap + h <= vh - m) {
      top = rect.top + rect.height + gap; arrow = "up";
    } else if (rect.top - gap - h >= m) {
      top = rect.top - gap - h; arrow = "down";
    } else {
      top = Math.max(m, vh - h - m); arrow = "none";
    }
    const arrowX = arrow === "right" || arrow === "left" ? 0 : Math.min(Math.max(18, cx - left), w - 18);
    setPos({ top, left, arrow, arrowX });
  }, [rect, data, step]);

  return (
    <div ref={ref} className={`tour-card tour-card--step tour-rise tour-arrow-${pos.arrow}`} style={{ top: pos.top, left: pos.left, ["--arrow-x" as string]: `${pos.arrowX}px` }} key={step}>
      <div className="tour-step-head">
        <span className="tour-eyebrow">Step {step + 1} of {total}</span>
        <button className="tour-x" onClick={onSkip} aria-label="Skip tour"><X size={14} /></button>
      </div>
      <h3 className="tour-h tour-h--sm">{data.title}</h3>
      <p className="tour-p">{data.body}</p>
      <div className="tour-step-foot">
        <div className="tour-dots" aria-hidden>
          {Array.from({ length: total }).map((_, i) => <span key={i} className={i === step ? "is-on" : i < step ? "is-past" : ""} />)}
        </div>
        <div className="tour-nav">
          <button className="tour-btn tour-btn--ghost tour-btn--sm" onClick={onBack}><ArrowLeft size={14} /> Back</button>
          <button className="tour-btn tour-btn--primary tour-btn--sm" onClick={onNext} autoFocus>
            {step === total - 1 ? "Finish" : "Next"} {step === total - 1 ? <Check size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
