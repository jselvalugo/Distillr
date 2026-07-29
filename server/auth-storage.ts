import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { InsertUser, SafeUser, User } from "@shared/schema";
import { query } from "./db";

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

function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    name: String(row.name),
    role: row.role as User["role"],
    status: row.status as User["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export class AuthStorage {
  private generateId(): string {
    return `USER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async getUsers(): Promise<User[]> {
    const rows = await query("SELECT * FROM users ORDER BY created_at DESC");
    return rows.map((row) => mapRowToUser(row));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await query("SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
    return rows[0] ? mapRowToUser(rows[0]) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const rows = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
    return rows[0] ? mapRowToUser(rows[0]) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<SafeUser> {
    const normalizedEmail = insertUser.email.trim().toLowerCase();
    const existing = await this.getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const id = this.generateId();
    const passwordHash = await hashPassword(insertUser.password);

    const rows = await query(
      `INSERT INTO users (id, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, status, created_at`,
      [id, normalizedEmail, passwordHash, insertUser.name, insertUser.role, insertUser.status],
    );

    const row = rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as SafeUser["role"],
      status: row.status as SafeUser["status"],
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async validateCredentials(email: string, password: string): Promise<SafeUser | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    if (user.status !== "active") return null;

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
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

    if (next.email !== existing.email) {
      const emailConflict = await this.getUserByEmail(next.email);
      if (emailConflict && emailConflict.id !== id) {
        throw new Error("User with this email already exists");
      }
    }

    const rows = await query(
      `UPDATE users
       SET email = $2, name = $3, role = $4, status = $5
       WHERE id = $1
       RETURNING id, email, name, role, status, created_at`,
      [id, next.email, next.name, next.role, next.status],
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
    };
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    const rows = await query("UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id", [id, passwordHash]);
    if (!rows[0]) throw new Error("User not found");
  }

  async deleteUser(id: string): Promise<void> {
    await query("DELETE FROM users WHERE id = $1", [id]);
  }
}

export const authStorage = new AuthStorage();
