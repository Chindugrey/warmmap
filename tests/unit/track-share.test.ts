// What one share tap sends: the event, the map's slug and the channel, nothing else.
import test from "node:test";
import assert from "node:assert/strict";
import { trackShare } from "@/lib/track-share";

test("a share tap posts event, map slug and channel only; no owner key, and a failed post is swallowed", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}");
  }) as typeof fetch;
  try {
    await trackShare("copy", "abc123xy");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/analytics");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { event: "share", map: "abc123xy", metadata: { channel: "copy" } });
    const h = new Headers(calls[0].init.headers);
    assert.equal(h.get("x-owner-key"), null, "a tap never carries the map's key");
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    await trackShare("story", "abc123xy"); // must not throw
  } finally {
    globalThis.fetch = real;
  }
});
