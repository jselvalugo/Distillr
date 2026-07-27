import assert from "node:assert/strict";
import test from "node:test";
import { LoginRateLimiter, getLoginClientKey } from "./auth-rate-limit";

test("login limiter blocks after repeated failures", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 3, windowMs: 1000, blockMs: 2000 });
  const key = "127.0.0.1";
  const now = 1000;

  limiter.registerFailure(key, now);
  limiter.registerFailure(key, now + 100);
  assert.equal(limiter.isBlocked(key, now + 100), false);

  limiter.registerFailure(key, now + 200);
  assert.equal(limiter.isBlocked(key, now + 200), true);
  assert.equal(limiter.getRetryAfterSeconds(key, now + 200) > 0, true);
});

test("login limiter resets failures on successful auth", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1000, blockMs: 2000 });
  const key = "127.0.0.1";
  const now = 1000;

  limiter.registerFailure(key, now);
  limiter.registerSuccess(key);
  assert.equal(limiter.isBlocked(key, now + 10), false);

  limiter.registerFailure(key, now + 20);
  assert.equal(limiter.isBlocked(key, now + 20), false);
});

test("getLoginClientKey prefers req.ip and falls back to socket address", () => {
  assert.equal(getLoginClientKey({ ip: "10.1.1.1", socket: { remoteAddress: "127.0.0.1" } }), "10.1.1.1");
  assert.equal(getLoginClientKey({ socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");
  assert.equal(getLoginClientKey({}), "unknown");
});
