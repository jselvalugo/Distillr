import { Link } from "wouter";
import { PublicShell } from "./shell";

export interface LegalSection {
  title: string;
  body: string;
}

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Acceptable Use", href: "/acceptable-use" },
];

/** Renders a legal document: lines starting with "•" become bullets, **bold** is honored. */
export function LegalPage({ title, lastUpdated, intro, sections, current }: { title: string; lastUpdated: string; intro: string; sections: LegalSection[]; current: string }) {
  return (
    <PublicShell>
      <div className="pub-legal-hero">
        <p className="pub-eyebrow">Legal</p>
        <h1>{title}</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>Last updated: {lastUpdated}</p>
      </div>
      <div className="pub-legal">
        <p className="pub-legal__intro">{intro}</p>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 40 }}>
            <h2>{s.title}</h2>
            <div className="pub-legal__body">
              {s.body.split("\n").map((line, j) => {
                if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
                const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/^•\s/, "");
                return line.startsWith("•") ? (
                  <div key={j} className="pub-legal__bullet">
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                ) : (
                  <p key={j} style={{ margin: "0 0 8px" }} dangerouslySetInnerHTML={{ __html: html }} />
                );
              })}
            </div>
            {i < sections.length - 1 && <div style={{ height: 1, background: "#E2E8F0", marginTop: 40 }} />}
          </div>
        ))}
        <div className="pub-legal__nav">
          <Link href="/" className="pub-link">
            ← Back to home
          </Link>
          <div style={{ display: "flex", gap: 20 }}>
            {LEGAL_LINKS.filter((l) => l.href !== current).map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
