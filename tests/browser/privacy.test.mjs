// What a reader actually sees on /privacy at phone width: no "[" or "]" (placeholder text), and
// the Delete my map section is there.   BASE=http://localhost:3102 npm run test:browser
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const skip = !findChrome() && "no Chromium installed";
const open = [];
after(async () => { for (const b of open) await b.close(); });

test("/privacy: no brackets in the visible text", { skip }, async () => {
  const b = await launch({ width: 390, height: 844 });
  open.push(b);
  await b.goto(`${BASE}/privacy`);
  const text = await b.eval("document.querySelector('main').innerText");
  assert.doesNotMatch(text, /[[\]]/);
  assert.match(text, /Delete my map/);
  if (process.env.PRIVACY_SHOT) {
    mkdirSync("/tmp/wm-privacy", { recursive: true });
    const h = await b.eval("document.documentElement.scrollHeight");
    await b.shot(process.env.PRIVACY_SHOT, { x: 0, y: 0, width: 390, height: h });
  }
});
