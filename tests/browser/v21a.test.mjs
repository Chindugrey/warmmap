// Warm Map v2.1a in a real browser (headless Chromium, no packages), against a LOCAL server.
//   V21A=on  BASE=http://localhost:3105 node --test tests/browser/v21a.test.mjs   (server built with NEXT_PUBLIC_WM_V21A=1)
//   V21A=off BASE=http://localhost:3105 node --test tests/browser/v21a.test.mjs   (default build: the launch UI)
// Sizes: 390x844, 360x640, 1440x900. Screenshots + DOM dumps go to $SHOTS (default /tmp/wm-v21a).
// Share sheet, clipboard and window.open are stubbed; nothing leaves the machine.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3105";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const ON = process.env.V21A === "on";
const LABEL = process.env.LABEL ?? (ON ? "on" : "off");
const SHOTS = process.env.SHOTS ?? "/tmp/wm-v21a";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
const FRIENDS = ["Meeraqx", "Kabirqx", "Farahqx", "Devqx", "Taraqx"];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai"];
const WISH = "a Head of Designqx at a fintech";
const SIZES = [[390, 844, true], [360, 640, true], [1440, 900, false]];
const open = [];
after(async () => { for (const b of open) await b.close(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (b) => b.eval("document.body.innerText");
async function clickText(b, label, sel = "button,a") {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
  assert.ok(ok, `no "${label}" to click`);
  await sleep(250);
}
const has = (b, label, sel = "button,a") => b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].some(e=>e.textContent.trim()===${JSON.stringify(label)})`);
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
// A DOM dump with the per-run map id removed, so an OFF build can be diffed against the launch build.
const dump = async (b, name) => {
  const html = await b.eval(`document.querySelector('.wm').outerHTML
    .replace(/(%2F|\\/)m(%2F|\\/)[A-Za-z0-9]{6,}/g,'$1m$2SLUG').replace(/(%23|#)k(%3D|=)[A-Za-z0-9_%-]+/g,'$1k$2KEY')
    .replace(/id=[A-Za-z0-9_-]{6,}/g,'id=SLUG').replace(/[\\d,]+ lanterns lit so far/g,'N lanterns lit so far')`);
  writeFileSync(`${SHOTS}/dom-${LABEL}-${name}.html`, html);
};

async function makeMap(w, h, mobile) {
  const b = await launch({ width: w, height: h, mobile, reducedMotion: true });
  open.push(b);
  await b.goto(BASE + "/");
  await b.eval(`window.__opened=[];window.open=(u)=>{window.__opened.push(u);return {location:{},close(){}}};
    window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{window.__copied.push(t)}},configurable:true});
    window.__shared=[];navigator.canShare=()=>true;navigator.share=async(d)=>{window.__shared.push({files:(d.files||[]).map(f=>f.name+':'+f.type)})};true`);
  await clickText(b, "Light my first lantern");
  await clickText(b, "Bengaluru");
  const tag = `${w}`;
  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      await b.shot(`${SHOTS}/${LABEL}-q1-${tag}.png`);
      await dump(b, `q1-${tag}`);
      // The sub-line (plan 3.1) under the first question: only with the flag on.
      assert.equal((await text(b)).includes("The one who'd pick up, and not ask why until you're okay."), ON);
      assert.equal(await b.eval(`document.querySelectorAll('.wm-sub').length`), ON ? 1 : 0);
    }
    await type(b, ".wm-flds label:nth-child(1) input", FRIENDS[i]);
    await type(b, ".wm-flds label:nth-child(2) input", CITIES[i]);
    await clickText(b, "Light it");
    await sleep(150);
  }
  await dump(b, `q6-${tag}`);
  await clickText(b, "See my map");
  await waitFor(b, `!!document.querySelector('.wm-reveal')`);
  await b.eval(`document.querySelector('.wm-reveal').click()`);
  await waitFor(b, `!!document.querySelector('.wm-reveal.wm-done')`, 2000);
  await type(b, "#wm-owner", "Ananya");
  await clickText(b, "Show me");
  await waitFor(b, `document.body.innerText.includes("Your corner is glowing.")`);
  await sleep(500);
  return b;
}

for (const [w, h, mobile] of SIZES) {
  test(`${ON ? "ON" : "OFF"} ${w}x${h}`, { skip }, async () => {
    const b = await makeMap(w, h, mobile);
    const tag = `${w}`;
    // The live counter changes between runs; pin it so the screenshots of two builds can be compared byte for byte.
    await b.eval(`[...document.querySelectorAll('p')].forEach((p)=>{if(/lanterns lit so far/.test(p.textContent))p.textContent='N lanterns lit so far'})`);
    await b.shot(`${SHOTS}/${LABEL}-share-${tag}.png`);
    await dump(b, `share-${tag}`);
    const noHScroll = await b.eval(`document.documentElement.scrollWidth <= innerWidth`);
    assert.ok(noHScroll, "no horizontal scroll");

    if (!ON) {
      // The launch UI: no sub-line, no 2027 card, "Share on LinkedIn" is still the plain share-offsite link.
      assert.ok(!(await text(b)).includes("2027"));
      assert.equal(await b.eval(`document.querySelectorAll('.wm-sub,.wm-27,.wm-kit').length`), 0);
      assert.match(await b.eval(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Share on LinkedIn').href`), /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\//);
      return;
    }

    // ── ON ──
    // 2027 card sits right under the share buttons, optional, on the phone only.
    assert.ok((await text(b)).includes("Who do you want a warm intro to in 2027?"));
    assert.ok((await text(b)).includes("Optional"));
    await type(b, "#wm-27in", "ab");
    await clickText(b, "Add");
    assert.ok((await text(b)).includes("A role or a company, a few words."));
    await b.eval(`document.querySelector('#wm-27in').select()`);
    await type(b, "#wm-27in", WISH);
    await clickText(b, "Add");
    assert.ok(await has(b, `×`));
    await b.eval(`document.querySelector('.wm-27 input[type=checkbox]').click()`);
    await sleep(200);
    await b.shot(`${SHOTS}/on-2027-${tag}.png`);

    // Kit opens from "Share on LinkedIn" (a button now, no navigation).
    assert.equal(await b.eval(`document.querySelectorAll('a[href*="share-offsite"]').length`), 0);
    await clickText(b, "Share on LinkedIn");
    assert.ok(await b.eval(`!!document.querySelector('.wm-kit')`));
    assert.ok((await text(b)).includes("Thank them in public"));
    assert.ok((await text(b)).includes("Nothing is posted until you press Post on LinkedIn."));
    // Names are OUT by default.
    assert.equal(await b.eval(`document.querySelector('input[name=wm-kit-names]').checked`), true);
    let post = await b.eval(`document.querySelector('#wm-kit-post').value`);
    for (const n of FRIENDS) assert.ok(!post.includes(n), `${n} in the default post`);
    assert.match(post, /5 people who've had my back, across 5 cities\. You know who you are\. Thank you\./);
    assert.ok(post.includes("In 2027 I'd love a warm intro to " + WISH));
    assert.equal(await b.eval(`document.querySelectorAll('.wm-tags').length`), 0, "no checklist while names are out");
    await b.shot(`${SHOTS}/on-kit-default-${tag}.png`);

    // Choosing names: the consent line is shown, and NOTHING named or copyable exists until it is ticked.
    await b.eval(`document.querySelectorAll('input[name=wm-kit-names]')[1].click()`);
    await sleep(250);
    assert.ok((await text(b)).includes("Named people will be tagged publicly; tag only people who'd be happy to be thanked in public."));
    assert.equal(await b.eval(`!!document.querySelector('#wm-kit-post')`), false, "no post text before consent");
    for (const label of ["Share to LinkedIn", "Just copy the post", "Copy post", "Open LinkedIn"]) assert.ok(!(await has(b, label)), `${label} before consent`);
    assert.ok(!(await text(b)).includes("Meeraqx"), "a friend's name before consent");
    assert.ok((await text(b)).includes("Tick the line above to copy your post."));
    await b.shot(`${SHOTS}/on-kit-gated-${tag}.png`);

    // Tick: the named post, the checklist, no "@".
    await b.eval(`document.querySelector('.wm-kit .wm-consent input').click()`);
    await sleep(250);
    post = await b.eval(`document.querySelector('#wm-kit-post').value`);
    assert.match(post, /Meeraqx would get my 2am call\./);
    assert.ok(!post.includes("@"));
    assert.ok((await text(b)).includes("On LinkedIn, type @ before each name and pick the person from the list. Pasted names don't tag."));
    assert.equal(await b.eval(`document.querySelectorAll('.wm-tag').length`), 5);
    assert.ok((await text(b)).includes("0 of 5 tagged"));
    await b.eval(`document.querySelector('.wm-tag input').click()`);
    await sleep(150);
    assert.ok((await text(b)).includes("1 of 5 tagged"));
    assert.match(await b.eval(`document.querySelector('.wm-tag a').href`), /^https:\/\/www\.linkedin\.com\/search\/results\/people\/\?keywords=Meeraqx%20Kochi$/);
    await b.shot(`${SHOTS}/on-kit-consented-${tag}.png`);

    // The send path: phones leave through the share sheet with the card picture; desktop opens LinkedIn's composer.
    await waitFor(b, `performance.getEntriesByType('resource').some((r)=>r.name.includes('/api/og?id=')&&!r.name.includes('dl=1')&&!r.name.includes('f=story')&&r.responseEnd>0)`, 20000); // the card picture is fetched before the tap
    await sleep(400);
    if (mobile) {
      await clickText(b, "Share to LinkedIn");
      await sleep(300);
      assert.equal((await b.eval(`window.__copied`)).at(-1).includes("Meeraqx"), true, "the post is copied");
      assert.deepEqual(await b.eval(`window.__shared`), [{ files: ["warm-map-card.png:image/png"] }]);
      assert.ok(await has(b, "Just copy the post"));
    } else {
      assert.ok(!(await has(b, "Share to LinkedIn", ".wm-kit button")));
      await clickText(b, "Open LinkedIn");
      assert.deepEqual(await b.eval(`window.__opened`), ["https://www.linkedin.com/feed/?shareActive=true"]);
      assert.equal((await b.eval(`window.__copied`)).length, 1);
    }

    // Back to names out: the names and the checklist are gone again, the consent resets.
    await b.eval(`document.querySelectorAll('input[name=wm-kit-names]')[0].click()`);
    await sleep(250);
    assert.ok(!(await b.eval(`document.querySelector('#wm-kit-post').value`)).includes("Meeraqx"));
    assert.equal(await b.eval(`document.querySelectorAll('.wm-tag').length`), 0);
    await b.eval(`document.querySelectorAll('input[name=wm-kit-names]')[1].click()`);
    await sleep(200);
    assert.equal(await b.eval(`!!document.querySelector('#wm-kit-post')`), false, "consent is asked again");

    // Privacy: no request ever carried a friend's name, the 2027 text or the post.
    const sent = JSON.stringify(b.requests.filter((r) => !r.url.includes("/_next/")).map((r) => [r.url, r.body]));
    for (const secret of [...FRIENDS, WISH, "warm intro"]) assert.ok(!sent.includes(secret), `"${secret}" left the phone`);
    assert.ok(!/people|distinct/i.test(sent), "a people count left the phone");
    assert.deepEqual(b.errors.filter((e) => !/favicon|Failed to load resource/.test(e)), []);
  });
}

test("ON/OFF: kit wiring only exists with the flag (marker for the run)", () => {
  assert.ok(true, `V21A=${ON ? "on" : "off"}`);
});
