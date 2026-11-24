/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// /admin/dashboard/launch against a running local server and the LOCAL database: behind the
// admin gate; the numbers match a fixture in a window of its own (March 2020, which no other
// test writes to); and no name of any kind reaches the HTML or the JSON.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { istDayStart } from "@/lib/dashboard";

const BASE = process.env.BASE ?? "http://localhost:3102";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const bearer = { Authorization: `Bearer ${ADMIN}` };
const tag = Date.now().toString(36);
const OWNER = `Zzlaunch${tag}`;
const SURNAME = `Zzsurname${tag}`;
const FRIEND = `Zzfriend${tag}`;
const mapIds: string[] = [];
const eventIds: string[] = [];
const FROM = "2020-03-04T13:00:00.000Z";
const TO = "2020-03-07T13:00:00.000Z";
const WIN = `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;
const at = (iso: string) => new Date(iso);

after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } }); // cascades links, vouches, map events
  await db.analyticsEvent.deleteMany({ where: { id: { in: eventIds } } });
  await db.$disconnect();
});

test("the launch page: 401 and the token form without a token, no data", async () => {
  const bare = await fetch(`${BASE}/admin/dashboard/launch`);
  assert.equal(bare.status, 401);
  const t = await bare.text();
  assert.match(t, /name="token"/);
  assert.doesNotMatch(t, /<table/);
  assert.equal(bare.headers.get("cache-control"), "no-store");
  for (const init of [{}, { headers: { Authorization: "Bearer wrong-token-wrong-token" } }]) {
    const r = await fetch(`${BASE}/admin/dashboard/launch?format=json`, init);
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), { error: "Unauthorized" });
  }
  const forged = await fetch(`${BASE}/admin/dashboard/launch`, { headers: { Cookie: `wm_admin=${Date.now() + 1e7}.${"0".repeat(64)}` } });
  assert.equal(forged.status, 401);
});

test("signed in (cookie): the page renders, linked from the nav", async () => {
  const ok = await fetch(`${BASE}/admin/dashboard`, { method: "POST", body: new URLSearchParams({ token: ADMIN }), redirect: "manual" });
  const cookie = ok.headers.get("set-cookie")!.split(";")[0];
  const r = await fetch(`${BASE}/admin/dashboard/launch`, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
  const html = await r.text();
  assert.match(html, /<h1>Launch scoreboard<\/h1>/);
  assert.match(html, /href="\/admin\/dashboard\/launch"/);
  const home = await (await fetch(`${BASE}/admin/dashboard`, { headers: { Cookie: cookie } })).text();
  assert.match(home, /href="\/admin\/dashboard\/launch"/);
});

test("fixture window: maps, K, ties, funnel, lanterns, countries; no names anywhere", async () => {
  const q = (i: number, city: string) => ({ city, questionIndex: i });
  const before = await db.map.create({ data: { homeCity: "Pune", ownerName: OWNER, entries: [q(0, "Pune")], createdAt: at("2020-03-01T10:00:00Z") } });
  const A = await db.map.create({
    data: { homeCity: "Kochi", ownerName: `${OWNER} ${SURNAME}`, arrivedVia: "cold", createdAt: at("2020-03-04T13:30:00Z"),
      entries: [q(0, "Bengaluru"), q(1, "London"), { ...q(2, "Kochi"), name: FRIEND }, { city: "Dubai", carried: true }] },
  });
  const B = await db.map.create({
    data: { homeCity: "Dubai", ownerName: OWNER, arrivedVia: "map", invitedByMapId: A.id, createdAt: at("2020-03-05T01:00:00Z"), entries: [q(0, "Dubai")] },
  });
  const C = await db.map.create({ // date-only stamp (made from a thank-you on 4 March)
    data: { homeCity: "Pune", ownerName: OWNER, arrivedVia: "thanks", invitedByMapId: before.id, createdAt: at("2020-03-04T00:00:00Z"), entries: [q(0, "Pune")] },
  });
  const S = await db.map.create({ data: { homeCity: "Pune", ownerName: OWNER, arrivedVia: "seed", createdAt: at("2020-03-04T14:00:00Z"), entries: [q(0, "Paris")] } });
  mapIds.push(before.id, A.id, B.id, C.id, S.id);
  const exp = at("2020-04-01T00:00:00Z");
  const l1 = await db.thankLink.create({ data: { tokenHash: `zzl-${tag}-1`, mapId: A.id, entryIndex: 0, createdAt: at("2020-03-04T14:00:00Z"), usedAt: at("2020-03-04T15:10:00Z"), expiresAt: exp } });
  await db.thankLink.create({ data: { tokenHash: `zzl-${tag}-2`, mapId: A.id, entryIndex: 1, createdAt: at("2020-03-04T14:05:00Z"), expiresAt: exp } });
  await db.thankLink.create({ data: { tokenHash: `zzl-${tag}-3`, mapId: S.id, entryIndex: 0, createdAt: at("2020-03-04T14:05:00Z"), expiresAt: exp } }); // seed: left out
  await db.vouch.create({ data: { mapId: A.id, entryIndex: 0, thankLinkId: l1.id, tier: "tap", createdAt: at("2020-03-04T15:10:00Z") } });
  const shareDay = istDayStart(at(FROM)); // 00:00 IST on 4 March: before 18:30 IST, still counted
  const events = [
    ...[1, 2, 3].map(() => ({ event: "share", mapId: A.id, metadata: { channel: "whatsapp" }, createdAt: shareDay })),
    { event: "share", mapId: A.id, metadata: { channel: "native" }, createdAt: shareDay },
    { event: "map_view", metadata: { s: "wa" }, createdAt: at("2020-03-04T16:00:00Z") },
    { event: "map_view", metadata: { s: "wa" }, createdAt: at("2020-03-04T16:30:00Z") },
    { event: "map_view", metadata: { s: "wa" }, createdAt: at("2020-03-04T12:59:00Z") }, // before the window
    { event: "make_yours", metadata: { s: "wa", via: "map" }, createdAt: at("2020-03-04T16:40:00Z") },
  ];
  for (const e of events) eventIds.push((await db.analyticsEvent.create({ data: e })).id);

  const jr = await fetch(`${BASE}/admin/dashboard/launch?format=json&${WIN}`, { headers: bearer });
  assert.equal(jr.status, 200);
  const raw = await jr.text();
  const s = JSON.parse(raw);
  assert.equal(s.from, FROM);
  assert.equal(s.to, TO);
  assert.deepEqual([s.maps.value, s.maps.seedLeftOut, s.maps.fromThanks, s.maps.status], [3, 1, 1, "below"]);
  assert.deepEqual([s.k.invited, s.k.maps, s.k.value, s.k.status, s.k.inviters], [2, 3, 0.67, "ok", 2]);
  assert.deepEqual([s.tieBack.links, s.tieBack.eligible, s.tieBack.tiedIn48h, s.tieBack.value, s.tieBack.status], [2, 2, 1, 50, "early"]);
  const wa = s.funnel.rows.find((r: any) => r.channel === "wa");
  assert.deepEqual([wa.shares, wa.opens, wa.openPerShare, wa.makeYours, wa.startPerOpen], [3, 2, 67, 1, 50]);
  assert.equal(s.funnel.overall.shares, 4);
  assert.equal(s.funnel.overall.openPerShare, 50);
  assert.equal(s.lanterns, 5); // A 3 (carried left out) + B 1 + C 1
  assert.equal(s.countries, 3); // India, UK, UAE
  assert.equal(s.friday.line, "5 lanterns lit across 3 countries");
  assert.equal(s.friday.post, "learned");
  const hasLog = (await db.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('public."EngagementLog"') IS NOT NULL AS ok`)[0].ok;
  if (!hasLog) assert.equal(s.linkedinPosts, null);
  assert.equal(s.hourly.rows.reduce((a: number, h: any) => a + h.tieBacks, 0), 1);
  assert.equal(s.hourly.rows.reduce((a: number, h: any) => a + h.maps, 0), 2);
  assert.equal(s.hourly.dateOnlyMaps, 1);

  const html = await (await fetch(`${BASE}/admin/dashboard/launch?${WIN}`, { headers: bearer })).text();
  assert.match(html, /5 lanterns lit across 3 countries/);
  assert.match(html, /Post what we learned/);
  assert.match(html, /too early/);
  if (!hasLog) assert.match(html, /from the roster sheet/);
  for (const body of [raw, html]) {
    for (const secret of [OWNER, SURNAME, FRIEND, A.id, A.publicId]) assert.ok(!body.includes(secret), `leaked ${secret}`);
  }
});

test("bad ?from= falls back to the launch start and says so", async () => {
  const html = await (await fetch(`${BASE}/admin/dashboard/launch?from=not-a-date`, { headers: bearer })).text();
  assert.match(html, /from= was not a date/);
});
