import fs from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";

/**
 * File storage for uploads (attachments, job photos) and generated exports
 * (TTB report packets).
 *
 * - On Netlify, files go to Netlify Blobs. A function's disk is temporary and
 *   wiped between invocations, so writing to it would lose files.
 * - Everywhere else (local dev, a long-lived Node server) files stay on disk
 *   under the project directory, exactly as before.
 *
 * Keys are relative paths such as "uploads/job-photos/abc.jpg" or
 * "exports/ttb/R-1.pdf"; the public URL is "/" + key.
 */

const BLOB_STORE_PRODUCTION = "distillr-files";
const BLOB_STORE_NON_PRODUCTION = "distillr-files-preview";

let deployContext: string | undefined;

/** Called per request by the Netlify function with context.deploy.context. */
export function setDeployContext(value: string | undefined): void {
  if (value) deployContext = value;
}

function useBlobs(): boolean {
  const mode = process.env.FILE_STORAGE;
  if (mode === "disk") return false;
  if (mode === "blobs") return true;
  return typeof (globalThis as { Netlify?: unknown }).Netlify !== "undefined";
}

function blobStore() {
  // Site-wide stores are shared by every deploy, so keep previews in their
  // own store: preview uploads can never overwrite production files.
  const name =
    (deployContext ?? process.env.CONTEXT) === "production"
      ? BLOB_STORE_PRODUCTION
      : BLOB_STORE_NON_PRODUCTION;
  return getStore({ name, consistency: "strong" });
}

/** Normalise and validate a storage key; rejects traversal and odd roots. */
export function normalizeStorageKey(raw: string): string | null {
  const key = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.length > 500) return null;
  const parts = key.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  if (parts[0] !== "uploads" && parts[0] !== "exports") return null;
  return key;
}

function diskPath(key: string): string {
  return path.join(process.cwd(), ...key.split("/"));
}

export async function saveFile(
  rawKey: string,
  data: Buffer | string,
  contentType: string,
): Promise<string> {
  const key = normalizeStorageKey(rawKey);
  if (!key) throw new Error(`Invalid storage key: ${rawKey}`);
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;

  if (useBlobs()) {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const { modified } = await blobStore().set(key, arrayBuffer, {
      metadata: { contentType },
      onlyIfNew: true,
    });
    if (!modified) throw new Error(`File already exists: ${key}`);
    return key;
  }

  const target = diskPath(key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer, { flag: "wx" });
  return key;
}

export async function readFile(
  rawKey: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const key = normalizeStorageKey(rawKey);
  if (!key) return null;

  if (useBlobs()) {
    const entry = await blobStore().getWithMetadata(key, { type: "arrayBuffer" });
    if (!entry) return null;
    const contentType =
      typeof entry.metadata?.contentType === "string"
        ? entry.metadata.contentType
        : "application/octet-stream";
    return { data: Buffer.from(entry.data as ArrayBuffer), contentType };
  }

  const target = diskPath(key);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return { data: fs.readFileSync(target), contentType: contentTypeForName(key) };
}

function contentTypeForName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return types[ext] ?? "application/octet-stream";
}

/**
 * Permanently delete every file stored for a tenant (everything under
 * uploads/t/{tenant}/ and exports/t/{tenant}/). Used when a tenant is deleted.
 * Returns how many files were removed.
 */
export async function deleteTenantFiles(tenantId: string): Promise<number> {
  const scope = tenantId.replace(/[^A-Za-z0-9._-]/g, "_");
  const prefixes = [`uploads/t/${scope}/`, `exports/t/${scope}/`];
  let removed = 0;
  if (useBlobs()) {
    const store = blobStore();
    for (const prefix of prefixes) {
      const { blobs } = await store.list({ prefix });
      for (const blob of blobs) {
        await store.delete(blob.key);
        removed++;
      }
    }
    return removed;
  }
  for (const prefix of prefixes) {
    const dir = diskPath(prefix.replace(/\/$/, ""));
    if (fs.existsSync(dir)) {
      const count = (fs.readdirSync(dir, { recursive: true }) as string[]).filter((f) => fs.statSync(path.join(dir, f)).isFile()).length;
      fs.rmSync(dir, { recursive: true, force: true });
      removed += count;
    }
  }
  return removed;
}
