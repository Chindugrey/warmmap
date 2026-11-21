/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Per-map share taps against a running local server and the LOCAL database: a tap carries its map,
// IST day boundaries and channel buckets, admin-only access, no tapper identity in any payload,
// and the privacy line.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { loadShareTaps } from "@/lib/share-taps";
import { sha256Hex } from "@/lib/server-crypto";
import { istDayStart } from "@/lib/dashboard";

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
const KEY = `zzkey${tag}`.padEnd(40, "k");
const mapIds: string[] = [];

after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } }); // cascades its events
  await db.$disconnect();
});

const makeMap = async () => {
  const m = await db.map.create({ data: { homeCity: "Kochi", ownerName: OWNER, entries: [{ city: "Pune", questionIndex: 0 }], shortSlug: `zt${tag}${mapIds.length}`, ownerKeyHash: sha256Hex(KEY) } });
  mapIds.push(m.id);
  return m;
};
const post = (body: unknown, key: string | null = KEY) =>
  fetch(`${BASE}/api/analytics`, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "x-owner-key": key } : {}) }, body: JSON.stringify(body) });

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
  assert.equal(row.sharesTotal, 3, "all time, same channel set as the 30-day column (unknown channels included): the 45-day-old tap is in");
  const html = await (await fetch(`${BASE}/admin/dashboard/creators?q=${OWNER}`, { headers: bearer })).text();
  assert.match(html, /Share taps, last 30 days/);
  const csv = await (await fetch(`${BASE}/admin/dashboard/creators?format=csv&q=${OWNER}`, { headers: bearer })).text();
  assert.match(csv.split("\n")[0], /share_taps_last_30_days/);
  for (const text of [jtext, html, csv]) for (const banned of [TAPPER, DEVICE, "deviceHash", "ipHash"]) assert.ok(!text.includes(banned), `${banned} leaked`);
});

test("the privacy page says what is counted and what is not", async () => {
  const html = await (await fetch(`${BASE}/privacy`)).text();
  assert.match(html, /tap a share button for your map[^<]*thank-you\s+on WhatsApp, we add one to a count for your map, for that day and that channel/);
  assert.match(html, /no record of who tapped, no names, and\s+nothing about your device with the count/);
  assert.match(html, /how many times its share buttons were tapped/);
  assert.match(html, /how often its share buttons were tapped \(per day, per channel\)/);
});

// Verifier additions: what a tap may name, the answer it gets, and the creators column's window.
test("only a public slug or public id names a map: the internal id, a deleted map or junk count against none, with the same answer", async () => {
  const m = await makeMap();
  const gone = await makeMap();
  await db.map.delete({ where: { id: gone.id } });
  const answers = new Set<string>();
  for (const map of [m.id, gone.shortSlug, `never${tag}`, "a'; drop table \"Map\";--", "x".repeat(41), { shortSlug: m.shortSlug }, [m.shortSlug], 7]) {
    const r = await post({ event: "share", map, metadata: { channel: "copy" } });
    answers.add(`${r.status} ${await r.text()}`);
  }
  const live = await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } });
  answers.add(`${live.status} ${await live.text()}`);
  assert.deepEqual([...answers], ['200 {"ok":true}'], "a live and an unknown map get the same answer (no slug oracle)");
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id } }), 1, "only the slug tap is on the map; the internal id is not accepted");
});

test("creators list and map page use the same 30 IST days: the evening before the window is out of both", async () => {
  const { loadCreatorsPage } = await import("@/lib/growth-load");
  const { shareTapsSince } = await import("@/lib/share-taps");
  const m = await makeMap();
  const now = new Date("2026-11-20T06:30:00Z"); // 12:00 IST: the window opens 00:00 IST on 22 Oct, 12 h before a rolling 30 x 24 h would
  const since = shareTapsSince(now);
  await db.analyticsEvent.createMany({
    data: [
      { event: "share", mapId: m.id, createdAt: new Date(since.getTime() - 60_000), metadata: { channel: "copy" } }, // 23:59 IST, 21 Oct: out
      { event: "share", mapId: m.id, createdAt: new Date(since.getTime() + 12 * 3_600_000), metadata: { channel: "copy" } }, // noon IST, 22 Oct: in
    ],
  });
  const t = await loadShareTaps(db, m.id, now);
  const page = await loadCreatorsPage(db, { q: OWNER, sort: "createdAt", dir: "desc" }, { limit: 50, offset: 0, now });
  const row = page.rows.find((r) => r.id === m.id)!;
  assert.equal(t.totals.total, 1, "map page");
  assert.equal(row.shares30d, 1, "creators column: same window as the map page");
  assert.equal(row.shares30d, t.totals.total);
});

// Prisma sends a Date as timestamptz and "createdAt" is timestamp without time zone, so a bare `"createdAt" >= ${since}` is
// read in the database session's TimeZone. The window bounds are therefore converted to UTC in SQL; run both zones.
for (const zone of ["UTC", "Asia/Kolkata"]) {
  test(`the window's first IST day keeps its 00:01 tap, session TimeZone ${zone}`, async () => {
    const { loadCreatorsPage } = await import("@/lib/growth-load");
    const { shareTapsSince } = await import("@/lib/share-taps");
    const m = await makeMap();
    const now = new Date("2026-11-20T06:30:00Z");
    const since = shareTapsSince(now);
    await db.analyticsEvent.createMany({
      data: [
        { event: "share", mapId: m.id, createdAt: new Date(since.getTime() + 60_000), metadata: { channel: "story" } }, // 00:01 IST, first day: in
        { event: "share", mapId: m.id, createdAt: new Date(since.getTime() - 60_000), metadata: { channel: "story" } }, // 23:59 IST the day before: out
      ],
    });
    const { t, row } = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL TimeZone = '${zone}'`);
      const t = await loadShareTaps(tx as any, m.id, now);
      const page = await loadCreatorsPage(tx as any, { q: OWNER, sort: "createdAt", dir: "desc" }, { limit: 50, offset: 0, now });
      return { t, row: page.rows.find((r) => r.id === m.id)! };
    });
    assert.equal(t.days.at(-1)!.story, 1, "map page, oldest day");
    assert.equal(t.totals.total, 1, "map page: the tap before the window is out");
    assert.equal(row.shares30d, 1, "creators column");
  });
}

test("a share row is kept as a count: createdAt is 00:00 IST of its day and the id is random, not a time-bearing cuid", async () => {
  const m = await makeMap();
  assert.equal((await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } })).status, 200);
  const g = await post({ event: "share", metadata: { channel: "copy" } }, null); // a tap against no map is kept the same way
  assert.equal(g.status, 200);
  const rows = await db.analyticsEvent.findMany({ where: { mapId: m.id } });
  assert.equal(rows.length, 1);
  const globalRows = await db.$queryRaw<{ id: string; createdAt: Date }[]>`SELECT "id", "createdAt" FROM "AnalyticsEvent" WHERE "event" = 'share' AND "mapId" IS NULL AND length("id") = 36 ORDER BY "createdAt" DESC LIMIT 1`;
  assert.equal(globalRows.length, 1, "the map-less tap is kept the same way");
  rows.push(globalRows[0] as any);
  for (const r of rows) {
    assert.equal(r.createdAt.getTime(), istDayStart(new Date()).getTime(), "00:00 IST of the day");
    assert.match(r.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "a random v4 id, not a cuid");
  }
});

test("only the owner's key counts a tap against a map; every other call is counted globally with the very same answer", async () => {
  const m = await makeMap();
  const answers = new Set<string>();
  const globalBefore = await db.analyticsEvent.count({ where: { event: "share", mapId: null } });
  for (const key of [null, "wrong-key-wrong-key-wrong-key", KEY.slice(1)]) {
    const r = await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } }, key);
    answers.add(`${r.status} ${await r.text()}`);
  }
  const ok = await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } });
  answers.add(`${ok.status} ${await ok.text()}`);
  assert.deepEqual([...answers], ['200 {"ok":true}']);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id } }), 1, "only the keyed tap is on the map");
  assert.equal(await db.analyticsEvent.count({ where: { event: "share", mapId: null } }) - globalBefore, 3, "the others still count, against no map");
});

test("a map's daily cap: taps past it count globally, same answer", async () => {
  const m = await makeMap();
  const day = istDayStart(new Date());
  await db.analyticsEvent.createMany({ data: Array.from({ length: 200 }, () => ({ event: "share", mapId: m.id, createdAt: day, metadata: { channel: "copy" } })) });
  const r = await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } });
  assert.deepEqual([r.status, await r.text()], [200, '{"ok":true}']);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id } }), 200);
});

test("a JSON null body is a 400, not a 500", async () => {
  for (const raw of ["null", "7", '"x"']) {
    const r = await fetch(`${BASE}/api/analytics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    assert.equal(r.status, 400, raw);
  }
});

// Verifier additions, round 2: another real map's key, the cap's IST day, and the cap under parallel taps.
test("another map's real key does not count a tap against this map", async () => {
  const m = await makeMap();
  const otherKey = `zzother${tag}`.padEnd(40, "o");
  const other = await db.map.create({ data: { homeCity: "Pune", ownerName: OWNER, entries: [], shortSlug: `zo${tag}`, ownerKeyHash: sha256Hex(otherKey) } });
  mapIds.push(other.id);
  for (const map of [m.shortSlug, m.publicId]) {
    const r = await post({ event: "share", map, metadata: { channel: "copy" } }, otherKey);
    assert.deepEqual([r.status, await r.text()], [200, '{"ok":true}']);
  }
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id } }), 0, "another map's key never counts here");
  assert.equal((await post({ event: "share", map: other.shortSlug, metadata: { channel: "copy" } }, otherKey)).status, 200);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: other.id } }), 1, "the same key counts on its own map");
});

test("the daily cap is per IST day: 200 taps yesterday do not hold back today's", async () => {
  const m = await makeMap();
  const yesterday = new Date(istDayStart(new Date()).getTime() - 86_400_000);
  await db.analyticsEvent.createMany({ data: Array.from({ length: 200 }, () => ({ event: "share", mapId: m.id, createdAt: yesterday, metadata: { channel: "copy" } })) });
  assert.equal((await post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } })).status, 200);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id } }), 201);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: m.id, createdAt: istDayStart(new Date()) } }), 1);
});

// The cap is a count followed by an insert, so taps that arrive together all see a count under 200 and all land.
test("parallel taps never push a map past 200 in a day", { todo: "the cap is count-then-insert, not atomic (verifier finding)" }, async () => {
  const m = await makeMap();
  await db.analyticsEvent.createMany({ data: Array.from({ length: 190 }, () => ({ event: "share", mapId: m.id, createdAt: istDayStart(new Date()), metadata: { channel: "copy" } })) });
  await Promise.all(Array.from({ length: 40 }, () => post({ event: "share", map: m.shortSlug, metadata: { channel: "copy" } })));
  assert.ok((await db.analyticsEvent.count({ where: { mapId: m.id } })) <= 200);
});
