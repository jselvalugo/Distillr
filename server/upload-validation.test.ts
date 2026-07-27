import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  assertAllowedUpload,
  parseBase64DataUrl,
  sanitizeUploadFilename,
} from "./upload-validation";

test("sanitizeUploadFilename strips traversal and unsafe characters", () => {
  const sanitized = sanitizeUploadFilename("../../etc/passwd");
  assert.equal(sanitized.includes(".."), false);
  assert.equal(sanitized.includes("/"), false);
});

test("parseBase64DataUrl parses valid base64 payloads", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  const parsed = parseBase64DataUrl(`data:image/png;base64,${pngHeader}`);
  assert.ok(parsed);
  assert.equal(parsed?.mimeType, "image/png");
  assert.equal(parsed?.buffer.byteLength, 8);
});

test("assertAllowedUpload rejects unsupported mime types", () => {
  const htmlBuffer = Buffer.from("<html></html>", "utf8");
  const result = assertAllowedUpload({
    mimeType: "text/html",
    buffer: htmlBuffer,
    maxBytes: 1024,
    allowedMimeTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
  });
  assert.equal(result.ok, false);
});
