// Phone layout checks against a LOCAL server in headless Chromium (no packages):
// the hero + button above the fold, the globe centred and clear of the card,
// the iOS keyboard (visual viewport shrinks, layout viewport does not), and
// globe labels inside the screen and off each other.
//   BASE=http://localhost:3100 npm run test:browser
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const SHOTS = process.env.SHOTS ?? "/tmp/wm-shots";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
// [width, height, visual viewport height with the keyboard open]
const SIZES = [[390, 844, 400], [360, 640, 340], [390, 664, 340]];
const open = [];
after(async () => { for (const b of open) await b.close(); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// iOS does not resize the layout viewport for the keyboard, only the visual one. Chromium's
// emulation resizes both, so the page gets a stand-in visualViewport it can be driven through.
const FAKE_VV = `(()=>{const t=new EventTarget();const vv={width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0,scale:1,pageTop:0,pageLeft:0,
  addEventListener:(...a)=>t.addEventListener(...a),removeEventListener:(...a)=>t.removeEventListener(...a)};
  Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});
  window.__kb=(h,top=0)=>{vv.height=h;vv.offsetTop=top;t.dispatchEvent(new Event('resize'));t.dispatchEvent(new Event('scroll'))};})()`;

async function phone(w, h, fakeVv = false) {
  const b = await launch({ width: w, height: h });
  open.push(b);
  if (fakeVv) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: FAKE_VV });
  await b.goto(BASE + "/", 900);
  return b;
}
async function clickText(b, label) {
  const ok = await b.eval(`(()=>{const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
  assert.ok(ok, `no "${label}" to click`);
  await sleep(250);
}
async function type(b, selector, value) {
  await b.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await b.send("Input.insertText", { text: value });
  await sleep(60);
}
const R = `(e)=>{const x=e.getBoundingClientRect();return {l:x.left,r:x.right,t:x.top,b:x.bottom}}`;
const rect = (b, sel) => b.eval(`(${R})(document.querySelector(${JSON.stringify(sel)}))`);

test("landing: hero and button above the fold, globe centred, nothing clipped sideways", { skip }, async () => {
  for (const [w, h] of [...SIZES.map(([w, h]) => [w, h]), [390, 750]]) {
    const b = await phone(w, h);
    const cta = await rect(b, ".wm-cta .wm-btn");
    assert.ok(cta.b <= h, `${w}x${h}: button bottom ${cta.b} below the fold`);
    const note = await rect(b, ".wm-cta .wm-note");
    assert.ok(note.b <= h, `${w}x${h}: note bottom ${note.b} below the fold`);
    const g = await rect(b, ".wm-hero .wm-mapw svg");
    assert.ok(Math.abs((g.l + g.r) / 2 - w / 2) <= 1, `${w}x${h}: globe off-centre (${(g.l + g.r) / 2})`);
    for (const sel of [".wm-hero h1", ".wm-hero .wm-kick", ".wm-hero .wm-lead", ".wm-hero .wm-top"]) {
      const e = await rect(b, sel);
      assert.ok(e.l >= 0 && e.r <= w, `${w}x${h}: ${sel} sticks out`);
    }
    for (const l of await b.eval(`[...document.querySelectorAll('.wm-hero .wm-cl')].map(${R})`)) assert.ok(l.l >= 0 && l.r <= w, `${w}x${h}: a hero label is clipped`);
    await b.shot(`${SHOTS}/layout-landing-${w}x${h}.png`);
  }
});

async function toAsk(b) {
  await clickText(b, "Light my first lantern");
  await clickText(b, "Bengaluru");
}
const cardTop = (b) => rect(b, ".wm-card");

test("question screen: globe centred and clear of the card, no keyboard", { skip }, async () => {
  for (const [w, h] of SIZES) {
    const b = await phone(w, h);
    await toAsk(b);
    const g = await rect(b, ".wm-ask .wm-mapw svg");
    const c = await cardTop(b);
    assert.ok(g.b <= c.t + 1, `${w}x${h}: globe bottom ${g.b} overlaps card top ${c.t}`);
    assert.ok(Math.abs((g.l + g.r) / 2 - w / 2) <= 1, `${w}x${h}: globe off-centre`);
    await b.shot(`${SHOTS}/layout-ask-${w}x${h}.png`);
  }
});

test("question screen at 1440x900: the globe is large and centred in its column; chapter gaps after lanterns 3 and 6", { skip }, async () => {
  const b = await launch({ width: 1440, height: 900, mobile: false });
  open.push(b);
  await b.goto(BASE + "/", 900);
  await toAsk(b);
  await sleep(400);
  const g = await rect(b, ".wm-ask .wm-mapw svg");
  const col = await rect(b, ".wm-ask .wm-mapw");
  const card = await cardTop(b);
  assert.ok(g.b - g.t >= 300 && g.r - g.l >= 300, `globe only ${Math.round(g.r - g.l)}x${Math.round(g.b - g.t)}px`);
  assert.ok(g.b <= 900, "globe runs off the screen");
  assert.ok(g.r <= card.l, "globe overlaps the card");
  assert.ok(Math.abs((g.l + g.r) / 2 - (col.l + col.r) / 2) <= 2, "globe off-centre in its column");
  const xs = await b.eval(`[...document.querySelectorAll('.wm-prog svg')].map(e=>e.getBoundingClientRect().left)`);
  const step = xs[1] - xs[0], gaps = xs.slice(1).map((x, i) => i).filter((i) => xs[i + 1] - xs[i] > step + 5);
  assert.deepEqual(gaps, [2, 5], "progress gaps after lanterns 3 and 6");
  await b.shot(`${SHOTS}/layout-ask-1440x900.png`);
});

test("keyboard open (visual viewport shrinks, layout viewport does not): card above the keys, no jump", { skip }, async () => {
  for (const [w, h, vvh] of SIZES) {
    for (const top of [0, 120]) {
      const b = await phone(w, h, true);
      await toAsk(b);
      const before = await rect(b, ".wm-ask");
      await b.eval(`document.querySelector('.wm-flds label:nth-child(1) input').focus();window.__kb(${vvh}, ${top})`);
      await sleep(400);
      const tag = `${w}x${h} vv ${vvh} panned ${top}`;
      const scr = await rect(b, ".wm-ask");
      assert.ok(Math.abs(scr.t - top) <= 1 && Math.abs(scr.b - (top + vvh)) <= 1, `${tag}: screen is not the visible window (${scr.t}..${scr.b})`);
      const card = await cardTop(b);
      assert.ok(card.t >= top && card.b <= top + vvh + 1, `${tag}: card ${card.t}..${card.b} outside the visible window`);
      for (const n of [1, 2]) {
        const f = await rect(b, `.wm-flds label:nth-child(${n}) input`);
        assert.ok(f.t >= top && f.b <= top + vvh, `${tag}: field ${n} hidden`);
      }
      const light = await b.eval(`(${R})([...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Light it'))`);
      assert.ok(light.b <= top + vvh, `${tag}: Light it is under the keyboard`);
      const g = await rect(b, ".wm-ask .wm-mapw svg");
      // little room left: the globe is hidden; otherwise it is a square, clear of the card and inside the window
      if (g.b - g.t > 0) {
        assert.ok(g.b <= card.t + 1, `${tag}: globe overlaps the card`);
        assert.ok(g.b - g.t >= 64 && Math.abs(g.b - g.t - (g.r - g.l)) <= 2, `${tag}: globe squashed to ${g.r - g.l}x${g.b - g.t}px`);
        assert.ok(g.t >= top, `${tag}: globe above the window`);
        assert.ok(card.t - g.b < 40, `${tag}: empty band of ${card.t - g.b}px above the card`);
      }
      // moving between the fields does not move anything
      const f1 = await rect(b, ".wm-flds label:nth-child(1) input");
      await b.eval(`document.querySelector('.wm-flds label:nth-child(2) input').focus()`);
      await sleep(300);
      const f1b = await rect(b, ".wm-flds label:nth-child(1) input");
      assert.equal(Math.round(f1b.t), Math.round(f1.t), `${tag}: layout jumped between fields`);
      await b.shot(`${SHOTS}/layout-kbd-${w}x${h}-${top}.png`);
      // keyboard closes: back to the same place
      await b.eval(`document.activeElement.blur();window.__kb(${h}, 0)`);
      await sleep(400);
      const after = await rect(b, ".wm-ask");
      assert.equal(Math.round(after.t), Math.round(before.t), `${tag}: did not return`);
      assert.equal(Math.round(after.b), Math.round(before.b), `${tag}: did not return`);
    }
  }
});

test("globe labels stay inside the screen and off each other (Kerala / Karnataka cluster, question and reveal)", { skip }, async () => {
  for (const [w, h] of SIZES) {
    const b = await phone(w, h);
    await toAsk(b);
    const cities = ["Kochi", "Kozhikode", "Mysuru", "Kannur", "Mangaluru"];
    for (let i = 0; i < 5; i++) {
      await type(b, ".wm-flds label:nth-child(1) input", `Nm${i}qx`);
      await type(b, ".wm-flds label:nth-child(2) input", cities[i]);
      await clickText(b, "Light it");
      await sleep(1400);
      const ls = await b.eval(`[...document.querySelectorAll('.wm-ask .wm-cl')].map(${R})`);
      for (const l of ls) assert.ok(l.l >= 0 && l.r <= w, `${w}x${h}: question label clipped (${l.l}..${l.r})`);
    }
    await clickText(b, "See my map");
    await b.eval(`document.querySelector('.wm-reveal').click()`);
    await sleep(600);
    const g = await rect(b, ".wm-reveal .wm-mapw svg");
    assert.ok(Math.abs((g.l + g.r) / 2 - w / 2) <= 1, `${w}x${h}: reveal globe off-centre`);
    const ls = await b.eval(`[...document.querySelectorAll('.wm-reveal .wm-cl')].map(e=>({t:e.textContent,...(${R})(e)}))`);
    assert.ok(ls.length >= 3, `${w}x${h}: only ${ls.length} labels on the reveal globe`);
    for (const l of ls) assert.ok(l.l >= 0 && l.r <= w, `${w}x${h}: reveal label ${l.t} clipped (${l.l}..${l.r})`);
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i], c = ls[j];
        const lap = !(a.r <= c.l + 1 || c.r <= a.l + 1 || a.b <= c.t + 1 || c.b <= a.t + 1);
        assert.ok(!lap, `${w}x${h}: reveal labels ${a.t} and ${c.t} overlap`);
      }
    await b.shot(`${SHOTS}/layout-reveal-${w}x${h}.png`);
  }
});

test("city search in the browser: Cheruvathur and Kannur are found, US lists US cities", { skip }, async () => {
  for (const [w, h] of SIZES) {
    const b = await phone(w, h);
    await clickText(b, "Light my first lantern");
    await clickText(b, "Other");
    const chips = () => b.eval(`[...document.querySelectorAll('.wm-chips.small .wm-chip')].map(e=>e.textContent.trim())`);
    await type(b, ".wm-fld input", "Cheruvathur");
    assert.equal((await chips())[0], "Cheruvathur", `${w}x${h}`);
    await b.eval(`document.querySelector('.wm-fld input').select()`);
    await b.send("Input.insertText", { text: "Kannur" });
    await sleep(100);
    const k = await chips();
    assert.equal(k[0], "Kannur");
    assert.ok(!k.includes("Kanpur"));
    await b.eval(`document.querySelector('.wm-fld input').select()`);
    await b.send("Input.insertText", { text: "US" });
    await sleep(100);
    const us = await chips();
    assert.ok(us.length >= 4 && us.every((c) => ["Austin", "New York", "San Francisco", "San Jose", "Palo Alto", "Los Angeles", "San Diego", "Seattle", "Portland", "Dallas", "Houston", "Chicago", "Boston", "Washington DC", "Philadelphia", "Atlanta", "Miami", "Denver", "Phoenix", "Las Vegas", "Salt Lake City", "Minneapolis", "Detroit", "Nashville", "Raleigh", "Charlotte", "Pittsburgh", "Newark", "Honolulu"].includes(c)), `US -> ${us}`);
    assert.match(await b.eval("document.body.innerText"), /Which city in the USA\?/);
  }
});

test("landing order: hero, narrative, founders, then the rest; confirmed copy; photos load; links open LinkedIn safely", { skip }, async () => {
  for (const [w, h] of SIZES) {
    const b = await phone(w, h);
    const info = await b.eval(`(()=>{
      const top = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
      const imgs = [...document.querySelectorAll('.wm-founders img')];
      return {
        hero: top('.wm-hero .wm-cta'), narr: top('.wm-narr'), fnd: top('.wm-founders'), never: top('#never'),
        lead: document.querySelector('.wm-hero .wm-lead')?.textContent.trim(),
        narrText: [...document.querySelectorAll('.wm-narr p')].map(p => p.textContent.trim()),
        caption: document.querySelector('.wm-founders .wm-fcap')?.textContent.trim(),
        chips: [...document.querySelectorAll('.wm-founders a')].map(a => ({ t: a.textContent.trim(), href: a.href, rel: a.rel, target: a.target })),
        imgs: imgs.map(i => ({ src: new URL(i.src).pathname, ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width })),
        body: document.body.innerText,
        hscroll: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    const tag = `${w}x${h}`;
    assert.ok(info.hero < info.narr && info.narr < info.fnd && info.fnd < info.never, `${tag}: order ${JSON.stringify([info.hero, info.narr, info.fnd, info.never])}`);
    assert.equal(info.lead, "Answer a few small questions with a name and a city.", `${tag}: hero lead (Aadarsh's pick, 19 Nov)`);
    assert.deepEqual(info.narrText, [
      "Think of the people who've had your back: the 2am call, the first break, the hard truth.",
      "Each answer lights a lantern in their city. In five answers, you'll see how far your warmth reaches — and their names never leave your phone.",
      "Send each one a thank-you. When they tie it back, their lantern turns gold.",
    ]);
    assert.equal(info.caption, "Built by three people who kept meaning to say thank you.");
    assert.deepEqual(info.chips.map((c) => c.t), ["Aadarsh", "Abhijith", "Arjun"]);
    assert.deepEqual(info.chips.map((c) => c.href), [
      "https://www.linkedin.com/in/aadarsh-k-s/",
      "https://www.linkedin.com/in/abhijithharikumar-gtm/",
      "https://www.linkedin.com/in/arjun-aravind-708647125/",
    ]);
    for (const c of info.chips) {
      assert.equal(c.target, "_blank");
      assert.match(c.rel, /noopener/);
    }
    assert.deepEqual(info.imgs.map((i) => i.src), ["/aadarsh.png", "/abhijith.png", "/arjun.png"]);
    assert.ok(!/MQL|campaigns|Every evening, someone on a veranda/.test(info.body), `${tag}: old quote is gone`);
    assert.ok(!info.hscroll, `${tag}: sideways scroll`);
    await b.eval(`document.querySelector('.wm-founders').scrollIntoView()`);
    await sleep(700);
    const ok = await b.eval(`[...document.querySelectorAll('.wm-founders img')].map(i => i.complete && i.naturalWidth > 0)`);
    assert.deepEqual(ok, [true, true, true], `${tag}: photos did not load`);
    await b.shot(`${SHOTS}/p1-landing-founders-${w}x${h}.png`);
  }
});

// Rendered size of an SVG label in CSS px (the globe is scaled to fit its box).
const PX = `(sel)=>[...document.querySelectorAll(sel)].map(t=>{const m=t.getScreenCTM();return {t:t.textContent,px:parseFloat(t.getAttribute('font-size'))*Math.hypot(m.a,m.b)}})`;
const SMALL = `(()=>[...document.querySelectorAll('a,button')].filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {t:e.textContent.trim().slice(0,30),w:Math.round(r.width),h:Math.round(r.height)}}).filter(l=>l.w<44||l.h<44))()`;

test("accessibility: globe labels render at 12 px or more; every link and button is at least 44 x 44", { skip }, async () => {
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    const b = await phone(w, h);
    const hero = await b.eval(`(${PX})('.wm-hero .wm-cl')`);
    assert.ok(hero.length >= 1, `${tag}: hero keeps at least one label`);
    for (const l of hero) assert.ok(l.px >= 11.95, `${tag}: hero label ${l.t} renders at ${l.px.toFixed(1)}px`);
    assert.deepEqual(await b.eval(SMALL), [], `${tag}: landing tap targets under 44x44`);
    for (const sel of [".wm-top a", ".wm-foot a"]) {
      const boxes = await b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})`);
      assert.ok(boxes.length > 0 && boxes.every(([bw, bh]) => bw >= 44 && bh >= 44), `${tag}: ${sel} ${JSON.stringify(boxes)}`);
    }
    await toAsk(b);
    const cities = ["Kochi", "Kozhikode", "Mysuru", "Kannur", "Mangaluru"];
    for (let i = 0; i < 5; i++) {
      await type(b, ".wm-flds label:nth-child(1) input", `Nm${i}qx`);
      await type(b, ".wm-flds label:nth-child(2) input", cities[i]);
      await clickText(b, "Light it");
      await sleep(1400);
    }
    const ask = await b.eval(`(${PX})('.wm-ask .wm-cl')`);
    assert.ok(ask.some((l) => l.t !== "you"), `${tag}: the newest city keeps its label`);
    for (const l of ask) assert.ok(l.px >= 11.95, `${tag}: question label ${l.t} renders at ${l.px.toFixed(1)}px`);
    assert.deepEqual(await b.eval(SMALL), [], `${tag}: question screen tap targets under 44x44`);
    await clickText(b, "See my map");
    await b.eval(`document.querySelector('.wm-reveal').click()`);
    await sleep(700);
    const rv = await b.eval(`(${PX})('.wm-reveal .wm-cl')`);
    assert.ok(rv.length >= 2, `${tag}: reveal keeps its home label and at least one city`);
    for (const l of rv) assert.ok(l.px >= 11.95, `${tag}: reveal label ${l.t} renders at ${l.px.toFixed(1)}px`);
    assert.deepEqual(await b.eval(SMALL), [], `${tag}: reveal tap targets under 44x44`);
  }
});
