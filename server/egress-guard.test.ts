import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { installEgressGuard, isLoopbackHost } from "./egress-guard";
import { isAllowedHostHeader, isLoopbackAddress } from "./local-access";

test("egress guard: loopback host detection", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("example.com"), false);
});

test("egress guard: blocks external fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("ok")) as typeof fetch;

  installEgressGuard();

  await assert.rejects(
    () => fetch("https://example.com"),
    (error: unknown) => {
      assert.match(String((error as Error).message), /Outbound network blocked/);
      return true;
    },
  );

  // restore to avoid affecting unrelated tests
  globalThis.fetch = originalFetch;
});

test("egress guard: blocks external http request", async () => {
  installEgressGuard();

  await assert.rejects(
    async () => {
      await new Promise((resolve, reject) => {
        try {
          http.get("http://example.com", () => resolve(undefined));
        } catch (error) {
          reject(error);
        }
      });
    },
    (error: unknown) => {
      assert.match(String((error as Error).message), /Outbound network blocked/);
      return true;
    },
  );
});

test("local access: loopback address detection", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("127.0.0.42"), true);
  assert.equal(isLoopbackAddress("::1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("10.0.0.1"), false);
});

test("local access: host header allowlist", () => {
  assert.equal(isAllowedHostHeader("localhost:5000"), true);
  assert.equal(isAllowedHostHeader("127.0.0.1:5000"), true);
  assert.equal(isAllowedHostHeader("[::1]:5000"), true);
  assert.equal(isAllowedHostHeader("evil.example:5000"), false);
});
