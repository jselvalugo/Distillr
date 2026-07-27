import path from "node:path";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_JOB_PHOTO_BYTES = 8 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const ALLOWED_JOB_PHOTO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const DATA_URL_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/;

export function sanitizeUploadFilename(filename: string, fallbackBase = "upload"): string {
  const basename = path.basename(filename || "");
  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);

  if (!sanitized || sanitized === "." || sanitized === "..") {
    return `${fallbackBase}.bin`;
  }

  return sanitized;
}

export function extensionForMimeType(mimeType: string): string | null {
  return MIME_EXTENSION_MAP[mimeType] || null;
}

export function parseBase64DataUrl(
  dataUrl: string,
): { mimeType: string; buffer: Buffer } | null {
  const match = DATA_URL_PATTERN.exec(dataUrl || "");
  if (!match) return null;

  const mimeType = String(match[1]).toLowerCase();
  const base64Data = String(match[2]).replace(/\s+/g, "");
  if (!base64Data) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return null;
  }
  if (!buffer.byteLength) return null;

  return { mimeType, buffer };
}

export function hasExpectedFileSignature(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/png") {
    return (
      buffer.byteLength >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === "image/jpeg") {
    return buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return (
      buffer.byteLength >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export function assertAllowedUpload(params: {
  mimeType: string;
  buffer: Buffer;
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  enforceSignature?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const normalizedMime = params.mimeType.toLowerCase();

  if (!params.allowedMimeTypes.has(normalizedMime)) {
    return { ok: false, reason: `Unsupported content type: ${normalizedMime}` };
  }

  if (params.buffer.byteLength > params.maxBytes) {
    return { ok: false, reason: `File exceeds ${params.maxBytes} bytes limit` };
  }

  if (params.enforceSignature !== false && !hasExpectedFileSignature(normalizedMime, params.buffer)) {
    return { ok: false, reason: "Uploaded content does not match the declared file type" };
  }

  return { ok: true };
}
