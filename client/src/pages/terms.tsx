import { LegalPage } from "../components/public/legal-page";

const LAST_UPDATED = "October 28, 2026";

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
• State excise tax return preparation, tracking and record-keeping.
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

Free trials last 14 days and do not convert to a paid plan unless you choose one. Paid subscriptions renew automatically at the end of each billing period (monthly or annual) until you cancel; you can cancel at any time and your plan stays active until the end of the period you have paid for.

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
    title: "7. TTB and Tax Compliance Disclaimer",
    body: `Distillr is designed to assist DSPs in organizing and preparing TTB-required records, federal excise tax returns and state excise tax returns. However:

• Distillr is not a licensed TTB consultant, attorney, or compliance officer.
• The platform does not provide binding legal or regulatory advice.
• You are solely responsible for ensuring all filings, records, and operations comply with applicable federal regulations (27 CFR Part 19) and state laws.
• Tax rates, rate tiers, credits and filing schedules suggested by the platform (federal or state) are provided for convenience, may be out of date, and may not reflect the tax basis your state uses. You must confirm them with the applicable authority.
• We recommend consulting a licensed TTB consultant, accountant or attorney for specific compliance determinations.

Any TTB forms, tax returns or tax figures generated or populated by the platform are provided as a convenience only. You are solely responsible for reviewing them for accuracy and completeness before you sign, file or pay. Distillr is not responsible for penalties, interest, assessments or other consequences arising from filings you make.`,
  },
  {
    title: "7A. AI Assistant",
    body: `The Service includes an optional AI assistant that answers questions using your Customer Data. AI-generated responses may be incomplete or inaccurate and are provided for informational purposes only. Do not rely on them as the sole basis for compliance, tax, or production decisions. To provide this feature, the relevant portions of your Customer Data are processed by our AI model provider as a service provider under confidentiality obligations; it is not used to train their models.`,
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
    title: "9A. Disclaimer of Warranties",
    body: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOOGO LABS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE, OR ANY REPORT, CALCULATION OR TAX FIGURE IT PRODUCES, WILL BE ERROR-FREE, COMPLETE, OR SUFFICIENT TO MEET YOUR REGULATORY OBLIGATIONS.`,
  },
  {
    title: "10. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law, Distillr and Loogo Labs shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits, data loss, or regulatory fines, arising from your use of or inability to use the Service.

Our total liability to you for any claims arising under these Terms shall not exceed the total fees paid by you in the twelve (12) months preceding the claim. Some jurisdictions do not allow limitations on liability, so these limitations may not apply to you.`,
  },
  {
    title: "10A. Indemnification",
    body: `You agree to indemnify and hold harmless Loogo Labs and its officers, employees and agents from any claims, penalties, assessments, losses and expenses (including reasonable attorneys' fees) arising from your use of the Service, the data you enter, the reports and returns you file, or your violation of these Terms or applicable law.`,
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
  return <LegalPage title="Terms of Service" current="/terms" lastUpdated={LAST_UPDATED} intro={"Please read these Terms of Service carefully before using Distillr. These Terms form a binding legal agreement between you and Loogo Labs regarding your use of the Distillr platform."} sections={SECTIONS} />;
}
