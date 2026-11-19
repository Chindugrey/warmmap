// "Send again on WhatsApp" must work: the link is registered once, a second tap reuses it
// (no second POST /api/thanks, so no 409 and no second hit on the monthly cap).
//   BASE=http://localhost:3103 node --test tests/browser/sendagain.test.mjs
// Screenshots + the network log go to $SHOTS (default /tmp/wm-shots).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
const FRIENDS = ["Meeraqx", "Kabirqx", "Farahqx", "Devqx", "Taraqx"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
const open = [];
after(async () => { for (const b of open) await b.close(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (b) => b.eval("document.body.innerText");
async function clickText(b, label, sel = "button,a") {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
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
  await sleep(60);
}
// Stub window.open (the wa.me navigation) and record every POST /api/thanks with its status + body.
const instrument = (b) => b.eval(`(()=>{
  window.__opened=[];window.__posts=[];
  window.open=()=>({location:{set href(v){window.__opened.push(v)}},close(){}});
  const f=window.fetch;
  window.fetch=async(u,o)=>{const r=await f(u,o);
    if(String(u).includes('/api/thanks')&&o&&o.method==='POST'){const c=r.clone();window.__posts.push({body:o.body,status:r.status,res:await c.text()})}
    return r};
  return true})()`);
const posts = (b) => b.eval("window.__posts");
const sendLabel = (b) => b.eval(`[...document.querySelectorAll('.wm-thank .wm-btn')].map(e=>e.textContent.trim()).join('|')`);

test("make → send → send again → OK; no second POST; other person and reload still work", { skip }, async () => {
  const b = await launch({ width: 390, height: 844 });
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
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-play')`);
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 1000);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  await instrument(b);
  await clickText(b, "Tell them on WhatsApp");

  // First send.
  await clickText(b, "Send on WhatsApp");
  await waitFor(b, `window.__opened.length === 1`);
  assert.equal((await posts(b)).length, 1);
  assert.equal((await posts(b))[0].status, 201);
  assert.equal(await sendLabel(b), "Send again on WhatsApp");

  // Send again: must open WhatsApp again with the SAME link, and no error.
  await clickText(b, "Send again on WhatsApp");
  await sleep(800);
  await b.shot(`${SHOTS}/sendagain-after-second-tap.png`);
  const p = await posts(b);
  writeFileSync(`${SHOTS}/sendagain-network.json`, JSON.stringify({ posts: p, opened: await b.eval("window.__opened") }, null, 2));
  assert.ok(!(await b.eval(`!!document.querySelector('[role=alert]')`)), `error shown: ${await b.eval(`document.querySelector('[role=alert]')?.textContent`)}`);
  assert.equal(await b.eval(`window.__opened.length`), 2, "WhatsApp opened a second time");
  const [w1, w2] = await b.eval(`window.__opened`);
  assert.equal(w1, w2, "same message + link");
  assert.equal(p.length, 1, "no second POST /api/thanks for the same link");

  // A different person: its own link, registered once.
  const names = await b.eval(`[...document.querySelectorAll('.wm-thank > button.wm-lnk b')].map(e=>e.textContent)`);
  assert.ok(names.length >= 2);
  await b.eval(`document.querySelectorAll('.wm-thank > button.wm-lnk')[1].click()`);
  await sleep(500);
  await clickText(b, "Send on WhatsApp");
  await waitFor(b, `window.__opened.length === 3`);
  assert.equal((await posts(b)).at(-1).status, 201);
  assert.notEqual((await posts(b))[0].body, (await posts(b)).at(-1).body);

  // Reload: local state is gone, so a re-send makes a fresh link and registers it (201, not 409).
  const slug = JSON.parse((await posts(b))[0].body).mapId;
  await b.goto(BASE + `/m/${slug}`);
  await b.shot(`${SHOTS}/sendagain-after-reload.png`);
  await instrument(b);
  await clickText(b, "Tell them on WhatsApp");
  await clickText(b, "Send on WhatsApp");
  await waitFor(b, `window.__opened.length === 1`);
  assert.equal((await posts(b))[0].status, 201);
});
