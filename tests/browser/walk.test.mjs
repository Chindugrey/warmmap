// Real-browser walk-through of the launch loop against a LOCAL server, using an
// already-installed headless Chromium over the DevTools protocol (no packages).
//   BASE=http://localhost:3100 npm run test:browser
// Screenshots go to $SHOTS (default /tmp/wm-shots).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";

// Friend names used in the walk: none of them may ever reach our server.
const FRIENDS = ["Meeraqx", "Kabirqx", "Farahqx", "Devqx", "Taraqx"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
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
  await b.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await b.send("Input.insertText", { text: value });
  await sleep(60);
}
async function answer(b, name, city) {
  await type(b, ".wm-flds label:nth-child(1) input", name);
  await type(b, ".wm-flds label:nth-child(2) input", city);
  await clickText(b, "Light it");
  await sleep(150);
}
const ours = (b) => b.requests.filter((r) => r.url.startsWith(BASE));
function assertNoNames(b, names) {
  for (const r of ours(b)) {
    const blob = r.url + " " + r.body + " " + JSON.stringify(r.headers);
    for (const n of names) assert.ok(!blob.includes(n), `friend name ${n} reached the server: ${r.method} ${r.url} ${r.body}`);
    assert.ok(!r.url.includes("#"), `a # part was sent: ${r.url}`);
  }
}
function captureOpens(b) {
  return b.eval(`window.__opened=[];window.open=()=>({location:{set href(v){window.__opened.push(v)}},close(){}});true`);
}

const S = {};

test("make a map: hero → home → 5 questions → reveal (tap to skip) → name at Show me → CTAs", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  S.owner = b;
  await b.goto(BASE + "/");
  const t0 = await text(b);
  assert.match(t0, /Who.s in your corner\?/);
  assert.match(t0, /Light my first lantern/);
  assert.match(await b.eval("document.querySelector('.wm-foot').innerText.replace(/\\s+/g, ' ')"), /City data © GeoNames ?, CC BY 4\.0/);
  assert.equal(await b.eval(`[...document.querySelectorAll('.wm-foot a')].filter(a=>/geonames\\.org/.test(a.href)).length`), 1);
  await b.shot(`${SHOTS}/walk-1-landing.png`);
  await clickText(b, "Light my first lantern");
  assert.match(await text(b), /Where.s home\?/);
  await clickText(b, "Bengaluru");
  assert.match(await text(b), /Chapter I · The ones who were there/);
  assert.match(await text(b), /Who would you call at 2am\?/);
  assert.match(await text(b), /5 more lanterns unlock your map/);
  await answer(b, FRIENDS[0], CITIES[0]);
  assert.match(await text(b), /There\. That.s your first light\./);
  await b.shot(`${SHOTS}/walk-2-question.png`);
  for (let i = 1; i < 5; i++) await answer(b, FRIENDS[i], CITIES[i]);
  assert.match(await text(b), /See my map/);
  const lit = await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`);
  assert.equal(lit, "5 of 8 lanterns lit");
  await clickText(b, "See my map");
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-play')`);
  await b.shot(`${SHOTS}/walk-3-reveal-dusk.png`);
  await b.eval(`document.querySelector('.wm-reveal').click()`); // tap to skip
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 1000);
  const rv = await text(b);
  assert.match(rv, /Here.s who.s in your corner\./);
  assert.match(rv, /people/);
  assert.match(rv, /km of thread/);
  assert.match(rv, /Whose map is this\?/);
  assert.equal(await b.eval(`document.querySelectorAll('.wm-fc').length`), 3);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  const done = await text(b);
  for (const c of ["Tell them on WhatsApp", "Share on LinkedIn", "Copy link"]) assert.ok(done.includes(c), `missing CTA ${c}`);
  assert.match(done, /lanterns? lit so far/, "live counter after the reveal");
  const li = await b.eval(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Share on LinkedIn').href`);
  assert.match(li, /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=.*%2Fm%2F[a-z0-9]{8}%3Fs%3Dli$/);
  S.slug = decodeURIComponent(li).match(/\/m\/([a-z0-9]{8})\?s=li$/)[1];
  const story = await b.eval(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Save the picture for Status and Story')?.getAttribute('href')`);
  assert.equal(story, `/api/og?id=${S.slug}&f=story&dl=1`);
  await b.shot(`${SHOTS}/walk-4-glowing.png`);
  assertNoNames(b, FRIENDS);
});

test("Tell them on WhatsApp: one lantern, one person; the link carries the name after # only", { skip }, async () => {
  const b = S.owner;
  await captureOpens(b);
  await clickText(b, "Tell them on WhatsApp");
  assert.match(await text(b), /Five people\. Two minutes\./);
  // First suggested row is the last question if answered, else question 1 (Meera, Kochi).
  await clickText(b, "Send on WhatsApp");
  await waitFor(b, `window.__opened.length > 0`);
  const wa = await b.eval(`window.__opened[0]`);
  const msg = decodeURIComponent(wa.replace("https://wa.me/?text=", ""));
  const m = msg.match(/(http:\/\/[^ ]+\/t\/([A-Za-z0-9]{12}))(\?s=wa)?#(\S+)$/);
  assert.ok(m, `no thank link in ${msg}`);
  assert.equal(m[3], "?s=wa", "the thank link is tagged as sent from WhatsApp");
  assert.equal(decodeURIComponent(m[4]), FRIENDS[0]);
  assert.ok(!/2am/.test(msg), "the message does not spoil the question");
  S.thank = m[1] + m[3] + "#" + m[4];
  await b.shot(`${SHOTS}/walk-5-thank-sheet.png`);
  assertNoNames(b, FRIENDS);
});

test("friend: The answer was you. → Tie it back → Tied at both ends.", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  S.friend = b;
  await b.goto(S.thank);
  const t = await text(b);
  assert.match(t, /Ananya was asked:/);
  assert.match(t, /Who would you call at 2am\?/);
  assert.match(t, /The answer was you\./);
  assert.match(t, new RegExp(`${FRIENDS[0]}, in Kochi`));
  await b.shot(`${SHOTS}/walk-6-friend.png`);
  await clickText(b, "Tie it back");
  await waitFor(b, `document.body.innerText.includes("Tied at both ends.")`);
  const t2 = await text(b);
  assert.match(t2, /Ananya will see a gold lantern in Kochi\./);
  assert.match(t2, /Tell Ananya yourself/);
  assert.match(t2, /Make yours/);
  await sleep(1600);
  await b.shot(`${SHOTS}/walk-7-tied.png`);
  assertNoNames(b, FRIENDS);
});

test("Make yours: starts with the carried lantern, still needs 5 questions", { skip }, async () => {
  const b = S.friend;
  await clickText(b, "Make yours");
  await waitFor(b, `location.search.includes("via=thanks")`);
  await sleep(800);
  assert.match(await text(b), /Ananya lit a lantern for you/);
  await clickText(b, "Light my first lantern");
  await clickText(b, "Kochi");
  const t = await text(b);
  assert.match(t, /Your first lantern is already lit\./);
  assert.match(t, /Ananya, in Bengaluru/);
  assert.match(t, /5 more lanterns unlock your map/);
  await b.shot(`${SHOTS}/walk-8-carried.png`);
  for (let i = 0; i < 4; i++) await answer(b, `F${i}qx`, CITIES[i + 1]);
  assert.ok(!(await text(b)).includes("See my map"), "4 answers + carried does not unlock");
  await answer(b, "F4qx", "Pune");
  await clickText(b, "See my map");
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await type(b, "#wm-owner", "Meera");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  const slug = decodeURIComponent(await b.eval(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Share on LinkedIn').href`)).match(/\/m\/([a-z0-9]{8})\?s=li$/)[1];
  const pub = await (await fetch(`${BASE}/api/maps/${slug}`)).json();
  assert.equal(pub.stats.lanterns, 6);
  assert.ok(pub.lanterns.includes("Bengaluru"), "the carried lantern points at the inviter's home");
  assert.ok(!JSON.stringify(pub).includes(S.slug), "the inviter is never public");
  assertNoNames(b, ["F0qx", "F1qx", "F2qx", "F3qx", "F4qx", ...FRIENDS]);
});

/** A visitor's globe: every lantern and thread amber; no gold colour, gold gradient, ring or "gold" label. */
async function assertNoGold(b, where) {
  const r = await b.eval(`(()=>{const svg=document.querySelector('svg.wm-globe');if(!svg)return {missing:true};
    const bad=[...svg.querySelectorAll('*')].filter(e=>['fill','stroke','stop-color'].some(a=>/f2c230|#wm-gG/i.test(e.getAttribute(a)||'')||/f2c230|wm-gG/i.test(e.getAttribute('style')||'')));
    return {missing:false,bad:bad.length,aria:svg.getAttribute('aria-label'),turn:svg.querySelectorAll('.wm-turn').length,html:document.body.innerText.toLowerCase()}})()`);
  assert.ok(!r.missing, `${where}: no globe`);
  assert.equal(r.bad, 0, `${where}: gold-coloured globe element for a visitor`);
  assert.ok(!/gold/i.test(r.aria), `${where}: aria mentions gold: ${r.aria}`);
  assert.equal(r.turn, 0, `${where}: gold turn for a visitor`);
  assert.ok(!/gold|answered|tied/.test(r.html), `${where}: gold wording for a visitor`);
}

test("owner returns: Kochi answered. [Share your gratitude map]; visitors see no gold", { skip }, async () => {
  const b = S.owner;
  await b.goto(`${BASE}/m/${S.slug}`, 500);
  // wait for the owner view to load (a cold dev server can take a while) instead of a fixed pause
  await waitFor(b, `document.body.innerText.includes("Kochi answered.")`, 15000);
  const t = await text(b);
  assert.match(t, /Kochi answered\./);
  assert.match(t, /The thread to Kochi is tied at both ends now\./);
  assert.match(t, /Share your gratitude map/);
  assert.equal(await b.eval(`document.querySelectorAll('.wm-turn').length`), 1);
  await sleep(1500);
  await b.shot(`${SHOTS}/walk-9-return.png`);
  const v = await browser({ width: 390, height: 844 });
  await v.goto(`${BASE}/m/${S.slug}`);
  const vt = await text(v);
  assert.match(vt, /Ananya.s Warm Map/);
  assert.match(vt, /Make yours/);
  assert.ok(!vt.includes("answered"), "no gold moment for visitors");
  assert.equal(await v.eval(`document.querySelectorAll('circle[stroke="#F2C230"]').length`), 0, "no gold ring for visitors");
  await assertNoGold(v, "390x844");
  for (const [q, want] of [["?s=wa", "&s=wa"], ["?s=bogus", null]]) {
    const m = await browser({ width: 390, height: 844 });
    await m.goto(`${BASE}/m/${S.slug}${q}`);
    const href = await m.eval(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Make yours').getAttribute('href')`);
    if (want) assert.ok(href.endsWith(want), `Make yours href ${href}`);
    else assert.ok(!href.includes("s="), `invalid tag kept: ${href}`);
  }
  const wide = await browser({ width: 1440, height: 900, mobile: false });
  await wide.goto(`${BASE}/m/${S.slug}`);
  await assertNoGold(wide, "1440x900");
  for (const n of FRIENDS) assert.ok(!(await v.eval("document.documentElement.outerHTML")).includes(n));
});

const OG_RE = /^https?:\/\/[^/]+\/api\/og(\?id=[a-z0-9]{6,32}(&v=[a-z0-9]{1,16})?)?$/;
async function metaImages(url) {
  const html = await (await fetch(url)).text();
  const metas = [...html.matchAll(/<meta[^>]+(?:property|name)="(og:[^"]+|twitter:[^"]+)"[^>]+content="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, "&")]);
  return { html, metas, images: metas.filter(([k]) => /image$/.test(k)).map(([, v]) => v) };
}

test("share cards in link previews: card URLs carry the map id only; no names anywhere, even URL-encoded", { skip }, async () => {
  for (const [page, url] of [["home", `${BASE}/`], ["map", `${BASE}/m/${S.slug}`], ["thanks", S.thank.split("#")[0]]]) {
    const { html, metas, images } = await metaImages(url);
    assert.ok(images.length >= 1, `${page}: no og:image`);
    for (const img of images) assert.match(img, OG_RE, `${page}: unexpected card URL ${img}`);
    if (page !== "home") for (const img of images) assert.match(img, new RegExp(`\\?id=${S.slug}&v=[a-z0-9]+$`), `${page}: card is not the map's versioned picture`);
    const all = decodeURIComponent(metas.map(([, v]) => v).join(" ")) + " " + html;
    for (const n of FRIENDS) {
      assert.ok(!all.includes(n) && !all.includes(encodeURIComponent(n)), `${page}: friend name ${n} in the page or its previews`);
    }
    const ogUrl = metas.find(([k]) => k === "og:url")?.[1];
    if (page === "map") assert.ok(ogUrl?.endsWith(`/m/${S.slug}`), `map og:url is ${ogUrl}`);
  }
  const res = await fetch(`${BASE}/api/og?id=${S.slug}&f=story`);
  assert.equal(res.headers.get("content-type"), "image/png");
  const buf = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [1080, 1920]);
});

test("reduced motion: the reveal is already still; halos do not breathe", { skip }, async () => {
  const b = await browser({ width: 390, height: 844, reducedMotion: true });
  await b.goto(BASE + "/");
  const anim = await b.eval(`getComputedStyle(document.querySelector('.wm-halo')).animationName`);
  assert.equal(anim, "none");
  await clickText(b, "Light my first lantern");
  await clickText(b, "Pune");
  for (let i = 0; i < 5; i++) await answer(b, `R${i}qx`, CITIES[i]);
  await clickText(b, "See my map");
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 400);
});

async function bottomOf(b, label, sel = "button,a") {
  return b.eval(`(()=>{scrollTo(0,0);const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return null;return Math.round(el.getBoundingClientRect().bottom)})()`);
}

/** A map and an unused thank-you link made over HTTP, as the owner's phone would. */
async function freshMapAndLink() {
  const dev = randomBytes(18).toString("base64url");
  const h = { "Content-Type": "application/json", "x-wm-device": dev };
  const entries = ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Pune"].map((city, questionIndex) => ({ city, questionIndex }));
  const m = await (await fetch(`${BASE}/api/maps`, { method: "POST", headers: h, body: JSON.stringify({ homeCity: "Bengaluru", ownerName: "Ananya", entries }) })).json();
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const r = await fetch(`${BASE}/api/thanks`, { method: "POST", headers: { ...h, "x-owner-key": m.ownerKey }, body: JSON.stringify({ mapId: m.id, entryIndex: 0, tokenHash }) });
  assert.equal(r.status, 201);
  return { slug: m.id, key: m.ownerKey, token };
}

test("360×640: every screen's primary button is above the fold", { skip }, async () => {
  const b = await browser({ width: 360, height: 640 });
  await b.goto(BASE + "/");
  const rows = [];
  rows.push(["landing: Light my first lantern", await bottomOf(b, "Light my first lantern")]);
  await clickText(b, "Light my first lantern");
  rows.push(["home: Kochi chip", await bottomOf(b, "Kochi")]);
  rows.push(["home: Other chip", await bottomOf(b, "Other")]);
  await clickText(b, "Bengaluru");
  rows.push(["question: Light it", await bottomOf(b, "Light it")]);
  for (let i = 0; i < 5; i++) await answer(b, `S${i}qx`, CITIES[i]);
  rows.push(["question 6: Light it", await bottomOf(b, "Light it")]);
  await clickText(b, "See my map");
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await sleep(200);
  rows.push(["reveal: Show me", await bottomOf(b, "Show me")]);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  rows.push(["glowing: Tell them on WhatsApp", await bottomOf(b, "Tell them on WhatsApp")]);
  const f = await freshMapAndLink();
  const fb = await browser({ width: 360, height: 640 });
  await fb.goto(`${BASE}/t/${f.token}#Meera`);
  rows.push(["friend: Tie it back", await bottomOf(fb, "Tie it back")]);
  await clickText(fb, "Tie it back");
  await waitFor(fb, `document.body.innerText.includes("Tied at both ends.")`);
  rows.push(["tied: Tell Ananya yourself", await bottomOf(fb, "Tell Ananya yourself")]);
  rows.push(["tied: Make yours", await bottomOf(fb, "Make yours")]);
  const ob = await browser({ width: 360, height: 640 });
  await ob.goto(`${BASE}/m/${f.slug}#k=${f.key}`, 2200);
  rows.push(["return: Share your gratitude map", await bottomOf(ob, "Share your gratitude map")]);
  await ob.shot(`${SHOTS}/small-return.png`);
  const vb = await browser({ width: 360, height: 640 });
  await vb.goto(`${BASE}/m/${f.slug}`);
  rows.push(["public: Make yours", await bottomOf(vb, "Make yours")]);
  await vb.shot(`${SHOTS}/small-public.png`);
  await fb.shot(`${SHOTS}/small-tied.png`);
  for (const [k, v] of rows) console.log(`# 360x640 ${k}: bottom ${v}px`);
  const below = rows.filter(([, v]) => v === null || v > 640);
  assert.deepEqual(below, [], `below the fold: ${JSON.stringify(below)}`);
});

test("keyboard open: the globe shrinks and Light it stays above the keyboard", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  await b.goto(BASE + "/");
  await clickText(b, "Light my first lantern");
  await clickText(b, "Bengaluru");
  await b.eval(`document.querySelector('.wm-flds input').focus()`);
  // The soft keyboard leaves about 400px of a 844px phone.
  await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 400, deviceScaleFactor: 1, mobile: true });
  await waitFor(b, `!!document.querySelector('.wm-ask.wm-kbd')`, 3000);
  await sleep(300);
  const r = await b.eval(`(()=>{const btn=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Light it').getBoundingClientRect();const g=document.querySelector('.wm-mapw svg').getBoundingClientRect();const c=document.querySelector('.wm-card').getBoundingClientRect();return {btnTop:btn.top,btnBottom:btn.bottom,vh:visualViewport.height,globe:g.height,globeBottom:g.bottom,cardTop:c.top}})()`);
  await b.shot(`${SHOTS}/keyboard-open.png`);
  console.log(`# keyboard: Light it ${Math.round(r.btnTop)}-${Math.round(r.btnBottom)} of ${r.vh}px; globe ${Math.round(r.globe)}px`);
  assert.ok(r.btnBottom <= r.vh && r.btnTop >= 0, "Light it is hidden by the keyboard");
  assert.ok(r.globe <= r.vh * 0.32 + 2 && r.globe >= 60, `globe is about a third of what is left (${r.globe}px)`);
  assert.ok(r.globeBottom <= r.cardTop + 1, "the globe does not cover the card");
});

test("small phone 360×640: primary buttons reachable", { skip }, async () => {
  const b = await browser({ width: 360, height: 640 });
  await b.goto(BASE + "/");
  const r = await b.eval(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Light my first lantern'));const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})()`);
  await b.shot(`${SHOTS}/walk-10-small-landing.png`);
  console.log(`# 360x640 landing: "Light my first lantern" at ${Math.round(r.top)}–${Math.round(r.bottom)}px (fold at 640)`);
  assert.ok(r.bottom <= 640, `Light my first lantern is below the fold at 360x640 (${r.bottom}px)`);
});

test("cities beyond the curated list: suggested with their state, pickable as home and as a lantern, and drawn", { skip }, async () => {
  const b = await browser({ width: 390, height: 844 });
  await b.goto(BASE + "/");
  await clickText(b, "Light my first lantern");
  await clickText(b, "Other");
  await type(b, ".wm-fld input", "Tirunelveli");
  await waitFor(b, `[...document.querySelectorAll('.wm-chips.small .wm-chip')].some(e=>e.textContent==='Tirunelveli')`);
  await clickText(b, "Tirunelveli");
  assert.match(await text(b), /Chapter I/);
  await type(b, ".wm-flds label:nth-child(1) input", "Meeraqx");
  await type(b, ".wm-flds label:nth-child(2) input", "Springfield");
  await waitFor(b, `[...document.querySelectorAll('.wm-chips.small .wm-chip')].some(e=>e.textContent==='Springfield, IL')`);
  const chips = await b.eval(`[...document.querySelectorAll('.wm-chips.small .wm-chip')].map(e=>e.textContent)`);
  assert.ok(chips.includes("Springfield, MO"), chips.join());
  await clickText(b, "Springfield, IL");
  await clickText(b, "Light it");
  await sleep(1200);
  assert.match(await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`), /^1 of 8/);
  // typed in full, not tapped: a city only the full list knows still lights
  await type(b, ".wm-flds label:nth-child(1) input", "Devqx");
  await type(b, ".wm-flds label:nth-child(2) input", "Winnipeg");
  await clickText(b, "Light it");
  await sleep(1200);
  assert.match(await b.eval(`document.querySelector('.wm-prog').getAttribute('aria-label')`), /^2 of 8/);
  const stored = await b.eval(`localStorage.getItem('wm:draft')`);
  assert.ok(stored.includes("Springfield, IL") && stored.includes("Winnipeg"));
  // a reload resumes the draft and can still draw those cities
  await b.goto(BASE + "/");
  await clickText(b, "Keep going", "button,a").catch(() => {});
  await b.shot(`${SHOTS}/walk-cities-full.png`);
  assert.deepEqual(b.errors.filter((e) => !/favicon/.test(e)), []);
});
