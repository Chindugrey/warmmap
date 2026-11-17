// "Delete my map", end to end in a phone browser against a LOCAL server and the LOCAL database:
// findable from the landing footer and /privacy, a confirmation step, then the server rows are
// gone (map, thank-links, vouches) and this browser's keys are cleared.
//   BASE=http://localhost:3102 DATABASE_URL=… npm run test:browser
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const skip = !findChrome() && "no Chromium installed";
const db = new PrismaClient();
const open = [];
after(async () => { for (const b of open) await b.close(); await db.$disconnect(); });

test("Delete my map: footer, /privacy, confirm, rows gone, keys cleared", { skip }, async () => {
  await db.rateLimit.deleteMany({});
  const key = randomBytes(32).toString("base64url");
  const slug = "dl" + randomBytes(4).toString("hex");
  const q = (i, city) => ({ city, questionIndex: i });
  const map = await db.map.create({
    data: { shortSlug: slug, homeCity: "Kochi", ownerName: "Zzdeletetest", ownerKeyHash: createHash("sha256").update(key).digest("hex"), questionSet: 3,
      entries: [q(0, "Pune"), q(1, "Delhi"), q(2, "Mumbai"), q(3, "Chennai"), q(4, "Goa")] },
  });
  const link = await db.thankLink.create({ data: { tokenHash: randomBytes(32).toString("hex"), mapId: map.id, entryIndex: 0, expiresAt: new Date(Date.now() + 864e5) } });
  await db.vouch.create({ data: { mapId: map.id, entryIndex: 0, thankLinkId: link.id, tier: "tap" } });
  await db.thankLink.create({ data: { tokenHash: randomBytes(32).toString("hex"), mapId: map.id, entryIndex: 1, expiresAt: new Date(Date.now() + 864e5) } });
  await db.analyticsEvent.create({ data: { event: "map_view", mapId: map.id } });

  const b = await launch({ width: 390, height: 844 });
  open.push(b);
  // Findable from the landing footer and from /privacy.
  await b.goto(`${BASE}/`);
  assert.equal(await b.eval(`[...document.querySelectorAll('footer a')].some(a => /Delete my map/.test(a.textContent) && a.getAttribute('href') === '/privacy#delete')`), true);
  await b.eval(`localStorage.setItem('wm:key:${slug}', ${JSON.stringify(key)}); localStorage.setItem('wm:names:${slug}', '[{"name":"x"}]'); localStorage.setItem('wm:draft', JSON.stringify({ saved: { slug: ${JSON.stringify(slug)} } }))`);
  await b.goto(`${BASE}/privacy`);
  assert.equal(await b.eval(`document.querySelector('[data-testid=delete-my-map-link]')?.getAttribute('href')`), `/m/${slug}`);

  // Owner view: the button asks first; "Keep it" changes nothing.
  await b.goto(`${BASE}/m/${slug}`, 2500);
  const btn = (re) => `[...document.querySelectorAll('button')].find(x => ${re}.test(x.textContent))`;
  // A newly gold lantern opens on its own screen first; the owner steps through to the whole map.
  await b.eval(`${btn("/See my whole map/")}?.click()`);
  await b.sleep(400);
  await b.eval(`${btn("/^Delete my map/")}.click()`);
  assert.equal(await b.eval(`!!(${btn("/Yes, delete it for good/")})`), true);
  await b.eval(`${btn("/Keep it/")}.click()`);
  assert.equal(await db.map.count({ where: { id: map.id } }), 1);
  await b.eval(`${btn("/^Delete my map/")}.click()`);
  await b.eval(`${btn("/Yes, delete it for good/")}.click()`);
  await b.sleep(1500);
  assert.match(await b.eval("document.querySelector('h1').textContent"), /It.s gone/);

  assert.equal(await db.map.count({ where: { id: map.id } }), 0);
  assert.equal(await db.thankLink.count({ where: { mapId: map.id } }), 0);
  assert.equal(await db.vouch.count({ where: { mapId: map.id } }), 0);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: map.id } }), 0);
  assert.equal(await b.eval(`localStorage.getItem('wm:key:${slug}')`), null);
  assert.equal(await b.eval(`localStorage.getItem('wm:names:${slug}')`), null);
  assert.equal(await b.eval(`localStorage.getItem('wm:draft')`), null);
  assert.equal((await fetch(`${BASE}/api/maps/${slug}`)).status, 404);
});
