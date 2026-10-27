import { type ReactNode } from "react";
import { Link } from "wouter";
import { DistillrLogo, DistillrMark } from "../brand/logo";
import "./public.css";

const AUTH_CSS = `
.auth { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); background: var(--paper); }
.auth__panel { position: relative; overflow: hidden; background: var(--night); color: #fff; display: flex; flex-direction: column; justify-content: space-between; padding: 40px 48px; }
.auth__panel::before { content: ""; position: absolute; inset: 0; background: radial-gradient(720px 420px at 20% 0%, rgba(129,140,248,0.35), transparent 60%), radial-gradient(520px 360px at 100% 100%, rgba(79,70,229,0.35), transparent 60%); pointer-events: none; }
.auth__panel > * { position: relative; }
.auth__bars { display: grid; gap: 14px; width: 220px; margin: 48px 0 32px; }
.auth__bars span { display: block; height: 22px; border-radius: 100px; background: var(--indigo-light); animation: pub-bars 4s ease-in-out infinite; }
.auth__panel h2 { font-size: clamp(1.8rem, 3vw, 2.6rem); font-weight: 800; line-height: 1.08; margin: 0 0 14px; }
.auth__panel p { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.62); max-width: 420px; margin: 0; }
.auth__quote { border-left: 2px solid var(--indigo-light); padding-left: 16px; font-size: 13.5px; color: rgba(255,255,255,0.7); }
.auth__form { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; }
.auth__card { width: 100%; max-width: 420px; }
.auth__card h1 { font-size: 26px; font-weight: 800; margin: 24px 0 6px; color: var(--ink); }
.auth__sub { font-size: 14px; color: var(--ink-soft); margin: 0 0 28px; }
.auth__label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-soft); margin: 0 0 6px; letter-spacing: 0.01em; }
.auth__field { margin-bottom: 16px; }
.auth__input { width: 100%; height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--paper-edge); background: #fff; color: var(--ink); font-size: 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit; }
textarea.auth__input { height: auto; padding: 12px 14px; resize: vertical; }
select.auth__input { appearance: none; }
.auth__input::placeholder { color: var(--ink-muted); }
.auth__input:focus { border-color: var(--indigo); box-shadow: 0 0 0 4px rgba(79,70,229,0.14); }
.auth__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.auth__error { font-size: 13px; color: #B91C1C; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; }
.auth__foot { margin-top: 22px; font-size: 13px; color: var(--ink-soft); text-align: center; }
.auth__foot a, .auth__foot button { color: var(--indigo); font-weight: 600; text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-weight: 600; }
.auth__legal { margin-top: 28px; font-size: 11.5px; color: var(--ink-muted); text-align: center; }
.auth__legal a { color: var(--ink-soft); }
.auth__eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: 0; cursor: pointer; color: var(--ink-muted); padding: 6px; border-radius: 8px; }
.auth__eye:hover { color: var(--ink); background: var(--paper); }
@media (max-width: 900px) {
  .auth { grid-template-columns: 1fr; }
  .auth__panel { display: none; }
  .auth__form { padding: 40px 20px; }
}
`;

export function AuthShell({ children, panelTitle, panelText, quote }: { children: ReactNode; panelTitle: string; panelText: string; quote?: string }) {
  return (
    <div className="pub">
      <style>{AUTH_CSS}</style>
      <div className="auth">
        <aside className="auth__panel">
          <Link href="/" aria-label="Distillr home">
            <DistillrLogo variant="reversed" height={30} />
          </Link>
          <div>
            <div className="auth__bars" aria-hidden>
              <span style={{ width: "100%" }} />
              <span style={{ width: "68%", marginLeft: "16%", opacity: 0.75, animationDelay: "0.6s" }} />
              <span style={{ width: "32%", marginLeft: "34%", opacity: 0.5, animationDelay: "1.2s" }} />
            </div>
            <h2>{panelTitle}</h2>
            <p>{panelText}</p>
          </div>
          {quote ? <p className="auth__quote">{quote}</p> : <span />}
        </aside>
        <main className="auth__form">
          <div className="auth__card pub-rise">
            <DistillrMark size={34} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
