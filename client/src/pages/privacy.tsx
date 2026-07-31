import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const NAVY = "#0F1B42";
const CREAM = "#FAF0E2";
const LAST_UPDATED = "July 31, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: `We collect information you provide directly when you create an account, use the platform, or contact us. This includes:

• **Account information** — name, email address, company name, state, and password when you register.
• **Distillery operational data** — batch records, barrel inventories, TTB reports, excise tax filings, production records, and other data you enter into the platform.
• **Waitlist submissions** — name, email, distillery name, state, and optional message when you request access.
• **Usage data** — pages visited, features used, timestamps, IP address, browser type, and device information collected automatically.
• **Communications** — emails and messages you send us.`,
  },
  {
    title: "2. How We Use Your Information",
    body: `We use the information we collect to:

• Provide, operate, and improve the Distillr platform.
• Process and display your distillery's operational and compliance data.
• Send you account-related communications (security alerts, feature updates, billing notices).
• Respond to support requests and inquiries.
• Comply with legal obligations, including applicable federal and state regulations.
• Analyze usage patterns to enhance user experience.

We do not sell your personal information or your distillery's operational data to third parties.`,
  },
  {
    title: "3. Data Storage and Security",
    body: `Your data is stored on secure cloud infrastructure (Railway / PostgreSQL). We implement industry-standard security measures including:

• Encrypted connections (TLS/HTTPS) for all data in transit.
• Database-level access controls and tenant isolation — each distillery's data is logically separated.
• Regular backups.

No method of transmission over the internet is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.`,
  },
  {
    title: "4. Data Sharing",
    body: `We do not sell, trade, or rent your personal information to third parties. We may share information in the following limited circumstances:

• **Service providers** — trusted third-party vendors who assist in operating the platform (e.g., hosting, analytics), bound by confidentiality obligations.
• **Legal requirements** — if required by law, regulation, court order, or government request.
• **Business transfers** — if Distillr is involved in a merger, acquisition, or sale, your information may be transferred as part of that transaction. We will notify you before your information is subject to a different privacy policy.`,
  },
  {
    title: "5. TTB and Regulatory Data",
    body: `Distillr is a compliance tool designed to help licensed Distilled Spirits Plants (DSPs) manage TTB reporting obligations. Data you enter for TTB reports, excise tax returns, and production records is stored solely for your use within the platform. We do not transmit this data to the TTB or any regulatory authority on your behalf. You remain solely responsible for filing required reports with the appropriate authorities.`,
  },
  {
    title: "6. Data Retention",
    body: `We retain your account and operational data for as long as your account is active or as needed to provide the service. Per 27 CFR § 19.618, TTB regulations require DSPs to retain certain records for a minimum of three years — our platform stores records to support this requirement. You may request deletion of your account and data by contacting us; note that certain records may need to be retained for legal or compliance reasons.`,
  },
  {
    title: "7. Your Rights",
    body: `Depending on your jurisdiction, you may have the right to:

• Access the personal information we hold about you.
• Correct inaccurate or incomplete information.
• Request deletion of your personal information (subject to legal retention requirements).
• Object to or restrict certain processing of your data.
• Data portability — receive your data in a structured, machine-readable format.

To exercise any of these rights, contact us at the email below.`,
  },
  {
    title: "8. Cookies and Tracking",
    body: `We use essential session cookies to authenticate users and maintain your login state. We do not use third-party advertising cookies. We may use anonymous analytics to understand how the platform is used. You can disable cookies in your browser settings, though this may affect functionality.`,
  },
  {
    title: "9. Children's Privacy",
    body: `Distillr is a business software platform intended for use by licensed distillery operators and their staff. We do not knowingly collect personal information from individuals under 18 years of age. If we learn we have collected information from a child under 18, we will promptly delete it.`,
  },
  {
    title: "10. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or by a prominent notice on the platform. Your continued use of Distillr after the effective date of any changes constitutes your acceptance of the revised policy. We encourage you to review this policy periodically.`,
  },
  {
    title: "11. Contact Us",
    body: `If you have any questions about this Privacy Policy or how we handle your data, please contact us at:

**Distillr — A Loogo Labs Software**
Email: privacy@distillrsoftware.com`,
  },
];

export default function PrivacyPage() {
  const [, navigate] = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <LandingNav />

      {/* Hero */}
      <div style={{ background: NAVY, paddingTop: 100, paddingBottom: 56, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(250,240,226,0.4)", marginBottom: 12 }}>Legal</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: CREAM, letterSpacing: "-0.035em", lineHeight: 1.1, margin: "0 0 16px" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 14, color: "rgba(250,240,226,0.4)", margin: 0 }}>Last updated: {LAST_UPDATED}</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 96px" }}>

        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, marginBottom: 40, padding: "20px 24px", background: "#f9fafb", borderLeft: `3px solid ${NAVY}`, borderRadius: "0 8px 8px 0" }}>
          Distillr ("we," "us," or "our") respects your privacy and is committed to protecting the personal and operational information you share with us. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.
        </p>

        {SECTIONS.map((s, i) => (
          <div key={i} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, letterSpacing: "-0.02em", marginBottom: 14 }}>{s.title}</h2>
            <div style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.85 }}>
              {s.body.split("\n").map((line, j) => {
                if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
                const html = line
                  .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${NAVY}">$1</strong>`)
                  .replace(/^•\s/, "");
                const isBullet = line.startsWith("•");
                return isBullet ? (
                  <div key={j} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: NAVY, opacity: 0.4, marginTop: 7, flexShrink: 0 }} />
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                ) : (
                  <p key={j} style={{ margin: "0 0 8px" }} dangerouslySetInnerHTML={{ __html: html }} />
                );
              })}
            </div>
            {i < SECTIONS.length - 1 && <div style={{ height: 1, background: "#f0f0f0", marginTop: 40 }} />}
          </div>
        ))}

        {/* Footer nav */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #e5e7eb", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600, padding: 0 }}>← Back to home</button>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="/terms" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Terms of Service</a>
            <a href="/acceptable-use" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Acceptable Use</a>
          </div>
        </div>
      </div>
    </div>
  );
}
