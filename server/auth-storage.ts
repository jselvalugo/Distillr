import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { InsertUser, SafeUser, User } from "@shared/schema";
import { query } from "./db";
import { getCurrentTenantId } from "./tenant-context";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");
  if (storedBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, storedBuffer);
}

function mapRowToUser(row: Record<string, unknown>): User & { tenantId: string } {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    name: String(row.name),
    role: row.role as User["role"],
    status: row.status as User["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    onboardedAt: row.onboarded_at ? new Date(String(row.onboarded_at)).toISOString() : null,
    tenantId: String(row.tenant_id),
  };
}

export class AmbiguousAccountError extends Error {
  constructor() {
    super("This email is linked to more than one distillery. Please contact support so we can separate the accounts.");
    this.name = "AmbiguousAccountError";
  }
}

export class AuthStorage {
  private generateId(): string {
    return `USER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async getUsers(): Promise<User[]> {
    const tenantId = getCurrentTenantId();
    const rows = await query("SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map((row) => mapRowToUser(row));
  }

  async getUserByEmail(email: string): Promise<(User & { tenantId: string }) | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      "SELECT * FROM users WHERE lower(email) = lower($1) AND tenant_id = $2 LIMIT 1",
      [email, tenantId],
    );
    return rows[0] ? mapRowToUser(rows[0]) : undefined;
  }

  // Used during login before tenant context is established.
  // NOTE: the same email may exist in several tenants (legacy data) — callers that
  // authenticate must use getUsersByEmailGlobal and verify the password per account.
  async getUserByEmailGlobal(email: string): Promise<(User & { tenantId: string }) | undefined> {
    const rows = await query(
      "SELECT * FROM users WHERE lower(email) = lower($1) ORDER BY created_at ASC, id ASC LIMIT 1",
      [email],
    );
    return rows[0] ? mapRowToUser(rows[0]) : undefined;
  }

  async getUsersByEmailGlobal(email: string): Promise<(User & { tenantId: string })[]> {
    const rows = await query(
      "SELECT * FROM users WHERE lower(email) = lower($1) ORDER BY created_at ASC, id ASC",
      [email],
    );
    return rows.map((row) => mapRowToUser(row));
  }

  /** True if this email is already used by any user in any tenant (optionally excluding one user). */
  async emailInUseGlobally(email: string, exceptUserId?: string): Promise<boolean> {
    const rows = await query(
      "SELECT id FROM users WHERE lower(email) = lower($1) AND ($2::text IS NULL OR id <> $2) LIMIT 1",
      [email.trim(), exceptUserId ?? null],
    );
    return !!rows[0];
  }

  async getUserById(id: string): Promise<(User & { tenantId: string }) | undefined> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      "SELECT * FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1",
      [id, tenantId],
    );
    return rows[0] ? mapRowToUser(rows[0]) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<SafeUser> {
    const tenantId = getCurrentTenantId();
    const normalizedEmail = insertUser.email.trim().toLowerCase();
    // Emails are the login identifier, so they must be unique across ALL tenants —
    // otherwise login can't tell which distillery a person belongs to.
    if (await this.emailInUseGlobally(normalizedEmail)) {
      throw new Error("A Distillr account with this email already exists. Use a different email for this user.");
    }

    const id = this.generateId();
    const passwordHash = await hashPassword(insertUser.password);

    const rows = await query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, email, name, role, status, created_at`,
      [id, tenantId, normalizedEmail, passwordHash, insertUser.name, insertUser.role, insertUser.status],
    );

    const row = rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as SafeUser["role"],
      status: row.status as SafeUser["status"],
      createdAt: new Date(String(row.created_at)).toISOString(),
      tenantId: String(row.tenant_id),
    };
  }

  // Used during seed (before tenant context) — accepts tenantId explicitly
  async createUserForTenant(tenantId: string, insertUser: InsertUser): Promise<SafeUser> {
    const normalizedEmail = insertUser.email.trim().toLowerCase();
    if (await this.emailInUseGlobally(normalizedEmail)) {
      throw new Error("A Distillr account with this email already exists. Use a different email for this user.");
    }

    const id = `USER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hashPassword(insertUser.password);

    const rows = await query(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, email, name, role, status, created_at`,
      [id, tenantId, normalizedEmail, passwordHash, insertUser.name, insertUser.role, insertUser.status],
    );

    const row = rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as SafeUser["role"],
      status: row.status as SafeUser["status"],
      createdAt: new Date(String(row.created_at)).toISOString(),
      tenantId: String(row.tenant_id),
    };
  }

  async validateCredentials(email: string, password: string): Promise<(SafeUser & { tenantId: string }) | null> {
    // Check the password against every active account with this email and only accept
    // the one it actually belongs to — never "whichever row came back first".
    const candidates = (await this.getUsersByEmailGlobal(email)).filter((u) => u.status === "active");
    const matches: (User & { tenantId: string })[] = [];
    for (const candidate of candidates) {
      if (await verifyPassword(password, candidate.passwordHash)) matches.push(candidate);
    }
    if (matches.length === 0) return null;
    if (matches.length > 1 && matches.some((m) => m.tenantId === "default")) {
      // Legacy duplicate of the platform owner's own account: the owner's account wins.
      matches.splice(0, matches.length, matches.find((m) => m.tenantId === "default")!);
    }
    if (matches.length > 1) {
      // Same email AND same password in several tenants: ambiguous. Refuse rather than guess.
      console.warn(`[auth] ambiguous login for ${email}: password matches ${matches.length} tenants (${matches.map((m) => m.tenantId).join(", ")})`);
      throw new AmbiguousAccountError();
    }
    const user = matches[0];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      onboardedAt: user.onboardedAt ?? null,
      tenantId: user.tenantId,
    };
  }

  /** Marks the first-login tour as seen (or clears it to replay). Returns the new timestamp. */
  async setOnboarded(id: string, done: boolean): Promise<string | null> {
    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE users SET onboarded_at = ${done ? "NOW()" : "NULL"} WHERE id = $1 AND tenant_id = $2 RETURNING onboarded_at`,
      [id, tenantId],
    );
    const v = rows[0]?.onboarded_at;
    return v ? new Date(String(v)).toISOString() : null;
  }

  async updateUser(id: string, updates: Partial<Omit<User, "id" | "passwordHash" | "createdAt">>): Promise<SafeUser> {
    const existing = await this.getUserById(id);
    if (!existing) {
      throw new Error("User not found");
    }

    const next = {
      email: updates.email?.trim().toLowerCase() ?? existing.email,
      name: updates.name ?? existing.name,
      role: updates.role ?? existing.role,
      status: updates.status ?? existing.status,
    };

    if (next.email !== existing.email && (await this.emailInUseGlobally(next.email, id))) {
      throw new Error("A Distillr account with this email already exists. Use a different email for this user.");
    }

    const tenantId = getCurrentTenantId();
    const rows = await query(
      `UPDATE users
       SET email = $2, name = $3, role = $4, status = $5
       WHERE id = $1 AND tenant_id = $6
       RETURNING id, tenant_id, email, name, role, status, created_at`,
      [id, next.email, next.name, next.role, next.status, tenantId],
    );

    const row = rows[0];
    if (!row) throw new Error("User not found");

    return {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as SafeUser["role"],
      status: row.status as SafeUser["status"],
      createdAt: new Date(String(row.created_at)).toISOString(),
      tenantId: String(row.tenant_id),
    };
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const passwordHash = await hashPassword(newPassword);
    const rows = await query(
      "UPDATE users SET password_hash = $2 WHERE id = $1 AND tenant_id = $3 RETURNING id",
      [id, passwordHash, tenantId],
    );
    if (!rows[0]) throw new Error("User not found");
  }

  async deleteUser(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    await query("DELETE FROM users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }
}

export const authStorage = new AuthStorage();
