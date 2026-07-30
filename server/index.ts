import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initDatabase, pool } from "./db";
import { seedInitialData } from "./seed-data";
import { seedAdminUser } from "./seed-admin";
import { installEgressGuard } from "./egress-guard";
import { installLocalOnlyAccessPolicy } from "./local-access";
import { resolveSessionSecret } from "./security-config";
import { runWithTenant } from "./tenant-context";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const allowRemote = process.env.ALLOW_REMOTE === "true";
const seedDemoData = process.env.SEED_DEMO_DATA === "true";
const sessionSecret = resolveSessionSecret({
  sessionSecret: process.env.SESSION_SECRET,
  isProduction,
});
// Default to local-only egress policy unless explicitly disabled.
const localOnlyMode = process.env.LOCAL_ONLY_MODE !== "false";

app.disable("x-powered-by");

if (isProduction) {
  app.set("trust proxy", 1);
}

// Security: default to loopback-only and reject non-loopback + DNS-rebinding style Host headers.
if (!allowRemote) {
  installLocalOnlyAccessPolicy(app, httpServer);
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  express.json({
    // Attachments/photos are sent as base64 data URLs; raise limit above the default 100kb.
    limit: "25mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Tenant context middleware — runs after session is established.
// Wraps the rest of the request chain in the tenant's AsyncLocalStorage context.
app.use((req, _res, next) => {
  const tenantId = (req.session as any)?.user?.tenantId as string | undefined;
  if (tenantId) {
    runWithTenant(tenantId, () => next()).catch(next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
    return originalJson(body);
  }) as typeof res.json;

  next();
});

(async () => {
  if (localOnlyMode) {
    installEgressGuard();
  }
  await initDatabase();
  if (seedDemoData) {
    await runWithTenant("default", () => seedInitialData());
  } else {
    log("skipping demo data seed (set SEED_DEMO_DATA=true to enable)", "seed");
  }
  await seedAdminUser();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app, { allowRemote });
  }

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  const host = allowRemote ? (process.env.HOST || "0.0.0.0") : "127.0.0.1";
  httpServer.listen({
    port,
    host,
  }, () => {
    const accessLabel = allowRemote ? "network-accessible" : "loopback-only";
    const egressLabel = localOnlyMode ? "egress-guard on" : "egress-guard off";
    log(`serving on ${host}:${port} (${accessLabel}, ${egressLabel})`);
  });
})();
