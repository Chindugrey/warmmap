// Verifier round 2 (real browser): a near miss only the full list knows still gets its one-tap "Did you mean".
//   BASE=http://localhost:3100 CHROME=... node --test tests/browser/places-verify.test.mjs
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const skip = !findChrome() && "no Chromium installed";
const open = [];
after(async () => { for (const b of open) await b.close(); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (b, label) => b.eval(`(()=>{const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);

for (const [typed, want] of [["Sacremento", "Sacramento"], ["Idukki", "Idukki district, Kerala"]]) {
  test(`lantern: ${typed} after its suggestions arrived offers ${want} as a one-tap "Did you mean"`, { skip }, async () => {
    const b = await launch({ width: 390, height: 844 });
    open.push(b);
    await b.goto(BASE + "/", 1000);
    await b.eval("localStorage.clear()");
    await b.goto(BASE + "/", 1000);
    assert.ok(await click(b, "Light my first lantern")); await sleep(300);
    assert.ok(await click(b, "Bengaluru")); await sleep(500);
    await b.eval(`document.querySelector('.wm-flds label:nth-child(1) input').focus()`);
    await b.send("Input.insertText", { text: "Taraqx" });
    await b.eval(`document.querySelector('.wm-flds label:nth-child(2) input').focus()`);
    await b.send("Input.insertText", { text: typed });
    await sleep(2000); // the full-list suggestions are on screen
    assert.ok(await click(b, "Light it")); await sleep(800);
    const near = await b.eval(`[...document.querySelectorAll('[aria-label="Did you mean"] button')].map(e=>e.textContent.trim())`);
    const hint = await b.eval(`document.querySelector('[role=status]')?.textContent ?? ""`);
    assert.ok(near.includes(want), `hint "${hint}", chips ${JSON.stringify(near)}`);
  });
}
