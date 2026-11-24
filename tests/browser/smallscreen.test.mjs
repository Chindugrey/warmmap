// Small phones with the on-screen keyboard open, every question, against a LOCAL server:
// "Light it" is fully inside the visual viewport and the globe keeps its shape (or is hidden).
//   V21A=on  BASE=http://localhost:3105 node --test tests/browser/smallscreen.test.mjs   (server built with NEXT_PUBLIC_WM_V21A=1)
//   V21A=off BASE=http://localhost:3105 node --test tests/browser/smallscreen.test.mjs   (default build)
// Headless Chromium has no keyboard, so it is simulated by resizing the viewport to what a phone keyboard leaves.
// Screenshots go to $SHOTS (default /tmp/wm-small-screen).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const ON = process.env.V21A === "on";
const SHOTS = process.env.SHOTS ?? "/tmp/wm-small-screen";
mkdirSync(SHOTS, { recursive: true });
const skip = !findChrome() && "no Chromium installed";
// [width, height, height left with the keyboard open]
const SIZES = [[360, 640, 360], [375, 667, 380], [390, 844, 554]];
const CITIES = ["Kochi", "Delhi", "Mumbai", "London", "Chennai", "Pune", "Mysuru", "Kannur"];
const open = [];
after(async () => { for (const b of open) await b.close(); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const MEASURE = `(()=>{
  const vv = window.visualViewport;
  const btn = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Light it');
  const svg = document.querySelector('.wm-ask .wm-mapw svg');
  const r = btn.getBoundingClientRect();
  const g = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const cs = getComputedStyle(svg.parentElement);
  const box = svg.parentElement.getBoundingClientRect();
  return { vvh: vv.height, top: vv.offsetTop, btnTop: r.top, btnBottom: r.bottom, scrollY,
    gw: g.width, gh: g.height, natural: vb.width / vb.height, room: box.height,
    hidden: cs.display === 'none' || g.width === 0 || g.height === 0 };
})()`;

for (const [w, h, kb] of SIZES) {
  test(`${ON ? "ON" : "OFF"} ${w}x${h}: keyboard open on every question, Light it is in view and the globe keeps its shape`, { skip }, async () => {
    const b = await launch({ width: w, height: h });
    open.push(b);
    await b.goto(BASE + "/");
    await clickText(b, "Light my first lantern");
    await clickText(b, "Bengaluru");
    const tag = (q) => `${ON ? "ON" : "OFF"} ${w}x${h} question ${q + 1}`;
    for (let q = 0; q < CITIES.length; q++) {
      await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
      await sleep(150);
      const closed = await b.eval(MEASURE);
      // keyboard closed, the launch layout is unchanged: Light it above the fold, the globe box the full width less its margins
      assert.ok(closed.btnBottom + closed.scrollY <= h, `${tag(q)}: keyboard closed, Light it ends at ${Math.round(closed.btnBottom + closed.scrollY)}, below the ${h}px fold`);
      assert.ok(Math.abs(closed.gw - (w - 68)) <= 1, `${tag(q)}: keyboard closed, the globe box is ${Math.round(closed.gw)}px wide, not ${w - 68}`);
      await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: kb, deviceScaleFactor: 1, mobile: true });
      await b.eval(`document.querySelector('.wm-flds label:nth-child(1) input').focus()`);
      await sleep(400);
      const m = await b.eval(MEASURE);
      const ratio = m.gw / m.gh;
      console.log(`# ${tag(q)}: Light it bottom ${Math.round(closed.btnBottom)} of ${h} keyboard closed; ${Math.round(m.btnBottom)} of ${Math.round(m.vvh)} keyboard open; globe ${m.hidden ? "hidden" : `${Math.round(m.gw)}x${Math.round(m.gh)}`}`);
      if (q === 0 || q === 5 || q === 7) await b.shot(`${SHOTS}/${ON ? "on" : "off"}-${w}x${h}-q${q + 1}-keyboard.png`);
      assert.ok(Math.abs(m.vvh - kb) <= 1, `${tag(q)}: viewport is ${m.vvh}, not ${kb}`);
      assert.ok(m.btnTop >= m.top && m.btnBottom <= m.top + m.vvh + 0.5, `${tag(q)}: Light it ${Math.round(m.btnTop)}..${Math.round(m.btnBottom)} is outside the visible ${Math.round(m.top)}..${Math.round(m.top + m.vvh)}`);
      assert.equal(m.scrollY, 0, `${tag(q)}: the page had to scroll`);
      assert.ok(m.hidden || Math.abs(ratio / m.natural - 1) <= 0.02, `${tag(q)}: globe is squashed to ${Math.round(m.gw)}x${Math.round(m.gh)}`);
      // hidden only when there is no room for a 64 px globe; when it shows, it is at least 64 px
      if (m.hidden) assert.ok(m.room < 64, `${tag(q)}: globe hidden with ${Math.round(m.room)}px of room`);
      else assert.ok(m.gh >= 64, `${tag(q)}: globe shown at ${Math.round(m.gw)}x${Math.round(m.gh)}, under 64 px`);
      await type(b, ".wm-flds label:nth-child(1) input", `Kb${q}qx`);
      await type(b, ".wm-flds label:nth-child(2) input", CITIES[q]);
      await clickText(b, "Light it");
      await sleep(q === CITIES.length - 1 ? 300 : 700);
    }
  });
}
