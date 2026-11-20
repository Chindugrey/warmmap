// "People = distinct names" on the reveal, in a real browser, against a LOCAL server.
//   V21A=on  BASE=http://localhost:3105 node --test tests/browser/people.test.mjs   (server built with NEXT_PUBLIC_WM_V21A=1)
//   V21A=off BASE=http://localhost:3105 node --test tests/browser/people.test.mjs   (default build)
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3105";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const ON = process.env.V21A === "on";
const skip = !findChrome() && "no Chromium installed";
// Five lanterns, three distinct names (same name in other case / with spaces counts once).
const FRIENDS = ["Meeraqx", "  mEERAQX ", "Kabirqx", "MEERAQX", "Taraqx"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
const open = [];
after(async () => { for (const b of open) await b.close(); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(b, label) {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
  assert.ok(ok, `no "${label}" to click`);
  await sleep(250);
}
async function waitFor(b, fn, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await b.eval(fn)) return true; await sleep(150); }
  throw new Error(`timed out waiting for ${fn}`);
}
async function type(b, selector, value) {
  await b.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await b.send("Input.insertText", { text: value });
}

test(`${ON ? "ON" : "OFF"}: reveal people number, and nothing name-derived leaves the phone`, { skip }, async () => {
  const b = await launch({ width: 390, height: 844, mobile: true, reducedMotion: true });
  open.push(b);
  await b.goto(BASE + "/");
  await clickText(b, "Light my first lantern");
  await clickText(b, "Bengaluru");
  for (let i = 0; i < 5; i++) {
    await type(b, ".wm-flds label:nth-child(1) input", FRIENDS[i]);
    await type(b, ".wm-flds label:nth-child(2) input", CITIES[i]);
    await clickText(b, "Light it");
    await sleep(150);
  }
  await clickText(b, "See my map");
  await waitFor(b, `!!document.querySelector('.wm-reveal')`);
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 2000);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  await sleep(500);

  // The number: 3 distinct names with the flag on, the 5 lanterns as at launch with it off. Same markup either way.
  const fc = await b.eval(`document.querySelector('.wm-c3 .wm-fc').innerHTML.replace(/<i>[\\s\\S]*$/, '')`);
  assert.equal(fc, ON ? "<b>3</b><small>people</small>" : "<b>5</b><small>people</small>");

  // The share picture the page asks for is the server's; it carries the map id only.
  const sent = b.requests.filter((r) => !r.url.includes("/_next/"));
  for (const r of sent) {
    const all = r.url + (r.body ?? "");
    for (const f of FRIENDS) assert.ok(!all.toLowerCase().includes(f.trim().toLowerCase()), `a name left the phone: ${r.url}`);
    assert.ok(!/people/i.test(all), `a people count left the phone: ${r.url}`);
    assert.ok(!/"?(distinct|people)"?\s*:/i.test(all));
  }
  assert.ok(sent.some((r) => r.url.includes("/api/maps")), "the save request was seen");
  assert.deepEqual(b.errors.filter((e) => !/favicon|Failed to load resource/.test(e)), []);
});
