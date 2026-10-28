/**
 * Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email).
 * No SDK dependency — one fetch call. Configure with:
 *   RESEND_API_KEY   required
 *   EMAIL_FROM       e.g. "Distillr <david@loogolabs.com>" (domain must be verified in Resend)
 *   EMAIL_REPLY_TO   optional
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const DEFAULT_FROM = "Distillr <david@loogolabs.com>";

export interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured. Set RESEND_API_KEY (and EMAIL_FROM) in the environment.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailNotConfiguredError();

  const replyTo = email.replyTo ?? process.env.EMAIL_REPLY_TO?.trim();
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(email.tags ? { tags: email.tags } : {}),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok || !body.id) {
    throw new Error(`Resend rejected the email (${res.status}): ${body.message ?? body.name ?? "unknown error"}`);
  }
  return { id: body.id };
}
