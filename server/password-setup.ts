import { createHash, randomBytes, randomInt } from "node:crypto";
import { query } from "./db";
import { authStorage } from "./auth-storage";
import { runWithTenant } from "./tenant-context";

/**
 * One-time "set your password" links, used by the tenant welcome email.
 * Only a SHA-256 hash of each token is stored; the raw token lives only in the email.
 */

export const SETUP_TOKEN_TTL_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Readable temporary password, e.g. "Kx7m-Pq4t-Wz9r" (no 0/O/1/l/I). ~70 bits of entropy. */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

/** Issues a fresh link for a user and revokes any earlier unused ones. Returns the raw token. */
export async function issuePasswordSetupToken(userId: string, tenantId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await query(
    `UPDATE password_setup_tokens SET used_at = NOW()
     WHERE user_id = $1 AND tenant_id = $2 AND used_at IS NULL`,
    [userId, tenantId],
  );
  await query(
    `INSERT INTO password_setup_tokens (id, user_id, tenant_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [`PST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId, tenantId, hashToken(token), expiresAt.toISOString()],
  );
  return { token, expiresAt };
}

export type SetupTokenLookup =
  | { valid: true; userId: string; tenantId: string; email: string; name: string; organizationName: string }
  | { valid: false; reason: "not_found" | "used" | "expired" };

export async function lookupPasswordSetupToken(token: string): Promise<SetupTokenLookup> {
  if (!token || token.length > 200) return { valid: false, reason: "not_found" };
  const rows = await query(
    `SELECT p.user_id, p.tenant_id, p.expires_at, p.used_at, u.email, u.name, t.name AS tenant_name
     FROM password_setup_tokens p
     JOIN users u ON u.id = p.user_id AND u.tenant_id = p.tenant_id
     JOIN tenants t ON t.id = p.tenant_id
     WHERE p.token_hash = $1
     LIMIT 1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return { valid: false, reason: "not_found" };
  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(String(row.expires_at)).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return {
    valid: true,
    userId: String(row.user_id),
    tenantId: String(row.tenant_id),
    email: String(row.email),
    name: String(row.name),
    organizationName: String(row.tenant_name),
  };
}

/** Sets the user's password and burns the token. Single-use is enforced atomically. */
export async function completePasswordSetup(token: string, newPassword: string): Promise<SetupTokenLookup> {
  const found = await lookupPasswordSetupToken(token);
  if (!found.valid) return found;
  const claimed = await query(
    `UPDATE password_setup_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING id`,
    [hashToken(token)],
  );
  if (!claimed[0]) return { valid: false, reason: "used" };
  await runWithTenant(found.tenantId, () => authStorage.resetPassword(found.userId, newPassword));
  return found;
}
