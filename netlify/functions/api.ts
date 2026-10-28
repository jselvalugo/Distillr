import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";
import { initDatabase, pool } from "../../server/db";
import { seedAdminUser } from "../../server/seed-admin";
import { setDeployContext } from "../../server/file-storage";
import { runWithTenant } from "../../server/tenant-context";
import { resolveSessionSecret } from "../../server/security-config";

const PgSession = connectPgSimple(session);

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.set("trust proxy", 1);

const sessionSecret = resolveSessionSecret({
  sessionSecret: process.env.SESSION_SECRET,
  isProduction: true,
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(
  express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new PgSession({
      pool: pool as any,
      tableName: "session",
      schemaName: "public",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Tenant context — same as server/index.ts. Wraps the rest of the request in the
// signed-in user's tenant so tenant-scoped queries work.
app.use((req, _res, next) => {
  const tenantId = (req.session as any)?.user?.tenantId as string | undefined;
  if (tenantId) {
    runWithTenant(tenantId, () => next());
  } else {
    next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
});

app.use((_err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = _err.status || _err.statusCode || 500;
  const message = _err.message || "Internal Server Error";
  res.status(status).json({ message });
});

let initialized = false;
let routesRegistered = false;
let lastMigrationKick = 0;

/** Returns false while the one-time tenant-schema migration is still pending. */
async function ensureInit(origin: string): Promise<boolean> {
  if (initialized) return true;
  const state = await initDatabase();
  if (state === "pending") {
    // Hand the one-time move to the background function (15-minute limit) instead of
    // running it inside a web request. Idempotent and locked, so repeat kicks are harmless.
    if (Date.now() - lastMigrationKick > 20_000) {
      lastMigrationKick = Date.now();
      // Awaited (a background function answers 202 immediately): an un-awaited fetch is
      // cut off when this function returns its response.
      try {
        const kick = await fetch(`${origin}/.netlify/functions/migrate-tenants`, {
          method: "POST",
          signal: AbortSignal.timeout(5_000),
        });
        console.log(`[init] tenant migration started (${kick.status})`);
      } catch (err) {
        lastMigrationKick = 0; // try again on the next request
        console.error("[init] could not start tenant migration:", err);
      }
    }
    return false;
  }
  await seedAdminUser();
  if (!routesRegistered) {
    await registerRoutes(httpServer, app);
    routesRegistered = true;
  }
  initialized = true;
  return true;
}

const netlifyHandler = serverless(app, {
  binary: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/pdf",
    "image/*",
  ],
});

type LambdaResult = {
  statusCode?: number;
  headers?: Record<string, string | number | boolean>;
  multiValueHeaders?: Record<string, Array<string | number | boolean>>;
  body?: string;
  isBase64Encoded?: boolean;
};

/**
 * Netlify Functions (modern format) entry point.
 * The modern format is required for Netlify Database to inject NETLIFY_DB_URL.
 * We translate the Web Request into the event shape serverless-http expects,
 * then translate its result back into a Web Response.
 */
export default async (
  req: globalThis.Request,
  context: { ip?: string; deploy?: { context?: string } },
) => {
  setDeployContext(context?.deploy?.context);
  if (!(await ensureInit(new URL(req.url).origin))) {
    return new Response(
      JSON.stringify({ error: "Distillr is being upgraded. This takes about a minute — please refresh shortly.", upgrading: true }),
      { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "30", "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
    multiValueHeaders[key] = [value];
  });

  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
    (multiValueQueryStringParameters[key] ??= []).push(value);
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const bodyBuffer = hasBody ? Buffer.from(await req.arrayBuffer()) : null;

  const event = {
    httpMethod: req.method,
    path: url.pathname,
    rawUrl: req.url,
    headers,
    multiValueHeaders,
    queryStringParameters,
    multiValueQueryStringParameters,
    body: bodyBuffer && bodyBuffer.length ? bodyBuffer.toString("base64") : null,
    isBase64Encoded: Boolean(bodyBuffer && bodyBuffer.length),
    requestContext: { identity: { sourceIp: context?.ip ?? headers["x-nf-client-connection-ip"] ?? "" } },
  };

  const result = (await netlifyHandler(event, {})) as LambdaResult;

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.multiValueHeaders ?? {})) {
    for (const v of value) responseHeaders.append(key, String(v));
  }
  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (!responseHeaders.has(key)) responseHeaders.set(key, String(value));
  }

  const status = result.statusCode ?? 200;
  const noBody = req.method === "HEAD" || status === 204 || status === 304;
  const body = noBody || !result.body
    ? null
    : result.isBase64Encoded
      ? Buffer.from(result.body, "base64")
      : result.body;

  return new globalThis.Response(body, { status, headers: responseHeaders });
};

export const config = {
  // /uploads and /exports are served by the API (from Netlify Blobs), behind login.
  path: ["/api/*", "/uploads/*", "/exports/*"],
};
