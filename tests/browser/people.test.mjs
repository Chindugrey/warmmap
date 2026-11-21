// "People = distinct names" on the reveal, in a real browser, against a LOCAL server.
//   V21A=on  BASE=http://localhost:3105 node --test tests/browser/people.test.mjs   (server built with NEXT_PUBLIC_WM_V21A=1)
//   V21A=off BASE=http://localhost:3105 node --test tests/browser/people.test.mjs   (default build)
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
  // The analytics reveal event carries the LANTERN count (5), never the people count (3).
  const ev = sent.filter((r) => r.url.includes("/api/analytics")).map((r) => JSON.parse(r.body)).find((e) => e.event === "reveal");
  assert.equal(ev?.metadata?.n, 5, "reveal event n must be the lantern count");
  // Every request that carries a body is the same with the flag on and off (the second run compares to the first).
  const norm = sent.filter((r) => r.body).map((r) => `${r.method} ${r.url.replace(BASE, "")} ${r.body.replace(/"(ts|t|at|time)":\d+/g, '"$1":0')}`).sort();
  const mine = `/tmp/wm-people-bodies-${ON ? "on" : "off"}.json`;
  const other = `/tmp/wm-people-bodies-${ON ? "off" : "on"}.json`;
  writeFileSync(mine, JSON.stringify(norm));
  if (existsSync(other)) assert.deepEqual(norm, JSON.parse(readFileSync(other, "utf8")), "request bodies differ between flag on and off");
  for (const r of sent) {
    const all = r.url + (r.body ?? "");
    for (const f of FRIENDS) assert.ok(!all.toLowerCase().includes(f.trim().toLowerCase()), `a name left the phone: ${r.url}`);
    assert.ok(!/people/i.test(all), `a people count left the phone: ${r.url}`);
    assert.ok(!/"?(distinct|people)"?\s*:/i.test(all));
  }
  assert.ok(sent.some((r) => r.url.includes("/api/maps")), "the save request was seen");
  assert.deepEqual(b.errors.filter((e) => !/favicon|Failed to load resource/.test(e)), []);
});

// An invited visitor (a kept inviter who is not typed, or is also typed in another case): reveal == kit == expected.
async function inviter() {
  const res = await fetch(`${BASE}/api/maps`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-wm-device": `people-test-${Math.random().toString(36).slice(2)}-0123456789` },
    body: JSON.stringify({ homeCity: "Bengaluru", ownerName: "Inviterqx", entries: CITIES.map((city, i) => ({ city, questionIndex: i })) }),
  });
  assert.equal(res.status, 201, "inviter map saved");
  return (await res.json()).id;
}
for (const [label, typed, want] of [
  ["inviter not typed", ["Aqx", "Bqx", "Cqx", "Dqx", "Eqx"], 6],
  ["inviter also typed in another case", ["  INVITERqx", "Bqx", "Cqx", "Dqx", "bqx "], 4],
]) {
  test(`${ON ? "ON" : "OFF"}: invited visitor, ${label}`, { skip: skip || !ON, }, async () => {
    const slug = await inviter();
    const b = await launch({ width: 390, height: 844, mobile: true, reducedMotion: true });
    open.push(b);
    await b.goto(`${BASE}/?invitedBy=${slug}&via=thanks`);
    await waitFor(b, `document.body.innerText.includes("Inviterqx lit a lantern for you")`);
    await clickText(b, "Light my first lantern");
    await clickText(b, "Kochi");
    for (let i = 0; i < 5; i++) {
      await type(b, ".wm-flds label:nth-child(1) input", typed[i]);
      await type(b, ".wm-flds label:nth-child(2) input", CITIES[(i + 1) % 5]);
      await clickText(b, "Light it");
      await sleep(150);
    }
    await clickText(b, "See my map");
    await waitFor(b, `!!document.querySelector('.wm-reveal')`);
    await b.eval(`document.querySelector('.wm-reveal').click()`);
    await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 2000);
    await type(b, "#wm-owner", "Meera");
    await clickText(b, "Show me");
    await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
    await sleep(500);
    const fc = await b.eval(`document.querySelector('.wm-c3 .wm-fc').innerHTML.replace(/<i>[\\s\\S]*$/, '')`);
    assert.equal(fc, `<b>${want}</b><small>people</small>`);
    await clickText(b, "Share on LinkedIn");
    await waitFor(b, `!!document.querySelector('#wm-kit-post')`);
    const post = await b.eval(`document.querySelector('#wm-kit-post').value`);
    assert.match(post, new RegExp(`${want} people who've had my back`), `the kit must say what the reveal says (${want})`);
  });
}
