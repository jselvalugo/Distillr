import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";
import { initDatabase, pool } from "../../server/db";
import { seedAdminUser } from "../../server/seed-admin";
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

async function ensureInit() {
  if (initialized) return;
  await initDatabase();
  await seedAdminUser();
  await registerRoutes(httpServer, app);
  initialized = true;
}

const netlifyHandler = serverless(app, {
  binary: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/pdf",
    "image/*",
  ],
});

export const handler = async (event: unknown, context: unknown) => {
  await ensureInit();
  return netlifyHandler(event, context);
};
