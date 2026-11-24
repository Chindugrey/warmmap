// The carried lantern survives the back-and-forth: a friend taps "Make yours" before tying, starts, goes back, ties,
// then taps "Start my map". The map must still start with the owner's lantern and keep who brought them.
//   BASE=http://localhost:3110 node --test tests/browser/carried.test.mjs
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
// node --test runs the files in name order, so this one runs first and cannot count on another test making the folder.
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
const open = [];
after(async () => { for (const b of open) await b.close(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const dev = randomBytes(18).toString("base64url");
async function post(path, body, key) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", "x-wm-device": dev, ...(key ? { "x-owner-key": key } : {}) }, body: JSON.stringify(body) });
  return r.json();
}
async function ownerWithLink() {
  const m = await post("/api/maps", { homeCity: "Bengaluru", ownerName: "Ananya", entries: ["Kochi", "Pune", "Delhi", "Mumbai", "Chennai"].map((city, questionIndex) => ({ city, questionIndex })), repeatMax: 1 });
  let token = "";
  while (token.length < 12) token += randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "");
  token = token.slice(0, 12);
  await post("/api/thanks", { mapId: m.id, entryIndex: 0, tokenHash: createHash("sha256").update(token).digest("hex") }, m.ownerKey);
  return { slug: m.id, token };
}
const draft = (b) => b.eval(`JSON.parse(localStorage.getItem('wm:draft')||'null')`);
const makeYoursEvents = (b) => b.requests.filter((r) => r.url.endsWith("/api/analytics") && r.body.includes('"make_yours"')).length;

test("Make yours (before the tie) → start → back → tie → Start my map: the carried lantern and the inviter stay", { skip }, async () => {
  const { slug, token } = await ownerWithLink();
  const b = await launch({ width: 390, height: 844, reducedMotion: true });
  open.push(b);
  await b.goto(`${BASE}/t/${token}#Meera`);
  await clickText(b, "Make yours");
  await waitFor(b, `document.body.innerText.includes("Ananya is in your corner")`);
  await clickText(b, "Light my first lantern");
  await waitFor(b, `!!(JSON.parse(localStorage.getItem('wm:draft')||'null')||{}).invitedBy`);
  await b.goto(`${BASE}/t/${token}#Meera`); // back to the thank-you page
  await clickText(b, "Tie it back");
  await waitFor(b, `document.body.innerText.includes("Ananya is in your corner.")`);
  await clickText(b, "Start my map");
  await waitFor(b, `location.search.includes("via=thanks")`);
  await waitFor(b, `document.body.innerText.includes("Ananya is in your corner. Your first lantern is lit")`);
  const d = await draft(b);
  assert.equal(d.invitedBy, slug);
  assert.equal(d.via, "thanks");
  assert.equal(d.carried?.city, "Bengaluru");
  assert.equal(makeYoursEvents(b), 1, "the second arrival from the same inviter is not a new make_yours");
  await b.shot(`${SHOTS}/carried-back-and-forth-hero.png`);

  await clickText(b, "Light my first lantern");
  await clickText(b, "Kochi");
  assert.match(await b.eval("document.body.innerText"), /Your first lantern is already lit\./);
  for (const [i, city] of ["Delhi", "Mumbai", "London", "Chennai", "Pune"].entries()) {
    await type(b, ".wm-flds label:nth-child(1) input", `C${i}qx`);
    await type(b, ".wm-flds label:nth-child(2) input", city);
    await clickText(b, "Light it");
    await sleep(150);
  }
  await clickText(b, "See my map");
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await type(b, "#wm-owner", "Meera");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  const mine = (await draft(b)).saved.slug;
  const pub = await (await fetch(`${BASE}/api/maps/${mine}`)).json();
  assert.equal(pub.stats.lanterns, 6, "five answers plus the carried lantern");
  assert.ok(pub.lanterns.includes("Bengaluru"), "the carried lantern points at the inviter's home");
});

test("a saved draft from the same inviter that lost its carried lantern gets it back on the next visit", { skip }, async () => {
  const { slug } = await ownerWithLink();
  const b = await launch({ width: 390, height: 844, reducedMotion: true });
  open.push(b);
  await b.goto(`${BASE}/?invitedBy=${slug}&via=thanks`);
  await clickText(b, "Light my first lantern");
  await waitFor(b, `!!(JSON.parse(localStorage.getItem('wm:draft')||'null')||{}).carried`);
  await b.eval(`(()=>{const d=JSON.parse(localStorage.getItem('wm:draft'));d.carried=null;localStorage.setItem('wm:draft',JSON.stringify(d));return true})()`);
  await b.goto(`${BASE}/?invitedBy=${slug}&via=thanks`);
  await waitFor(b, `document.body.innerText.includes("Ananya is in your corner")`);
  await clickText(b, "Light my first lantern");
  await waitFor(b, `(JSON.parse(localStorage.getItem('wm:draft')||'null')||{}).carried?.city === "Bengaluru"`);
  assert.equal((await draft(b)).invitedBy, slug);
  assert.equal(makeYoursEvents(b), 1);
});
