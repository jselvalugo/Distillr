import type { Express, NextFunction, Request, Response } from "express";
import type { IncomingMessage, Server } from "http";
import type { Socket } from "node:net";
import type { Duplex } from "node:stream";

const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isLoopbackAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  const normalized = normalizeAddress(address);
  if (normalized === "::1") return true;
  if (normalized.startsWith("127.")) return true;
  // IPv4-mapped IPv6 addresses are common on Node.
  if (normalized.startsWith("::ffff:") && normalized.slice("::ffff:".length).startsWith("127.")) {
    return true;
  }
  return false;
}

export function parseHostnameFromHostHeader(hostHeader: string): string | null {
  const value = hostHeader.trim();
  if (!value) return null;

  // RFC 2732 IPv6 literal in brackets: [::1]:5000
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return null;
    return value.slice(1, end).toLowerCase();
  }

  return value.split(":")[0]?.toLowerCase() || null;
}

export function isAllowedHostHeader(hostHeader: string | undefined | null): boolean {
  if (!hostHeader) return false;
  const hostname = parseHostnameFromHostHeader(hostHeader);
  if (!hostname) return false;
  return ALLOWED_HOSTNAMES.has(hostname);
}

function deny(res: Response, reason: string): void {
  res.status(403).json({ error: "Local access only", reason });
}

function enforceLoopbackOnlyHttp(req: Request, res: Response, next: NextFunction): void {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    deny(res, "remote-address");
    return;
  }
  if (!isAllowedHostHeader(req.headers.host)) {
    // Blocks DNS-rebinding style hostnames that resolve to loopback.
    deny(res, "host-header");
    return;
  }
  next();
}

function rejectNonLoopbackUpgrade(req: IncomingMessage, socket: Duplex): boolean {
  const netSocket = socket as unknown as Socket;
  const remoteAddress = netSocket.remoteAddress;
  const hostHeader = req.headers.host;
  if (!isLoopbackAddress(remoteAddress) || !isAllowedHostHeader(hostHeader)) {
    try {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    } catch {
      // ignore
    }
    socket.destroy();
    return true;
  }
  return false;
}

export function installLocalOnlyAccessPolicy(app: Express, server: Server): void {
  app.use(enforceLoopbackOnlyHttp);

  // Express middleware does not run for websocket upgrades (Vite HMR, ws, etc),
  // so guard upgrades at the HTTP server boundary as well.
  server.prependListener("upgrade", (req, socket) => {
    rejectNonLoopbackUpgrade(req, socket);
  });
}
