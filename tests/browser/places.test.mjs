// Real-browser check of the typed place names against a LOCAL server (see walk.test.mjs for the setup).
//   BASE=http://localhost:3100 CHROME=... node --test tests/browser/places.test.mjs
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
const open = [];
after(async () => {
  for (const b of open) await b.close();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function browser(opts) {
  const b = await launch(opts);
  open.push(b);
  return b;
}
const text = (b) => b.eval("document.body.innerText");
async function clickText(b, label, sel = "button,a") {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
  assert.ok(ok, `no "${label}" to click`);
  await sleep(250);
}
async function waitFor(b, fn, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await b.eval(fn)) return true;
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${fn}`);
}
async function type(b, selector, value) {
  await b.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select&&e.select()})()`);
  await b.send("Input.insertText", { text: value });
  await sleep(60);
}
async function enter(b) {
  for (const t of ["keyDown", "keyUp"]) await b.send("Input.dispatchKeyEvent", { type: t, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: t === "keyDown" ? "\r" : undefined });
  await sleep(300);
}
const chips = (b) => b.eval(`[...document.querySelectorAll('.wm-chips.small .wm-chip')].map(e=>e.textContent)`);

async function toHome(b) {
  await b.goto(BASE + "/");
  await clickText(b, "Light my first lantern");
  await clickText(b, "Other");
}

test("home: a typed Kasargod + Enter is accepted (no chip tap needed)", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  await toHome(b);
  await type(b, ".wm-fld input", "Kasargod");
  await enter(b);
  await waitFor(b, `/Chapter I/.test(document.body.innerText)`);
  await b.shot(`${SHOTS}/places-home-kasargod.png`);
  assert.deepEqual(b.errors.filter((e) => !/favicon/.test(e)), []);
});

test("home: a bare town (Yellowknife, Carson City) is picked as the town; Prayagraj finds Allahabad", { skip }, async () => {
  for (const [typed, want] of [["Yellowknife", "Yellowknife"], ["Carson City", "Carson City"]]) {
    const b = await browser({ width: 390, height: 844 });
    await toHome(b);
    await type(b, ".wm-fld input", typed);
    await waitFor(b, `[...document.querySelectorAll('.wm-chips.small .wm-chip')].some(e=>e.textContent===${JSON.stringify(want)})`);
    assert.ok(!(await chips(b)).some((c) => /division|district/.test(c) && !c.includes(",")), (await chips(b)).join());
    await enter(b);
    await waitFor(b, `/Chapter I/.test(document.body.innerText)`);
    assert.match(await b.eval(`localStorage.getItem('wm:draft')||''`), new RegExp(want));
  }
  const b = await browser({ width: 390, height: 844 });
  await toHome(b);
  await type(b, ".wm-fld input", "Prayagraj");
  await waitFor(b, `[...document.querySelectorAll('.wm-chips.small .wm-chip')].some(e=>e.textContent==='Allahabad')`);
  assert.equal((await chips(b))[0], "Allahabad");
});

test("lantern screen: a typed Kasargod and a full county name both light; Did you mean is one tap", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  await toHome(b);
  await type(b, ".wm-fld input", "Kochi");
  await waitFor(b, `[...document.querySelectorAll('.wm-chips.small .wm-chip')].some(e=>e.textContent==='Kochi')`);
  await clickText(b, "Kochi");
  await waitFor(b, `/Chapter I/.test(document.body.innerText)`);
  await type(b, ".wm-flds label:nth-child(1) input", "Meeraqx");
  await type(b, ".wm-flds label:nth-child(2) input", "Kasargod");
  await clickText(b, "Light it");
  await sleep(1200);
  assert.match(await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`), /^1 of 8/);
  await type(b, ".wm-flds label:nth-child(1) input", "Devqx");
  await type(b, ".wm-flds label:nth-child(2) input", "Franklin County, Ohio");
  await sleep(800);
  await clickText(b, "Light it");
  await sleep(1200);
  assert.match(await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`), /^2 of 8/);
  const stored = await b.eval(`localStorage.getItem('wm:draft')`);
  assert.ok(stored.includes("Kasaragod") && stored.includes("Franklin County, Ohio"), stored);
  // a near miss is offered as chips, one tap picks it, and Light it then lights
  await type(b, ".wm-flds label:nth-child(1) input", "Taraqx");
  await type(b, ".wm-flds label:nth-child(2) input", "Kozhikdoe");
  await clickText(b, "Light it");
  await waitFor(b, `!!document.querySelector('[aria-label="Did you mean"] .wm-chip')`);
  const near = await b.eval(`document.querySelector('[aria-label="Did you mean"] .wm-chip').textContent`);
  assert.equal(near, "Kozhikode");
  await clickText(b, near);
  await clickText(b, "Light it");
  await sleep(1200);
  assert.match(await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`), /^3 of 8/);
  await b.shot(`${SHOTS}/places-lantern.png`);
  assert.deepEqual(b.errors.filter((e) => !/favicon/.test(e)), []);
});
