import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const NAVY = "#0F1B42";
const CREAM = "#FAF0E2";
const LAST_UPDATED = "July 31, 2026";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: `By accessing or using Distillr (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of a business or organization, you represent that you have the authority to bind that entity to these Terms. If you do not agree to these Terms, do not use the Service.

These Terms apply to all users, including administrators, staff members, and any individual granted access to a Distillr tenant account.`,
  },
  {
    title: "2. Description of Service",
    body: `Distillr is a cloud-based distillery management platform designed for licensed Distilled Spirits Plants (DSPs). It provides tools for:

• Production batch tracking and management.
• Barrel aging, warehousing, and inventory.
• TTB federal reporting (Forms 5110.40, 5110.11, 5000.24, etc.).
• State excise tax return calculation and record-keeping.
• Sales order and client management.
• AI-powered operational assistance.

Distillr is a record-keeping and workflow tool. It does not constitute legal, tax, or compliance advice, and does not file reports with the TTB or any regulatory authority on your behalf.`,
  },
  {
    title: "3. Eligibility and Account Registration",
    body: `You must be at least 18 years of age and legally permitted to work in the distilled spirits industry in your jurisdiction to use this Service. You agree to:

• Provide accurate, current, and complete information during registration.
• Maintain the security of your account credentials and notify us immediately of any unauthorized access.
• Be responsible for all activity that occurs under your account.

Each tenant account is associated with a single licensed DSP. You may not share accounts or use the platform to manage unlicensed operations.`,
  },
  {
    title: "4. Subscriptions and Payment",
    body: `Distillr is offered on a subscription basis. By selecting a paid plan, you authorize us to charge the applicable fees to your payment method on a recurring basis (monthly or annually, as selected).

• **Starter Plan** — limited to 1 user and 50 barrels. Includes core TTB reporting and batch tracking.
• **Professional Plan** — up to 15 users, unlimited barrels, all 50-state excise returns, and AI assistant access.
• **Enterprise Plan** — custom pricing for multi-facility operations.

We reserve the right to change pricing with 30 days' notice. Continued use after a price change constitutes acceptance. All fees are non-refundable except as required by law or as expressly stated in a written agreement.`,
  },
  {
    title: "5. Acceptable Use",
    body: `You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:

• Use the Service to manage, track, or facilitate unlicensed or illegal distilling operations.
• Upload, transmit, or store data that infringes intellectual property rights or violates applicable law.
• Attempt to gain unauthorized access to other tenant accounts or the underlying infrastructure.
• Reverse engineer, decompile, or disassemble any part of the Service.
• Use automated tools to scrape, extract, or abuse the Service's APIs beyond normal platform use.

Violation of these restrictions may result in immediate account suspension or termination.`,
  },
  {
    title: "6. Your Data",
    body: `You retain ownership of all data you enter into the platform ("Customer Data"). By using the Service, you grant Distillr a limited license to store, process, and display your Customer Data solely to provide the Service to you.

We will not access your Customer Data except to provide support, ensure security, or as required by law. We will not share your Customer Data with third parties except as described in our Privacy Policy.

You are responsible for the accuracy of data you enter, including proof gallons, tax calculations, and production records. Distillr does not independently verify the accuracy of your entries.`,
  },
  {
    title: "7. TTB Compliance Disclaimer",
    body: `Distillr is designed to assist DSPs in organizing and preparing TTB-required records and reports. However:

• Distillr is not a licensed TTB consultant, attorney, or compliance officer.
• The platform does not provide binding legal or regulatory advice.
• You are solely responsible for ensuring all filings, records, and operations comply with applicable federal regulations (27 CFR Part 19) and state laws.
• We recommend consulting a licensed TTB consultant or attorney for specific compliance determinations.

Any TTB forms generated or populated by the platform are provided as a convenience only. Final review and submission remain your responsibility.`,
  },
  {
    title: "8. Intellectual Property",
    body: `The Distillr platform, including its design, code, features, and content, is owned by Loogo Labs and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works of any part of the platform without our prior written consent.

"Distillr" and associated logos are trademarks of Loogo Labs. Nothing in these Terms grants you any right to use our trademarks without prior written approval.`,
  },
  {
    title: "9. Availability and Modifications",
    body: `We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We reserve the right to:

• Modify, suspend, or discontinue any feature or the entire Service with reasonable notice.
• Perform scheduled maintenance, which may result in temporary unavailability.
• Update these Terms at any time, with material changes communicated via email or in-app notice.

Your continued use of the Service after changes to these Terms constitutes your acceptance of the revised Terms.`,
  },
  {
    title: "10. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law, Distillr and Loogo Labs shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits, data loss, or regulatory fines, arising from your use of or inability to use the Service.

Our total liability to you for any claims arising under these Terms shall not exceed the total fees paid by you in the twelve (12) months preceding the claim. Some jurisdictions do not allow limitations on liability, so these limitations may not apply to you.`,
  },
  {
    title: "11. Termination",
    body: `Either party may terminate the Service relationship at any time. You may cancel your account through the platform settings or by contacting us. We may suspend or terminate your account immediately if we determine you have violated these Terms or applicable law.

Upon termination, your right to access the Service ceases. We will retain your Customer Data for 30 days after termination, during which time you may request an export. After that period, data may be permanently deleted.`,
  },
  {
    title: "12. Governing Law",
    body: `These Terms shall be governed by and construed in accordance with the laws of the United States and the State of Florida, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Florida, and you consent to personal jurisdiction in those courts.`,
  },
  {
    title: "13. Contact",
    body: `For questions about these Terms of Service, please contact us at:

**Distillr — A Loogo Labs Software**
Email: legal@distillrsoftware.com`,
  },
];

export default function TermsPage() {
  const [, navigate] = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <LandingNav />

      {/* Hero */}
      <div style={{ background: NAVY, paddingTop: 100, paddingBottom: 56, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(250,240,226,0.4)", marginBottom: 12 }}>Legal</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: CREAM, letterSpacing: "-0.035em", lineHeight: 1.1, margin: "0 0 16px" }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 14, color: "rgba(250,240,226,0.4)", margin: 0 }}>Last updated: {LAST_UPDATED}</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 96px" }}>

        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, marginBottom: 40, padding: "20px 24px", background: "#f9fafb", borderLeft: `3px solid ${NAVY}`, borderRadius: "0 8px 8px 0" }}>
          Please read these Terms of Service carefully before using Distillr. These Terms form a binding legal agreement between you and Loogo Labs regarding your use of the Distillr platform.
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

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #e5e7eb", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600, padding: 0 }}>← Back to home</button>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="/privacy" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Privacy Policy</a>
            <a href="/acceptable-use" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Acceptable Use</a>
          </div>
        </div>
      </div>
    </div>
  );
}
