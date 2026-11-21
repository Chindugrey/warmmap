// Share taps carry their map: the real share buttons on the reveal screen and on the owner's map page, in headless
// Chromium against a LOCAL server and the LOCAL database. Each tap's POST names the saved map (its slug) and the
// channel, and the row lands on that map. A visitor sees no share buttons, so a visitor never adds a tap.
//   BASE=http://localhost:3102 DATABASE_URL=… npm run test:browser
// Share sheet, clipboard and window.open are stubbed; nothing leaves the machine.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const skip = !findChrome() && "no Chromium installed";
const db = new PrismaClient();
const FRIENDS = ["Meeraqt", "Kabirqt", "Farahqt", "Devqt", "Taraqt"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
const open = [];
const made = [];
after(async () => {
  for (const b of open) await b.close();
  await db.map.deleteMany({ where: { OR: [{ shortSlug: { in: made } }, { publicId: { in: made } }] } }); // cascades its taps
  await db.$disconnect();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(b, label, sel = "button,a") {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
  assert.ok(ok, `no "${label}" to click`);
  await sleep(300);
}
const has = (b, label) => b.eval(`[...document.querySelectorAll("button,a")].some(e=>e.textContent.trim()===${JSON.stringify(label)})`);
async function waitFor(b, fn, ms = 10000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await b.eval(fn)) return true; await sleep(150); }
  throw new Error(`timed out waiting for ${fn}`);
}
async function type(b, selector, value) {
  await b.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await b.send("Input.insertText", { text: value });
  await sleep(60);
}
// window.open, clipboard and the share sheet stubbed; a target=_blank link (LinkedIn) is recorded, not followed.
const stub = (b) => b.eval(`(()=>{window.__opened=[];window.open=(u)=>{window.__opened.push(u||'');return {location:{set href(v){window.__opened.push(v)}},close(){}}};
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  navigator.canShare=()=>true;navigator.share=async()=>{};
  window.addEventListener('click',(e)=>{const a=e.target.closest&&e.target.closest('a[target=_blank]');if(a){e.preventDefault();window.__opened.push(a.href)}});return true})()`);
const shareTaps = (b) =>
  b.requests.filter((r) => r.url.endsWith("/api/analytics") && r.method === "POST").map((r) => JSON.parse(r.body)).filter((x) => x.event === "share");

// Makes a map through the real flow and returns its slug, on the reveal screen.
async function makeMapInUi(b, owner) {
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
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 2000);
  await type(b, "#wm-owner", owner);
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  const slug = await b.eval(`JSON.parse(localStorage.getItem('wm:draft')).saved.slug`);
  made.push(slug);
  return slug;
}
const headerOf = (r, name) => Object.entries(r.headers).find(([k]) => k.toLowerCase() === name)?.[1];
const analyticsPosts = (b) => b.requests.filter((r) => r.url.endsWith("/api/analytics") && r.method === "POST");

test("every share button's tap names the saved map and its channel, and lands on that map", { skip }, async () => {
  const b = await launch({ width: 390, height: 844 });
  open.push(b);
  const slug = await makeMapInUi(b, "Ananyaqt");
  await stub(b);
  await sleep(2500); // the Story picture loads once, before its button can hand it to the share sheet

  // Reveal screen: copy link, LinkedIn, Story picture, a thank-you on WhatsApp.
  await clickText(b, "Copy link");
  if (await has(b, "Share on LinkedIn")) await clickText(b, "Share on LinkedIn");
  await clickText(b, "Save the picture for Status and Story");
  await clickText(b, "Tell them on WhatsApp");
  await clickText(b, "Send on WhatsApp");
  await waitFor(b, `window.__opened.some((u) => String(u).includes("wa.me"))`);
  await sleep(800);
  const reveal = shareTaps(b);

  // The owner's map page: copy link, LinkedIn, Story picture.
  await b.goto(BASE + `/m/${slug}`, 3500);
  await stub(b);
  await waitFor(b, `document.body.innerText.includes("Your map")`);
  await sleep(1500);
  await clickText(b, "Copy link");
  await clickText(b, "Share on LinkedIn");
  await clickText(b, "Save the picture for Status and Story");
  await sleep(1000);
  const all = shareTaps(b);

  assert.ok(reveal.length >= 3, `reveal taps: ${JSON.stringify(reveal)}`);
  for (const t of all) {
    assert.equal(t.map, slug, `a tap named another map: ${JSON.stringify(t)}`);
    assert.deepEqual(Object.keys(t).sort(), ["event", "map", "metadata"]);
    assert.deepEqual(Object.keys(t.metadata), ["channel"]);
  }
  // The map's key goes with a share tap (in the header), and with nothing else; never in a body.
  for (const r of analyticsPosts(b)) {
    const key = headerOf(r, "x-owner-key");
    if (JSON.parse(r.body).event === "share") assert.ok(key && key.length >= 20, `a share tap went without the key: ${r.body}`);
    else assert.equal(key, undefined, `the key went with ${r.body}`);
    if (key) assert.ok(!r.body.includes(key), "the key is never in a body");
  }
  const channels = all.map((t) => t.metadata.channel);
  for (const c of ["copy", "linkedin", "story", "whatsapp"]) assert.ok(channels.includes(c), `no ${c} tap in ${channels}`);

  const map = await db.map.findFirst({ where: { OR: [{ shortSlug: slug }, { publicId: slug }] } });
  assert.ok(map);
  await sleep(500);
  const rows = await db.analyticsEvent.findMany({ where: { mapId: map.id } });
  assert.deepEqual(rows.map((r) => r.event), rows.map(() => "share"), "only share taps are on the map");
  assert.deepEqual(rows.map((r) => r.metadata.channel).sort(), [...channels].sort(), "each tap is one row on this map, with its channel");

  // A visitor (no key on this browser) sees no share buttons: a tap on a map always comes from whoever holds its key.
  const v = await launch({ width: 390, height: 844 });
  open.push(v);
  await v.goto(BASE + `/m/${slug}`, 3000);
  for (const label of ["Copy link", "Share on LinkedIn", "Save the picture for Status and Story", "Tell them on WhatsApp"]) {
    assert.equal(await has(v, label), false, `a visitor sees "${label}"`);
  }
});

test("with no readable storage (no key on this phone) a share tap still counts, against no map", { skip }, async () => {
  const b = await launch({ width: 390, height: 844 });
  open.push(b);
  const slug = await makeMapInUi(b, "Ananyaqs");
  await stub(b);
  const globalBefore = await db.analyticsEvent.count({ where: { event: "share", mapId: null } });
  await b.eval(`(()=>{Storage.prototype.getItem=function(){throw new Error("storage blocked")};return 1})()`);
  const before = analyticsPosts(b).length;
  await clickText(b, "Copy link");
  if (await has(b, "Share on LinkedIn")) await clickText(b, "Share on LinkedIn");
  await sleep(1000);
  const taps = analyticsPosts(b).slice(before).filter((r) => JSON.parse(r.body).event === "share");
  assert.ok(taps.length >= 1, "a tap was sent");
  for (const r of taps) {
    assert.equal(JSON.parse(r.body).map, slug);
    assert.equal(headerOf(r, "x-owner-key"), undefined, "no key could be read, none is sent");
  }
  const map = await db.map.findFirst({ where: { OR: [{ shortSlug: slug }, { publicId: slug }] } });
  assert.equal(await db.analyticsEvent.count({ where: { mapId: map.id } }), 0, "without the key nothing lands on the map");
  assert.ok((await db.analyticsEvent.count({ where: { event: "share", mapId: null } })) - globalBefore >= taps.length, "the taps still count, globally");
});
