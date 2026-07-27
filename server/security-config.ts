export const MIN_SESSION_SECRET_LENGTH = 32;
const DEV_SESSION_SECRET = "oakcellar-dev-session-secret";

export function resolveSessionSecret(params: {
  sessionSecret: string | undefined;
  isProduction: boolean;
}): string {
  const provided = params.sessionSecret?.trim();

  if (!params.isProduction) {
    return provided || DEV_SESSION_SECRET;
  }

  if (!provided) {
    throw new Error("SESSION_SECRET must be set when NODE_ENV=production");
  }

  if (provided.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters in production`);
  }

  return provided;
}
