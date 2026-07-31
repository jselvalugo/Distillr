import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const CREAM = "#FAF0E2";
const NAVY = "#0F1B42";

const NAV_STYLES = `
  @keyframes slidedown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

  .lnd-nav-link {
    font-size: 13px;
    color: ${NAVY};
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
  }
  .lnd-nav-link:hover { background: rgba(15,27,66,0.08); }

  .lnd-btn-signin {
    background: transparent;
    color: ${NAVY};
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 8px;
    transition: background 0.15s;
    line-height: 1;
  }
  .lnd-btn-signin:hover { background: rgba(15,27,66,0.08); }

  .lnd-btn-getstarted {
    background: ${NAVY};
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    padding: 9px 20px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s;
    line-height: 1;
  }
  .lnd-btn-getstarted:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,27,66,0.3); }

  .lnd-btn-primary {
    background: ${NAVY};
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 11px 26px;
    border-radius: 100px;
    transition: transform 0.18s, box-shadow 0.18s;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .lnd-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(15,27,66,0.28); }

  .lnd-nav-links { display: flex; align-items: center; }
  .lnd-nav-ctas  { display: flex; align-items: center; gap: 4px; }
  .lnd-hamburger { display: none; }
  .lnd-mobile-menu { display: none; }

  @media (max-width: 767px) {
    .lnd-nav-links { display: none !important; }
    .lnd-nav-ctas  { display: none !important; }
    .lnd-hamburger { display: flex !important; }
    .lnd-mobile-menu { display: flex !important; }
  }
`;

function WordMark({ color = NAVY }: { color?: string }) {
  return (
    <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 22, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
      Distillr
    </span>
  );
}

const navLinks = [
  { l: "Features", h: "/features" },
  { l: "Pricing", h: "/pricing" },
  { l: "FAQ", h: "/faq" },
];

export function LandingNav() {
  const [location, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      const fn = () => setMobileMenuOpen(false);
      window.addEventListener("scroll", fn, { passive: true, once: true });
      return () => window.removeEventListener("scroll", fn);
    }
  }, [mobileMenuOpen]);

  return (
    <>
      <style>{NAV_STYLES}</style>

      {/* ── STICKY NAV ── */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        height: 64,
        background: scrolled ? `${CREAM}ee` : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? `1px solid rgba(15,27,66,0.1)` : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}>
        {/* Left: logo */}
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <WordMark color={NAVY} />
        </button>

        {/* Center: nav links */}
        <div className="lnd-nav-links" style={{ gap: 2 }}>
          {navLinks.map((n) => {
            const isActive = location === n.h;
            return (
              <button
                key={n.l}
                onClick={() => navigate(n.h)}
                style={{
                  background: isActive ? NAVY : "transparent",
                  color: isActive ? CREAM : NAVY,
                  borderRadius: isActive ? 100 : 8,
                  padding: isActive ? "6px 18px" : "6px 14px",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,27,66,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                {n.l}
              </button>
            );
          })}
        </div>

        {/* Right: CTA buttons */}
        <div className="lnd-nav-ctas">
          <button onClick={() => navigate("/login")} className="lnd-btn-signin">Log in</button>
          <button onClick={() => navigate("/signup")} className="lnd-btn-getstarted">Get started free</button>
        </div>

        {/* Hamburger */}
        <button
          className="lnd-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: "none",
            border: `1px solid rgba(15,27,66,0.18)`,
            cursor: "pointer",
            padding: "8px 10px",
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            flexDirection: "column",
          }}
        >
          <span style={{ display: "block", width: 18, height: 1.5, background: NAVY, borderRadius: 2, transition: "transform .2s", transform: mobileMenuOpen ? "translateY(3.5px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: 18, height: 1.5, background: NAVY, borderRadius: 2, transition: "opacity .2s", opacity: mobileMenuOpen ? 0 : 1 }} />
          <span style={{ display: "block", width: 18, height: 1.5, background: NAVY, borderRadius: 2, transition: "transform .2s", transform: mobileMenuOpen ? "translateY(-3.5px) rotate(-45deg)" : "none" }} />
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      {mobileMenuOpen && (
        <div
          className="lnd-mobile-menu"
          style={{
            position: "fixed",
            top: 64,
            left: 0,
            right: 0,
            zIndex: 99,
            background: `${CREAM}f5`,
            backdropFilter: "blur(16px)",
            borderBottom: `1px solid rgba(15,27,66,0.12)`,
            flexDirection: "column",
            padding: "12px 16px 20px",
            animation: "slidedown 0.18s ease-out both",
            boxShadow: "0 12px 32px rgba(15,27,66,0.12)",
          }}
        >
          {navLinks.map((n) => {
            const isActive = location === n.h;
            return (
              <button
                key={n.l}
                onClick={() => { navigate(n.h); setMobileMenuOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  fontSize: 15,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? `rgba(15,27,66,0.08)` : "transparent",
                  color: NAVY,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                {n.l}
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(15,27,66,0.1)", margin: "8px 8px" }} />
          <button
            onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}
            style={{ width: "100%", padding: "13px 16px", borderRadius: 10, background: "transparent", border: `1px solid rgba(15,27,66,0.18)`, color: NAVY, cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: "left" }}
          >
            Log in
          </button>
          <button
            onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }}
            className="lnd-btn-primary"
            style={{ width: "100%", padding: "13px 16px", borderRadius: 10, textAlign: "center" }}
          >
            Get started free
          </button>
        </div>
      )}
    </>
  );
}
