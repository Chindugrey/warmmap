/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Per-map share taps against a running local server and the LOCAL database: a tap carries its map,
// IST day boundaries and channel buckets, admin-only access, no tapper identity in any payload,
// and the privacy line.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { loadShareTaps } from "@/lib/share-taps";

const BASE = process.env.BASE ?? "http://localhost:3102";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const bearer = { Authorization: `Bearer ${ADMIN}` };
const tag = Date.now().toString(36);
const OWNER = `Zztapowner${tag}`;
const TAPPER = `Zztapper${tag}`;
const DEVICE = `devhash${tag}`.padEnd(64, "d");
const mapIds: string[] = [];

after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } }); // cascades its events
  await db.$disconnect();
});

const makeMap = async () => {
  const m = await db.map.create({ data: { homeCity: "Kochi", ownerName: OWNER, entries: [{ city: "Pune", questionIndex: 0 }], shortSlug: `zt${tag}${mapIds.length}` } });
  mapIds.push(m.id);
  return m;
};
const post = (body: object) => fetch(`${BASE}/api/analytics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("a share tap carries its map; an unknown map still counts, against none", async () => {
  const m = await makeMap();
  assert.equal((await post({ event: "share", map: m.shortSlug, metadata: { channel: "whatsapp" } })).status, 200);
  assert.equal((await post({ event: "share", map: m.publicId, metadata: { channel: "copy", name: TAPPER } })).status, 200);
  const before = await db.analyticsEvent.count({ where: { event: "share", mapId: null } });
  assert.equal((await post({ event: "share", map: "nosuchmap999", metadata: { channel: "copy" } })).status, 200);
  assert.equal((await post({ event: "share", metadata: { channel: "copy" } })).status, 200);
  assert.equal((await post({ event: "page_view", map: m.shortSlug })).status, 200);
  assert.equal(await db.analyticsEvent.count({ where: { event: "share", mapId: null } }) - before, 2);
  const rows = await db.analyticsEvent.findMany({ where: { mapId: m.id } });
  assert.deepEqual(rows.map((r) => r.event).sort(), ["share", "share"], "only a share tap is attributed to a map");
  assert.ok(!JSON.stringify(rows).includes(TAPPER), "no name stored with a tap");
  const t = await loadShareTaps(db, m.id);
  assert.deepEqual([t.totals.whatsapp, t.totals.copy, t.totals.total], [1, 1, 2]);
});

test("IST day boundaries and channel buckets, from real rows", async () => {
  const m = await makeMap();
  const now = new Date();
  // 23:59 and 00:01 IST around the IST midnight that started today's IST day.
  const mid = new Date(Math.floor((now.getTime() + 19_800_000) / 86_400_000) * 86_400_000 - 19_800_000);
  const at = (ms: number) => new Date(mid.getTime() + ms);
  const mk = (createdAt: Date, metadata: object) => ({ event: "share", mapId: m.id, createdAt, metadata });
  await db.analyticsEvent.createMany({
    data: [
      mk(at(-60_000), { channel: "whatsapp" }), // 23:59 IST yesterday
      mk(at(60_000), { channel: "whatsapp" }), // 00:01 IST today
      mk(at(60_000), { channel: "story" }),
      mk(at(60_000), {}), // missing channel
      mk(at(60_000), { channel: "fax", name: TAPPER, deviceHash: DEVICE }), // unknown channel, junk straight into the row
      mk(at(-30 * 86_400_000 - 60_000), { channel: "copy" }), // 30 days back: outside
    ] as any,
  });
  const t = await loadShareTaps(db, m.id, new Date(mid.getTime() + 3_600_000)); // 01:00 IST today
  const day = (d: string) => t.days.find((x) => x.day === d)!;
  const [today, yesterday] = t.days;
  assert.equal(yesterday.whatsapp, 1, "23:59 IST belongs to yesterday");
  assert.deepEqual([today.whatsapp, today.story, today.other, today.total], [1, 1, 2, 4], "00:01 IST belongs to today");
  assert.equal(t.totals.copy, 0);
  assert.equal(t.totals.total, 5);
  assert.ok(day(today.day));
});

test("admin only: map page and JSON carry the table; no token, no data", async () => {
  const m = await makeMap();
  await db.analyticsEvent.createMany({ data: [{ event: "share", mapId: m.id, metadata: { channel: "linkedin", name: TAPPER, deviceHash: DEVICE } }] as any });
  for (const q of ["", "?format=json"]) {
    const bare = await fetch(`${BASE}/admin/dashboard/map/${m.id}${q}`);
    assert.equal(bare.status, 401);
    const text = await bare.text();
    assert.doesNotMatch(text, /Share taps per day|shareTaps/);
  }
  const bad = await fetch(`${BASE}/admin/dashboard/map/${m.id}?format=json`, { headers: { Authorization: "Bearer wrong-token-wrong-token" } });
  assert.equal(bad.status, 401);
  const jtext = await (await fetch(`${BASE}/admin/dashboard/map/${m.id}?format=json`, { headers: bearer })).text();
  const j = JSON.parse(jtext);
  assert.equal(j.shareTaps.windowDays, 30);
  assert.equal(j.shareTaps.days.length, 30);
  assert.equal(j.shareTaps.totals.linkedin, 1);
  const html = await (await fetch(`${BASE}/admin/dashboard/map/${m.id}`, { headers: bearer })).text();
  assert.match(html, /Share taps per day/);
  assert.match(html, /Other \/ unknown/);
  // No tapper identity, and no owner name, in the map page payloads.
  for (const text of [jtext, html]) for (const banned of [TAPPER, DEVICE, OWNER, "deviceHash", "ipHash"]) assert.ok(!text.includes(banned), `${banned} leaked`);
});

test("creators list: per-map 30-day column, labelled; no tapper identity", async () => {
  const m = await makeMap();
  await db.analyticsEvent.createMany({
    data: [
      { event: "share", mapId: m.id, metadata: { channel: "copy" } }, { event: "share", mapId: m.id, metadata: {} },
      { event: "share", mapId: m.id, createdAt: new Date(Date.now() - 45 * 86_400_000), metadata: { channel: "copy", name: TAPPER } },
    ] as any,
  });
  const bare = await fetch(`${BASE}/admin/dashboard/creators?format=json&q=${OWNER}`);
  assert.equal(bare.status, 401);
  const jtext = await (await fetch(`${BASE}/admin/dashboard/creators?format=json&q=${OWNER}`, { headers: bearer })).text();
  const row = JSON.parse(jtext).rows.find((r: any) => r.id === m.id);
  assert.equal(row.shares30d, 2, "the 45-day-old tap is outside; the channel-less one counts");
  assert.equal(row.sharesTotal, 2 + 0, "all time, known channels only: copy x2 (one old), the channel-less tap is not a channel");
  const html = await (await fetch(`${BASE}/admin/dashboard/creators?q=${OWNER}`, { headers: bearer })).text();
  assert.match(html, /Share taps, last 30 days/);
  const csv = await (await fetch(`${BASE}/admin/dashboard/creators?format=csv&q=${OWNER}`, { headers: bearer })).text();
  assert.match(csv.split("\n")[0], /share_taps_last_30_days/);
  for (const text of [jtext, html, csv]) for (const banned of [TAPPER, DEVICE, "deviceHash", "ipHash"]) assert.ok(!text.includes(banned), `${banned} leaked`);
});

test("the privacy page says what is counted and what is not", async () => {
  const html = await (await fetch(`${BASE}/privacy`)).text();
  assert.match(html, /tap a share button[^<]*we add one to a count for your map, for that day and that channel/);
  assert.match(html, /do not keep who tapped, any names, or anything about the device/);
});
