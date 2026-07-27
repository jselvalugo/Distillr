import { authStorage } from "./auth-storage";
import { randomBytes } from "node:crypto";

export async function seedAdminUser() {
  try {
    const existingUsers = await authStorage.getUsers();
    if (existingUsers.length > 0) {
      return;
    }

    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD must be set before first boot in production");
    }

    const email = process.env.ADMIN_EMAIL || "admin@local";
    const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");
    const name = process.env.ADMIN_NAME || "admin";

    await authStorage.createUser({
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
