// /privacy must never ship placeholder text: no "[" or "]" in what a reader sees.
// Against a running local server (same BASE as the other API tests).
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3102";
if (!/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error(`refusing non-local target: ${BASE}`);

test("/privacy server HTML has no square brackets outside script, style and code", async () => {
  const res = await fetch(`${BASE}/privacy`);
  assert.equal(res.status, 200);
  const html = await res.text();
  const text = html
    .replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ");
  assert.ok(text.includes("Delete my map"), "the page rendered");
  assert.doesNotMatch(text, /[[\]]/);
});
