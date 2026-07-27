import assert from "node:assert/strict";
import test from "node:test";
import { MIN_SESSION_SECRET_LENGTH, resolveSessionSecret } from "./security-config";

test("resolveSessionSecret uses development fallback when unset", () => {
  const secret = resolveSessionSecret({ sessionSecret: undefined, isProduction: false });
  assert.equal(secret, "oakcellar-dev-session-secret");
});

test("resolveSessionSecret requires a production secret", () => {
  assert.throws(
    () => resolveSessionSecret({ sessionSecret: undefined, isProduction: true }),
    /SESSION_SECRET must be set/i,
  );
});

test("resolveSessionSecret enforces minimum production secret length", () => {
  assert.throws(
    () => resolveSessionSecret({ sessionSecret: "short", isProduction: true }),
    new RegExp(String(MIN_SESSION_SECRET_LENGTH)),
  );
});

test("resolveSessionSecret accepts strong production secrets", () => {
  const secret = "s".repeat(MIN_SESSION_SECRET_LENGTH);
  assert.equal(resolveSessionSecret({ sessionSecret: secret, isProduction: true }), secret);
});
