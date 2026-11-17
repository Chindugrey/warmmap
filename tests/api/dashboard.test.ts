/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// /admin/dashboard against a running local server and the LOCAL database:
// the auth gate, aggregate correctness on a seeded fixture (as deltas, so other
// rows in the database do not matter), and that no name ever reaches the page.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { loadDashboard } from "@/lib/dashboard";

const BASE = process.env.BASE ?? "http://localhost:3102";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const OWNER_A = "Zzownerleaka";
const OWNER_B = "Zzownerleakb";
const FRIEND = "Zzfriendleak"; // put straight into stored JSON: must still never show
const bearer = { Authorization: `Bearer ${ADMIN}` };
const DAY = 86_400_000;
const mapIds: string[] = [];
const eventIds: string[] = [];

before(async () => { await db.rateLimit.deleteMany({}); });
after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } });
  await db.analyticsEvent.deleteMany({ where: { id: { in: eventIds } } });
  await db.$disconnect();
});

test("auth gate: no token, no data", async () => {
  const bare = await fetch(`${BASE}/admin/dashboard`);
  assert.equal(bare.status, 401);
  const t = await bare.text();
  assert.match(t, /name="token"/);
  assert.doesNotMatch(t, /Maps created/);
  assert.match(t, /<meta name="robots" content="noindex/);
  assert.match(bare.headers.get("x-robots-tag") ?? "", /noindex/);
  for (const init of [{}, { headers: { Authorization: "Bearer wrong-token-wrong-token" } }]) {
    const j = await fetch(`${BASE}/admin/dashboard?format=json`, init);
    assert.equal(j.status, 401);
    assert.deepEqual(await j.json(), { error: "Unauthorized" });
  }
  const forged = await fetch(`${BASE}/admin/dashboard?format=json`, { headers: { Cookie: `wm_admin=${Date.now() + 1e7}.${"0".repeat(64)}` } });
  assert.equal(forged.status, 401);
});

test("sign-in: form body to HttpOnly cookie, the token never in a URL", async () => {
  const wrong = await fetch(`${BASE}/admin/dashboard`, { method: "POST", body: new URLSearchParams({ token: "nope-nope-nope-nope" }), redirect: "manual" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);
  const ok = await fetch(`${BASE}/admin/dashboard`, { method: "POST", body: new URLSearchParams({ token: ADMIN }), redirect: "manual" });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), "/admin/dashboard");
  const sc = ok.headers.get("set-cookie")!;
  assert.match(sc, /^wm_admin=\d+\.[0-9a-f]{64}; Path=\/admin; HttpOnly; SameSite=Strict; Max-Age=28800/);
  assert.ok(!sc.includes(ADMIN));
  const cookie = sc.split(";")[0];
  const page = await fetch(`${BASE}/admin/dashboard`, { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Maps created/);
  const out = await fetch(`${BASE}/admin/dashboard`, { method: "POST", body: new URLSearchParams({ logout: "1" }), redirect: "manual" });
  assert.match(out.headers.get("set-cookie")!, /Max-Age=0/);
});

test("aggregates match a seeded fixture; no names in the page or JSON", async () => {
  const before = await loadDashboard(db);
  const now = Date.now();
  const q = (i: number, city: string) => ({ city, questionIndex: i });
  const A = await db.map.create({ data: { homeCity: "Kochi", ownerName: OWNER_A, entries: [q(0, "Pune"), q(1, "Delhi"), q(2, "Mumbai"), q(3, "Chennai"), { ...q(4, "Goa"), name: FRIEND }], arrivedVia: "cold" } });
  const B = await db.map.create({ data: { homeCity: "Kochi", ownerName: OWNER_B, entries: [{ city: "Kochi", carried: true }, q(0, "Pune"), q(1, "Delhi")], arrivedVia: "map", invitedByMapId: A.id } });
  const C = await db.map.create({ data: { homeCity: "Kochi", ownerName: "Zzoldowner", entries: [q(0, "Pune")], arrivedVia: "thanks", invitedByMapId: B.id, createdAt: new Date(now - 40 * DAY) } });
  mapIds.push(A.id, B.id, C.id);
  const link = await db.thankLink.create({ data: { tokenHash: `zz-${now}-a`, mapId: A.id, entryIndex: 0, expiresAt: new Date(now + DAY) } });
  await db.thankLink.create({ data: { tokenHash: `zz-${now}-b`, mapId: A.id, entryIndex: 1, expiresAt: new Date(now + DAY) } });
  await db.vouch.create({ data: { mapId: A.id, entryIndex: 0, thankLinkId: link.id, tier: "tap" } });
  const ev = (event: string, metadata?: object) => ({ event, metadata });
  const events = [
    ev("start"), ev("start"), ev("start"),
    ev("lantern", { n: 5 }), ev("lantern", { n: 5 }), ev("lantern", { n: 4 }),
    ev("map_saved", { via: "cold", n: 5 }), ev("vouch_tap"),
    ev("share", { channel: "whatsapp" }), ev("share", { channel: "whatsapp" }), ev("share", { channel: "copy" }),
    ev("map_view", { s: "wa" }), ev("t_open", { s: "wa" }), ev("t_open", { s: "li" }), ev("make_yours", { s: "wa" }), ev("make_yours", { via: "map" }),
  ];
  for (const e of events) eventIds.push((await db.analyticsEvent.create({ data: e as any })).id);

  const after = await loadDashboard(db);
  assert.equal(after.maps.total - before.maps.total, 3);
  assert.equal(after.maps.today - before.maps.today, 2);
  assert.equal(after.maps.d7 - before.maps.d7, 2);
  assert.equal(after.maps.d30 - before.maps.d30, 2);
  assert.equal(after.lanterns.total - before.lanterns.total, 5 + 2 + 1, "the carried lantern is not counted");
  assert.equal(after.thanks.links.total - before.thanks.links.total, 2);
  assert.equal(after.thanks.vouches.total - before.thanks.vouches.total, 1);
  const f = (d: typeof after, k: string) => d.funnel.find((s) => s.key === k)!.all;
  assert.equal(f(after, "start") - f(before, "start"), 3);
  assert.equal(f(after, "five") - f(before, "five"), 2);
  assert.equal(f(after, "saved") - f(before, "saved"), 1);
  assert.equal(f(after, "vouch") - f(before, "vouch"), 1);
  assert.equal(after.viral.invitedMaps - before.viral.invitedMaps, 2);
  assert.equal(after.viral.mapsFromMaps - before.viral.mapsFromMaps, 1);
  assert.equal(after.viral.mapsFromThanks - before.viral.mapsFromThanks, 1);
  assert.equal(after.viral.inviterMaps - before.viral.inviterMaps, 2);
  assert.equal(after.viral.makeYoursFromMaps - before.viral.makeYoursFromMaps, 1);
  const ch = (d: typeof after, c: string) => d.channels.find((x) => x.channel === c)!;
  assert.equal(ch(after, "wa").shares - ch(before, "wa").shares, 2);
  assert.equal(ch(after, "wa").opens - ch(before, "wa").opens, 2);
  assert.equal(ch(after, "wa").makeYours - ch(before, "wa").makeYours, 1);
  assert.equal(ch(after, "li").opens - ch(before, "li").opens, 1);
  assert.equal(ch(after, "cp").shares - ch(before, "cp").shares, 1);
  const gen = (d: typeof after, g: number) => d.generations.find((x) => x.generation === g)?.maps ?? 0;
  assert.equal(gen(after, 0) - gen(before, 0), 1);
  assert.equal(gen(after, 1) - gen(before, 1), 1);
  assert.equal(gen(after, 2) - gen(before, 2), 1);

  // The page and the JSON agree with the library, and carry no names.
  const json = await fetch(`${BASE}/admin/dashboard?format=json`, { headers: bearer });
  assert.equal(json.status, 200);
  const jtext = await json.text();
  const htmlText = await (await fetch(`${BASE}/admin/dashboard`, { headers: bearer })).text();
  assert.equal(JSON.parse(jtext).maps.total, after.maps.total);
  assert.match(htmlText, /noindex/);
  for (const name of [OWNER_A, OWNER_B, "Zzoldowner", FRIEND]) {
    assert.ok(!jtext.includes(name), `${name} in JSON`);
    assert.ok(!htmlText.includes(name), `${name} in HTML`);
  }
});
