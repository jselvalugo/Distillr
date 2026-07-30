import { authStorage } from "./auth-storage";
import { query } from "./db";
import { randomBytes } from "node:crypto";

export async function seedAdminUser() {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD must be set before first boot in production");
    }

    // Ensure the default tenant exists (db.ts inserts it, but double-check)
    const tenantRows = await query("SELECT id FROM tenants WHERE id = 'default' LIMIT 1");
    if (!tenantRows[0]) {
      await query(
        `INSERT INTO tenants (id, name, slug, plan, status) VALUES ('default', 'Default Organization', 'default', 'standard', 'active')
         ON CONFLICT (id) DO NOTHING`,
      );
    }

    // Check if admin user already exists for the default tenant
    const existingUsers = await query(
      "SELECT id FROM users WHERE tenant_id = 'default' LIMIT 1",
    );
    if (existingUsers.length > 0) {
      return;
    }

    const email = process.env.ADMIN_EMAIL || "admin@local";
    const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
    const name = process.env.ADMIN_NAME || "admin";

    await authStorage.createUserForTenant("default", {
      email,
      password,
      name,
      role: "admin",
      status: "active",
    });

    if (!process.env.ADMIN_PASSWORD) {
      console.log(`[seed-admin] created admin user ${email} with one-time password: ${password}`);
      console.log("[seed-admin] set ADMIN_PASSWORD to control this value on first boot.");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}
