import assert from "node:assert/strict";
import test from "node:test";
import { createCsrfToken, isCsrfTokenValid, shouldEnforceCsrf } from "./csrf-protection";

test("csrf: createCsrfToken returns high-entropy hex token", () => {
  const token = createCsrfToken();
  assert.equal(token.length, 64);
  assert.match(token, /^[a-f0-9]+$/);
});

test("csrf: mutating API routes enforce CSRF except login", () => {
  assert.equal(shouldEnforceCsrf("POST", "/api/auth/login"), false);
  assert.equal(shouldEnforceCsrf("POST", "/api/jobs"), true);
  assert.equal(shouldEnforceCsrf("GET", "/api/jobs"), false);
  assert.equal(shouldEnforceCsrf("POST", "/health"), false);
});

test("csrf: token validation requires exact token match", () => {
  const token = createCsrfToken();
  assert.equal(isCsrfTokenValid(token, token), true);
  assert.equal(isCsrfTokenValid("mismatch", token), false);
  assert.equal(isCsrfTokenValid(null, token), false);
  assert.equal(isCsrfTokenValid(token, null), false);
});
