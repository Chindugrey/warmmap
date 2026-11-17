import test from "node:test";
import assert from "node:assert/strict";
import { istDayStart } from "@/lib/dashboard";
import { makeAdminSession, sessionValid, adminTokenSet, tokenMatches } from "@/lib/admin";

test("IST day starts at 18:30 UTC the evening before", () => {
  assert.equal(istDayStart(new Date("2026-11-18T20:00:00Z")).toISOString(), "2026-11-18T18:30:00.000Z"); // 01:30 IST on the 19th
  assert.equal(istDayStart(new Date("2026-11-19T03:00:00Z")).toISOString(), "2026-11-18T18:30:00.000Z"); // 08:30 IST on the 19th
  assert.equal(istDayStart(new Date("2026-11-19T18:29:59Z")).toISOString(), "2026-11-18T18:30:00.000Z");
  assert.equal(istDayStart(new Date("2026-11-19T18:30:00Z")).toISOString(), "2026-11-19T18:30:00.000Z");
});

test("admin session cookie: signed, expiring, off when ADMIN_TOKEN is unset or short", () => {
  const was = process.env.ADMIN_TOKEN;
  try {
    process.env.ADMIN_TOKEN = "unit-test-admin-token-123";
    const c = makeAdminSession(1_000_000_000_000)!;
    assert.ok(sessionValid(c, 1_000_000_000_001));
    assert.ok(!sessionValid(c, 1_000_000_000_000 + 9 * 3600 * 1000), "expired");
    assert.ok(!sessionValid(c.slice(0, -1) + (c.endsWith("0") ? "1" : "0"), 1_000_000_000_001), "tampered");
    assert.ok(!sessionValid(undefined) && !sessionValid(""));
    assert.ok(!c.includes("unit-test-admin-token"), "the cookie holds no secret");
    assert.ok(tokenMatches("unit-test-admin-token-123") && !tokenMatches("nope") && !tokenMatches(""));
    process.env.ADMIN_TOKEN = "other-admin-token-456789";
    assert.ok(!sessionValid(c, 1_000_000_000_001), "a cookie made under another token is void");
    process.env.ADMIN_TOKEN = "short";
    assert.equal(adminTokenSet(), null);
    assert.ok(!sessionValid(c, 1_000_000_000_001) && makeAdminSession() === null);
    delete process.env.ADMIN_TOKEN;
    assert.equal(adminTokenSet(), null);
  } finally {
    if (was === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = was;
  }
});
