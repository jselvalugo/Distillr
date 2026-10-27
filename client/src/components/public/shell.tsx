import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { DistillrLogo, DistillrMark } from "../brand/logo";
import "./public.css";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
];

export function PublicNav() {
  const [location, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => setOpen(false), [location]);

  return (
    <>
      <nav className={`pub-nav ${scrolled || open ? "pub-nav--scrolled" : ""}`}>
        <div className="pub-wrap pub-nav__inner">
          <Link href="/" aria-label="Distillr home" style={{ display: "flex", alignItems: "center" }}>
            <DistillrLogo height={28} />
          </Link>
          <div className="pub-nav__links">
            {NAV_LINKS.map((n) => (
              <Link key={n.href} href={n.href} className={`pub-nav__link ${location === n.href ? "pub-nav__link--active" : ""}`}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="pub-nav__ctas">
            <Link href="/login" className="pub-nav__link">
              Log in
            </Link>
            <button className="pub-btn pub-btn--primary pub-btn--sm" onClick={() => navigate("/signup")}>
              Get started free
            </button>
          </div>
          <button className="pub-nav__burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span style={{ transform: open ? "translateY(5.6px) rotate(45deg)" : undefined }} />
            <span style={{ opacity: open ? 0 : 1 }} />
            <span style={{ transform: open ? "translateY(-5.6px) rotate(-45deg)" : undefined }} />
          </button>
        </div>
      </nav>
      {open && (
        <div className="pub-nav__mobile">
          {NAV_LINKS.map((n) => (
            <Link key={n.href} href={n.href} className={`pub-nav__link ${location === n.href ? "pub-nav__link--active" : ""}`}>
              {n.label}
            </Link>
          ))}
          <Link href="/login" className="pub-nav__link">
            Log in
          </Link>
          <button className="pub-btn pub-btn--primary" style={{ marginTop: 8 }} onClick={() => navigate("/signup")}>
            Get started free
          </button>
        </div>
      )}
    </>
  );
}

export function PublicFooter() {
  const [, navigate] = useLocation();
  return (
    <footer className="pub-footer">
      <div className="pub-wrap">
        <div className="pub-footer__top">
          <div>
            <DistillrLogo variant="reversed" height={26} />
            <p className="pub-footer__tag">The operations platform for craft distilleries — from grain to glass to TTB.</p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><Link href="/features">Features</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              <li><button className="pub-footer__link" onClick={() => navigate("/login")}>Log in</button></li>
              <li><button className="pub-footer__link" onClick={() => navigate("/signup")}>Request access</button></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/acceptable-use">Acceptable Use</Link></li>
            </ul>
          </div>
        </div>
        <div className="pub-footer__bottom">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <DistillrMark variant="reversed" size={14} />© {new Date().getFullYear()} Distillr · A Loogo Labs Software
          </span>
          <span>Built for Distilled Spirits Plants in the United States.</span>
        </div>
      </div>
    </footer>
  );
}

/** Wraps every public (marketing + legal) page: brand theme, nav and footer. */
export function PublicShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="pub">
      <PublicNav />
      {children}
      {footer && <PublicFooter />}
    </div>
  );
}
