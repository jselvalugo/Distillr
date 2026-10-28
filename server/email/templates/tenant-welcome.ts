/**
 * Branded "your Distillr workspace is ready" email, sent manually from the admin
 * panel when a tenant's admin user is set up. Email-client-safe markup: tables,
 * inline styles, PNG logo (Gmail/Outlook don't render SVG), and a plain-text part.
 */

export interface TenantWelcomeEmailInput {
  recipientName: string;
  recipientEmail: string;
  organizationName: string;
  temporaryPassword: string;
  setPasswordUrl: string;
  loginUrl: string;
  /** Absolute origin used for hosted assets, e.g. https://distillrsoftware.com */
  assetBaseUrl: string;
  expiresInHours: number;
  supportEmail?: string;
}

const C = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  indigoTint: "#EEF2FF",
  ink: "#0F172A",
  inkSoft: "#475569",
  inkMuted: "#94A3B8",
  paper: "#F8FAFC",
  edge: "#E2E8F0",
  white: "#FFFFFF",
};

const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : "there";
}

export function tenantWelcomeSubject(input: Pick<TenantWelcomeEmailInput, "organizationName">): string {
  return `Your Distillr workspace for ${input.organizationName} is ready`;
}

export function renderTenantWelcomeEmail(input: TenantWelcomeEmailInput): { subject: string; html: string; text: string } {
  const subject = tenantWelcomeSubject(input);
  const support = input.supportEmail ?? "support@distillrsoftware.com";
  const logoUrl = `${input.assetBaseUrl.replace(/\/$/, "")}/brand/logo-primary-1000w.png`;
  const loginHost = input.loginUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const hello = firstName(input.recipientName);

  const credRow = (label: string, value: string, mono = false, last = false) => `
              <tr>
                <td class="cred-label" style="padding:14px 20px;${last ? "" : `border-bottom:1px solid ${C.edge};`}font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.inkMuted};width:150px;vertical-align:top;">${label}</td>
                <td class="cred-value" style="padding:14px 20px;${last ? "" : `border-bottom:1px solid ${C.edge};`}font-family:${mono ? MONO : FONT};font-size:${mono ? "15px" : "14px"};font-weight:${mono ? "600" : "500"};color:${C.ink};word-break:break-all;${mono ? "letter-spacing:0.04em;" : ""}">${value}</td>
              </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .cred-label { display:block !important; width:auto !important; padding-bottom:2px !important; border-bottom:0 !important; }
    .cred-value { display:block !important; padding-top:2px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your sign-in details for ${esc(input.organizationName)} on Distillr, plus a link to choose your own password.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td style="padding:0 8px 24px;">
              <img src="${esc(logoUrl)}" width="148" height="30" alt="distillr" style="display:block;width:148px;height:auto;border:0;outline:none;">
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${C.white};border:1px solid ${C.edge};border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height:4px;background:${C.indigo};line-height:4px;font-size:0;">&nbsp;</td></tr>
                <tr>
                  <td class="px" style="padding:40px 44px 8px;">
                    <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.indigo};">Workspace ready</p>
                    <h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;color:${C.ink};letter-spacing:-0.01em;">Welcome to Distillr, ${esc(hello)}.</h1>
                    <p style="margin:0 0 28px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.inkSoft};">
                      Your workspace for <strong style="color:${C.ink};">${esc(input.organizationName)}</strong> is set up and waiting.
                      Batches, barrels, inventory and your TTB reports all live here. Use the details below to sign in for the first time.
                    </p>
                  </td>
                </tr>

                <!-- Credentials -->
                <tr>
                  <td class="px" style="padding:0 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.edge};border-radius:12px;background:${C.paper};">
                      ${credRow("Sign-in page", `<a href="${esc(input.loginUrl)}" style="color:${C.indigo};text-decoration:none;font-weight:600;">${esc(loginHost)}</a>`)}
                      ${credRow("Email", esc(input.recipientEmail))}
                      ${credRow("Temporary password", esc(input.temporaryPassword), true, true)}
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td class="px" style="padding:32px 44px 8px;">
                    <p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.inkSoft};">
                      For your security, choose your own password before you get started:
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${C.indigo}" style="border-radius:10px;background:${C.indigo};">
                          <a href="${esc(input.setPasswordUrl)}" target="_blank"
                             style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.white};text-decoration:none;border-radius:10px;">
                            Set my password &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.inkMuted};">
                      This link works once and expires in ${input.expiresInHours} hours. After you set a new password, the temporary one stops working.
                    </p>
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td class="px" style="padding:24px 44px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.edge};">
                      <tr>
                        <td style="padding-top:20px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.inkMuted};">
                          Button not working? Paste this link into your browser:<br>
                          <a href="${esc(input.setPasswordUrl)}" style="color:${C.indigo};word-break:break-all;">${esc(input.setPasswordUrl)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 8px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.inkMuted};">
              Questions? Reply to this email or write to
              <a href="mailto:${esc(support)}" style="color:${C.inkSoft};">${esc(support)}</a>.<br>
              You're receiving this because a Distillr workspace was created for ${esc(input.recipientEmail)}.
              If that wasn't expected, you can ignore this email.<br><br>
              <span style="color:${C.inkSoft};font-weight:600;">Distillr</span> &middot; Distillery operations, from mash to TTB &middot;
              <a href="https://distillrsoftware.com" style="color:${C.inkMuted};">distillrsoftware.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to Distillr, ${hello}.`,
    "",
    `Your workspace for ${input.organizationName} is set up and waiting.`,
    "",
    "Your sign-in details",
    `  Sign-in page:        ${input.loginUrl}`,
    `  Email:               ${input.recipientEmail}`,
    `  Temporary password:  ${input.temporaryPassword}`,
    "",
    "For your security, choose your own password before you get started:",
    input.setPasswordUrl,
    "",
    `This link works once and expires in ${input.expiresInHours} hours. After you set a new password, the temporary one stops working.`,
    "",
    `Questions? Reply to this email or write to ${support}.`,
    "",
    "Distillr · distillrsoftware.com",
  ].join("\n");

  return { subject, html, text };
}
