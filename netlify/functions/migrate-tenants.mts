import type { Config } from "@netlify/functions";
import { runSchemaMigration } from "../../server/db";

/**
 * One-time move of every tenant's data out of the old shared tables into its own
 * private Postgres schema. Runs in the background (up to 15 minutes) and is started
 * automatically by the api function when it finds the move pending. Safe to invoke
 * repeatedly: it is advisory-locked and a no-op once done. On failure nothing changes
 * (single transaction) and the error is recorded in platform_migrations.
 */
export default async () => {
  try {
    const result = await runSchemaMigration();
    console.log(result.ran ? "[migrate-tenants] migration completed" : "[migrate-tenants] nothing to do");
  } catch (err) {
    console.error("[migrate-tenants] migration failed; site stays in upgrade mode with data untouched:", err);
  }
};

export const config: Config = { background: true };
