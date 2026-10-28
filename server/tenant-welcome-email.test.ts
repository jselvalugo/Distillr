import assert from "node:assert/strict";
import test from "node:test";
import { renderTenantWelcomeEmail } from "./email/templates/tenant-welcome";
import { generateTemporaryPassword } from "./password-setup";
import { shouldEnforceCsrf } from "./csrf-protection";

const base = {
  recipientName: "Ana <b>Lopez</b>",
  recipientEmail: "ana@example.com",
  organizationName: "Oak & Rye Distilling",
  temporaryPassword: "Abcd-Efgh-Jkmn",
  setPasswordUrl: "https://distillrsoftware.com/set-password?token=abc123",
  loginUrl: "https://distillrsoftware.com/login",
  assetBaseUrl: "https://distillrsoftware.com",
  expiresInHours: 72,
};

test("welcome email: includes credentials, link and escapes user input", () => {
  const email = renderTenantWelcomeEmail(base);
  assert.match(email.subject, /Oak & Rye Distilling/);
  assert.ok(email.html.includes("Abcd-Efgh-Jkmn"));
  assert.ok(email.html.includes("set-password?token=abc123"));
  assert.ok(email.html.includes("Oak &amp; Rye"));
  assert.ok(!email.html.includes("<b>Lopez</b>"));
  assert.ok(email.html.includes("/brand/logo-primary-1000w.png"));
  assert.ok(email.text.includes("Abcd-Efgh-Jkmn"));
  assert.ok(email.text.includes(base.setPasswordUrl));
});

test("welcome email: temporary passwords are readable and unique", () => {
  const a = generateTemporaryPassword();
  const b = generateTemporaryPassword();
  assert.match(a, /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
  assert.notEqual(a, b);
});

test("welcome email: set-password endpoint is token-authorized, not CSRF", () => {
  assert.equal(shouldEnforceCsrf("POST", "/api/auth/password-setup"), false);
  assert.equal(shouldEnforceCsrf("POST", "/api/admin/tenants/x/users/y/welcome-email"), true);
});

test("welcome email: footer contact follows EMAIL_REPLY_TO, then EMAIL_FROM", () => {
  const saved = { from: process.env.EMAIL_FROM, reply: process.env.EMAIL_REPLY_TO };
  try {
    delete process.env.EMAIL_REPLY_TO;
    process.env.EMAIL_FROM = "Distillr <david@loogolabs.com>";
    assert.ok(renderTenantWelcomeEmail(base).html.includes("mailto:david@loogolabs.com"));
    process.env.EMAIL_REPLY_TO = "help@example.com";
    assert.ok(renderTenantWelcomeEmail(base).text.includes("help@example.com"));
  } finally {
    if (saved.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = saved.from;
    if (saved.reply === undefined) delete process.env.EMAIL_REPLY_TO; else process.env.EMAIL_REPLY_TO = saved.reply;
  }
});
