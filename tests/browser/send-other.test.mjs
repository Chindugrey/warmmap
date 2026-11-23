// Not on WhatsApp: "Send another way" (the phone's share sheet) and "Copy link" on the thank-you sheet. Both use the
// lantern's one link: registered once, reused on every later send (no second POST /api/thanks, so no second row), with
// only the ?s= tag changing. Share taps are counted as native / copy with the owner's key; no name reaches the server.
//   BASE=http://localhost:3110 node --test tests/browser/send-other.test.mjs
// Screenshots go to $SHOTS (default /tmp/wm-shots).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
const FRIENDS = ["Meeraso", "Kabirso", "Farahso", "Devso", "Taraso"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
const open = [];
after(async () => { for (const b of open) await b.close(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(b, label, sel = "button,a") {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].reverse().find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
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
// Before any page script: a stand-in share sheet and clipboard that record what they were given (or no share sheet).
const stubs = (b, share) => b.send("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__shared=[];window.__copied=[];window.__opened=[];
  ${share ? `Object.defineProperty(Navigator.prototype,'share',{configurable:true,value:async(d)=>{window.__shared.push(d)}});` : `try{delete Navigator.prototype.share}catch{};`}
  Object.defineProperty(Navigator.prototype,'clipboard',{configurable:true,get:()=>({writeText:async(t)=>{window.__copied.push(t)}})});
  window.open=()=>({location:{set href(v){window.__opened.push(v)}},close(){}});
  const f=window.fetch;window.__posts=[];window.__taps=[];
  window.fetch=async(u,o)=>{const r=await f(u,o);
    if(String(u).includes('/api/thanks')&&o&&o.method==='POST'){const c=r.clone();window.__posts.push({body:o.body,status:r.status,res:await c.text()})}
    if(String(u).includes('/api/analytics')&&o&&String(o.body).includes('"share"')){const h=new Headers(o.headers);window.__taps.push({body:JSON.parse(o.body),key:h.get('x-owner-key')})}
    return r};` });
const ours = (b) => b.requests.filter((r) => r.url.startsWith(BASE));
function assertNoNames(b) {
  for (const r of ours(b)) {
    const blob = r.url + " " + r.body + " " + JSON.stringify(r.headers);
    for (const n of FRIENDS) assert.ok(!blob.includes(n), `friend name ${n} reached the server: ${r.method} ${r.url} ${r.body}`);
    assert.ok(!r.url.includes("#"), `a # part was sent: ${r.url}`);
  }
}
const token = (u) => u.match(/\/t\/([A-Za-z0-9]{12})/)[1];

async function makeMap(b) {
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
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 3000);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
}

test("Copy link → Send another way → WhatsApp → reload → Copy link: one link, one row, tagged per channel, counted", { skip }, async () => {
  const b = await launch({ width: 390, height: 844 });
  open.push(b);
  await stubs(b, true);
  await makeMap(b);
  // Follow Zeyhi on LinkedIn sits under the share buttons: a plain link, nothing tracked.
  const follow = await b.eval(`(()=>{const a=[...document.querySelectorAll('a')].find(e=>e.textContent.trim()==='Follow Zeyhi on LinkedIn');return a&&{href:a.href,rel:a.rel,target:a.target}})()`);
  assert.deepEqual(follow, { href: "https://www.linkedin.com/company/zeyhi/", rel: "noopener noreferrer", target: "_blank" });
  await b.shot(`${SHOTS}/launch-reveal-follow-390.png`);
  await clickText(b, "Tell them on WhatsApp");
  await waitFor(b, `!!document.querySelector('.wm-sends')`);
  const t = await b.eval("document.querySelector('.wm-sheet').innerText");
  assert.match(t, /Send another way/);
  assert.match(t, /Copy link/);
  assert.match(t, /Send it however you talk to them\./);
  const primary = await b.eval(`[...document.querySelectorAll('.wm-thank .wm-btn')].map(e=>[e.textContent.trim(),e.className])`);
  assert.deepEqual(primary[0], ["Send on WhatsApp", "wm-btn"], "WhatsApp stays the primary send");
  await b.shot(`${SHOTS}/launch-thank-sheet-390.png`);

  // Copy link: registers the link once; the copied text carries the message and the link tagged ?s=cp.
  await clickText(b, "Copy link");
  await waitFor(b, `window.__copied.length === 1`);
  let posts = await b.eval("window.__posts");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].status, 201);
  const copied = await b.eval("window.__copied[0]");
  const tok = token(copied);
  assert.match(copied, new RegExp(`/t/${tok}\\?s=cp#${FRIENDS[0]}$`));
  assert.match(copied, /it was you\. Thank you\./);
  assert.match(await b.eval("document.querySelector('.wm-sheet').innerText"), /Copied/);

  // Send another way: the same token, no second POST, no ?s= (the share sheet has no tag of its own).
  await clickText(b, "Send another way");
  await waitFor(b, `window.__shared.length === 1`);
  const shared = await b.eval("window.__shared[0]");
  assert.equal(token(shared.text), tok);
  assert.match(shared.text, new RegExp(`/t/${tok}#${FRIENDS[0]}$`));
  // WhatsApp: still the same link.
  await clickText(b, "Send again on WhatsApp");
  await waitFor(b, `window.__opened.length === 1`);
  assert.equal(token(decodeURIComponent(await b.eval("window.__opened[0]"))), tok);
  posts = await b.eval("window.__posts");
  assert.equal(posts.length, 1, "no second POST /api/thanks for the same lantern, whatever the channel");
  await sleep(400);
  const taps = await b.eval("window.__taps");
  assert.deepEqual(taps.map((x) => x.body.metadata.channel), ["copy", "native", "whatsapp"]);
  for (const x of taps) {
    assert.match(x.key ?? "", /^[A-Za-z0-9_-]{43}$/, "a share tap goes with the owner's key");
    assert.deepEqual(Object.keys(x.body.metadata), ["channel"], "no names or anything else in the tap");
  }
  const slug = JSON.parse(posts[0].body).mapId;

  // Reload: Copy link checks the kept link once (server: reused, 200) and copies the very same token.
  await b.goto(`${BASE}/m/${slug}`);
  await clickText(b, "Tell them on WhatsApp");
  await waitFor(b, `!!document.querySelector('.wm-sends')`);
  await clickText(b, "Copy link");
  await waitFor(b, `window.__copied.length === 1`);
  posts = await b.eval("window.__posts");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].status, 200);
  assert.equal(JSON.parse(posts[0].res).reused, true);
  assert.equal(token(await b.eval("window.__copied[0]")), tok);
  await clickText(b, "Send another way");
  await waitFor(b, `window.__shared.length === 1`);
  assert.equal((await b.eval("window.__posts")).length, 1, "checked once per visit, then reused");
  assertNoNames(b);
  assert.deepEqual(b.errors.filter((e) => !/favicon/.test(e)), []);
});

test("no share sheet on this phone: Send another way is hidden; Copy link still works", { skip }, async () => {
  const b = await launch({ width: 1440, height: 900, mobile: false });
  open.push(b);
  await stubs(b, false);
  await makeMap(b);
  await clickText(b, "Tell them on WhatsApp");
  await waitFor(b, `!!document.querySelector('.wm-sends')`);
  const t = await b.eval("document.querySelector('.wm-sheet').innerText");
  assert.ok(!/Send another way/.test(t), "no share sheet, no button");
  assert.match(t, /Copy link/);
  await b.shot(`${SHOTS}/launch-thank-sheet-desktop.png`);
  await clickText(b, "Copy link");
  await waitFor(b, `window.__copied.length === 1`);
  assert.match(await b.eval("window.__copied[0]"), /\/t\/[A-Za-z0-9]{12}\?s=cp#Meeraso$/);
  assertNoNames(b);
});

test("360×640: the thank-you sheet's three sends fit and nothing spills sideways", { skip }, async () => {
  const b = await launch({ width: 360, height: 640 });
  open.push(b);
  await stubs(b, true);
  await makeMap(b);
  await clickText(b, "Tell them on WhatsApp");
  await waitFor(b, `!!document.querySelector('.wm-sends')`);
  const r = await b.eval(`(()=>{const w=document.documentElement.clientWidth;return [...document.querySelectorAll('.wm-thank .wm-btn')].map(e=>{const q=e.getBoundingClientRect();return {t:e.textContent.trim(),l:q.left,r:q.right,h:q.height}}).concat([{w}])})()`);
  const w = r.pop().w;
  for (const x of r) {
    assert.ok(x.l >= 0 && x.r <= w, `${x.t} spills: ${x.l}-${x.r} of ${w}`);
    assert.ok(x.h >= 44, `${x.t} is ${x.h}px tall`);
  }
  await b.eval(`document.querySelector('.wm-other').scrollIntoView({block:'center'})`);
  await b.shot(`${SHOTS}/launch-thank-sheet-360.png`);
});
