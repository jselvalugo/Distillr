/**
 * Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email).
 * No SDK dependency — one fetch call. Configure with:
 *   RESEND_API_KEY   required
 *   EMAIL_FROM       e.g. "Distillr <david@distillr.loogolabs.com>" (domain must be verified in Resend)
 *   EMAIL_REPLY_TO   optional
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const DEFAULT_FROM = "Distillr <david@distillr.loogolabs.com>";

export interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export class EmailNotConfiguredError extends Error {
  constructor(detail?: string) {
    super(detail ? `Email isn't set up correctly: ${detail}` : "Email is not configured. Set RESEND_API_KEY (and EMAIL_FROM) in the environment.");
    this.name = "EmailNotConfiguredError";
  }
}

/** The sender address in use: EMAIL_FROM, else the default. */
export function resolvedFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/** Human-readable reason email can't be sent, or null when the config looks usable. */
export function emailConfigProblem(): string | null {
  if (!process.env.RESEND_API_KEY?.trim()) return "RESEND_API_KEY isn't set in the site's environment variables.";
  const from = resolvedFrom();
  const addr = from.match(/<([^<>\s]+@[^<>\s]+)>\s*$/)?.[1] ?? (/^[^<>\s]+@[^<>\s]+$/.test(from) ? from : null);
  if (!addr) return `EMAIL_FROM is "${from}" — it needs an address, e.g. "Distillr <david@distillr.loogolabs.com>".`;
  return null;
}

export function isEmailConfigured(): boolean {
  return emailConfigProblem() === null;
}

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const problem = emailConfigProblem();
  if (!apiKey || problem) throw new EmailNotConfiguredError(problem ?? undefined);

  const replyTo = email.replyTo ?? process.env.EMAIL_REPLY_TO?.trim();
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resolvedFrom(),
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
