import { useLocation } from "wouter";
import { LandingNav } from "../components/LandingNav";

const NAVY = "#0F1B42";
const CREAM = "#FAF0E2";
const LAST_UPDATED = "July 31, 2026";

const SECTIONS = [
  {
    title: "1. Purpose",
    body: `This Acceptable Use Policy ("AUP") governs your use of the Distillr platform and all related services provided by Loogo Labs ("we," "us," "our"). This AUP is incorporated by reference into our Terms of Service. By using Distillr, you agree to comply with this policy.`,
  },
  {
    title: "2. Permitted Use",
    body: `Distillr is licensed for use by legally operating, TTB-licensed Distilled Spirits Plants (DSPs) and their authorized personnel. Permitted uses include:

• Managing production batches, barrel inventories, and operational records for your licensed DSP.
• Preparing and reviewing TTB federal reports and state excise tax returns.
• Tracking compliance obligations, permits, and COLA registrations for your facility.
• Using the AI assistant to query your distillery's operational data and obtain general compliance guidance.
• Exporting data for submission to regulatory authorities or internal record-keeping.`,
  },
  {
    title: "3. Prohibited Activities",
    body: `You may not use Distillr to engage in any of the following:

**Illegal Operations**
• Managing, tracking, or facilitating unlicensed distilling or the production of spirits without a valid DSP permit.
• Evading, falsifying, or obscuring TTB reporting obligations or federal excise tax liabilities.
• Using the platform to launder money or facilitate any fraudulent activity.

**Platform Abuse**
• Attempting to gain unauthorized access to other tenant accounts, administrative systems, or backend infrastructure.
• Probing, scanning, or testing the vulnerability of the platform without explicit written authorization.
• Using automated bots, scrapers, or scripts to extract data at a rate that degrades platform performance.
• Circumventing authentication mechanisms, rate limits, or access controls.

**Data Misuse**
• Uploading or entering data belonging to another distillery without authorization.
• Storing personal health information (PHI), payment card data, Social Security numbers, or other categories of sensitive personal data not necessary for distillery operations.
• Misrepresenting your facility's identity or production data.

**Harmful Content**
• Transmitting malware, viruses, or any code designed to damage or gain unauthorized access to systems.
• Using the platform to harass, threaten, or harm any individual.`,
  },
  {
    title: "4. AI Assistant Usage",
    body: `The Distillr AI assistant has read-only access to your distillery's operational data. Acceptable use of the AI assistant includes asking questions about your production records, compliance status, TTB requirements, and general distillery operations.

You may not attempt to:
• Manipulate the AI to produce harmful, deceptive, or false compliance guidance.
• Exploit the AI to access data from other tenant accounts.
• Use the AI's outputs as a substitute for advice from a licensed attorney or TTB consultant for binding compliance determinations.

AI responses are for informational purposes only and do not constitute legal or regulatory advice.`,
  },
  {
    title: "5. Data Accuracy",
    body: `You are responsible for the accuracy of all data entered into Distillr, including proof gallons, production volumes, case counts, and tax calculations. Intentionally entering false data to misrepresent production or evade excise tax obligations may violate federal law (27 CFR Part 19, 26 U.S.C. § 5601 et seq.) and may result in immediate account termination and referral to appropriate authorities.`,
  },
  {
    title: "6. Account Sharing",
    body: `Each user account is for a single individual. You may not share login credentials between multiple people. Your subscription plan determines the maximum number of individual user accounts permitted. Adding users beyond your plan limit requires a plan upgrade.`,
  },
  {
    title: "7. Reporting Violations",
    body: `If you become aware of any violation of this AUP — including unauthorized access attempts or misuse of the platform — please report it promptly to:

**Distillr — A Loogo Labs Software**
Email: security@distillrsoftware.com

We take all reports seriously and will investigate promptly.`,
  },
  {
    title: "8. Consequences of Violations",
    body: `Violations of this AUP may result in:

• Immediate suspension or termination of your account without refund.
• Removal of offending content or data.
• Notification to law enforcement or regulatory authorities where required by law.
• Civil or criminal liability under applicable federal and state laws.

We reserve the right to investigate suspected violations and cooperate with law enforcement agencies.`,
  },
  {
    title: "9. Changes to This Policy",
    body: `We may update this Acceptable Use Policy at any time. Material changes will be communicated via email or in-app notification. Continued use of the platform following notice of changes constitutes your acceptance of the updated policy.`,
  },
];

export default function AcceptableUsePage() {
  const [, navigate] = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <LandingNav />

      {/* Hero */}
      <div style={{ background: NAVY, paddingTop: 100, paddingBottom: 56, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(250,240,226,0.4)", marginBottom: 12 }}>Legal</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: CREAM, letterSpacing: "-0.035em", lineHeight: 1.1, margin: "0 0 16px" }}>
          Acceptable Use Policy
        </h1>
        <p style={{ fontSize: 14, color: "rgba(250,240,226,0.4)", margin: 0 }}>Last updated: {LAST_UPDATED}</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 96px" }}>

        <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, marginBottom: 40, padding: "20px 24px", background: "#f9fafb", borderLeft: `3px solid ${NAVY}`, borderRadius: "0 8px 8px 0" }}>
          This Acceptable Use Policy defines the standards of conduct we expect from all Distillr users. It exists to protect the integrity of the platform, the security of your data, and compliance with applicable laws governing the distilled spirits industry.
        </p>

        {SECTIONS.map((s, i) => (
          <div key={i} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, letterSpacing: "-0.02em", marginBottom: 14 }}>{s.title}</h2>
            <div style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.85 }}>
              {s.body.split("\n").map((line, j) => {
                if (!line.trim()) return <div key={j} style={{ height: 8 }} />;
                const isBullet = line.startsWith("•");
                const isBold = line.startsWith("**") && line.endsWith("**") === false && line.includes("**");
                const html = line
                  .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${NAVY}">$1</strong>`)
                  .replace(/^•\s/, "");
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
            <a href="/terms" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
}
