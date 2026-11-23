/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Scripted API check against a running local server (npm run dev / npm start)
// and the LOCAL database. Refuses to run against anything but localhost.
//   BASE=http://localhost:3100 DATABASE_URL=postgresql://warmmap@127.0.0.1:55432/warmmap \
//   ADMIN_TOKEN=local-admin-token npm run test:api
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { prepareThank } from "@/lib/lantern-token";
import { cardVersion, CARD_CACHE } from "@/lib/card";

const BASE = process.env.BASE ?? "http://localhost:3100";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const FRIEND = "Meeraleakcheck"; // must never appear anywhere on the server
const device = () => randomBytes(18).toString("base64url");
const DEV = device();

async function api(path: string, init: { method?: string; body?: unknown; key?: string | null; dev?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "x-wm-device": init.dev ?? DEV, ...(init.headers ?? {}) };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.key) headers["x-owner-key"] = init.key;
  const res = await fetch(BASE + path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

const five = [
  { city: "Kochi", questionIndex: 0 },
  { city: "Pune", questionIndex: 1 },
  { city: "Delhi", questionIndex: 2 },
  { city: "Mumbai", questionIndex: 3 },
  { city: "Chennai", questionIndex: 4 },
];
const S: { slug: string; key: string; token: string; url: string; publicBefore?: string; childSlug?: string } = {} as any;

before(async () => { await db.rateLimit.deleteMany({}); });
after(async () => { await db.$disconnect(); });

test("save at Show me: strict input", async () => {
  assert.equal((await api("/api/maps", { method: "POST", body: { homeCity: "Bengaluru", ownerName: "Ananya", entries: five.slice(0, 4) } })).status, 400);
  const named = five.map((e, i) => (i ? e : { ...e, name: FRIEND }));
  assert.equal((await api("/api/maps", { method: "POST", body: { homeCity: "Bengaluru", ownerName: "Ananya", entries: named } })).status, 400);
  const r = await api("/api/maps", { method: "POST", body: { homeCity: "Bengaluru", ownerName: "Ananya", entries: five, repeatMax: 1 } });
  assert.equal(r.status, 201, r.text);
  assert.match(r.json.ownerKey, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(r.json.keeperUrl.endsWith(`/m/${r.json.id}#k=${r.json.ownerKey}`));
  assert.equal(r.headers.get("cache-control"), "no-store");
  S.slug = r.json.id;
  S.key = r.json.ownerKey;
  const row = await db.map.findFirst({ where: { shortSlug: S.slug } });
  assert.notEqual(row!.ownerKeyHash, S.key, "only the key's hash is stored");
  assert.equal(row!.questionSet, 3);
  assert.equal(row!.kind, "constellation");
});

test("public API: cities only, sorted, nothing else", async () => {
  const r = await api(`/api/maps/${S.slug}`);
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["because", "homeCity", "id", "kind", "lanterns", "ownerName", "places", "stats"]);
  assert.deepEqual(r.json.lanterns, ["Chennai", "Delhi", "Kochi", "Mumbai", "Pune"]);
  for (const banned of ["questionIndex", "question", "gold", "vouch", "ownerKey", "entryIndex", "invited"]) {
    assert.ok(!r.text.includes(banned), `public API leaks ${banned}`);
  }
  S.publicBefore = r.text;
});

test("owner view needs the keeper key", async () => {
  assert.equal((await api(`/api/maps/${S.slug}/owner`)).status, 403);
  assert.equal((await api(`/api/maps/${S.slug}/owner`, { key: "x".repeat(43) })).status, 403);
  const r = await api(`/api/maps/${S.slug}/owner`, { key: S.key });
  assert.equal(r.status, 200);
  assert.equal(r.json.answers[0].question, "Who would you call at 2am?");
  assert.deepEqual(r.json.gold, []);
});

test("thank-you link: phone makes the token; server gets only hash + lantern index", async () => {
  const t = await prepareThank({ base: BASE, mapId: S.slug, entryIndex: 0, friendName: FRIEND });
  assert.ok(!JSON.stringify(t.body).includes(FRIEND));
  assert.equal((await api("/api/thanks", { method: "POST", body: t.body })).status, 403);
  assert.equal((await api("/api/thanks", { method: "POST", key: S.key, body: { ...t.body, name: FRIEND } })).status, 400);
  assert.equal((await api("/api/thanks", { method: "POST", key: S.key, body: { ...t.body, entryIndex: 9 } })).status, 400);
  const r = await api("/api/thanks", { method: "POST", key: S.key, body: t.body });
  assert.equal(r.status, 201, r.text);
  const again = await api("/api/thanks", { method: "POST", key: S.key, body: t.body });
  assert.equal(again.status, 200, "same hash again is the same link: reused, not a 409");
  assert.equal(again.json.reused, true);
  assert.equal(await db.thankLink.count({ where: { tokenHash: t.body.tokenHash } }), 1);
  S.url = t.url;
  S.token = t.url.split("/t/")[1].split("#")[0];
});

test("/t/[token]: question shown, no-referrer, noindex, name not on the server", async () => {
  const r = await api(`/t/${S.token}`);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes("Who would you call at 2am?"));
  assert.ok(r.text.includes("Ananya"));
  assert.ok(r.text.includes("Tie it back"));
  assert.ok(!r.text.includes(FRIEND));
  assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
  const bad = await api(`/t/${"A".repeat(32)}`);
  assert.ok(bad.text.includes("couldn"));
});

test("a 32-character token issued before the short ones still resolves; the preview says the question count", async () => {
  const legacy = randomBytes(24).toString("base64url");
  assert.equal(legacy.length, 32);
  const hash = createHash("sha256").update(legacy).digest("hex");
  const r = await api("/api/thanks", { method: "POST", key: S.key, body: { mapId: S.slug, entryIndex: 1, tokenHash: hash } });
  assert.equal(r.status, 201, r.text);
  const page = await api(`/t/${legacy}`);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes("Tie it back"));
  assert.match(page.text, /one of eight questions/);
  assert.match(S.token, /^[A-Za-z0-9]{12}$/, "new links carry 12 base62 characters");
});

test("channel tag: ?s= is recorded on map_view and t_open when allow-listed, ignored otherwise, no PII", async () => {
  const map = await db.map.findFirst({ where: { OR: [{ shortSlug: S.slug }, { publicId: S.slug }] } });
  const since = new Date();
  for (const s of ["wa", "li", "cp", "st", "bogus", "wa%26x%3D1"]) assert.equal((await api(`/api/maps/${S.slug}?s=${s}`)).status, 200);
  assert.equal((await api(`/api/maps/${S.slug}`)).status, 200);
  const views = await db.analyticsEvent.findMany({ where: { event: "map_view", mapId: map!.id, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(views.map((v) => (v.metadata as any).s), ["wa", "li", "cp", "st", undefined, undefined, undefined]);
  await api("/api/analytics", { method: "POST", body: { event: "t_open", metadata: { via: "thanks", s: "wa" } } });
  await api("/api/analytics", { method: "POST", body: { event: "t_open", metadata: { via: "thanks", s: "Meera" } } });
  const opens = await db.analyticsEvent.findMany({ where: { event: "t_open", createdAt: { gte: since } }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(opens.map((v) => v.metadata), [{ via: "thanks", s: "wa" }, { via: "thanks" }]);
});

test("Tie it back: one tap = gold; own lantern refused; one use; GET cannot vouch", async () => {
  assert.equal((await api("/api/vouch")).status, 405);
  const own = await api("/api/vouch", { method: "POST", key: S.key, body: { token: S.token } });
  assert.equal(own.status, 409);
  assert.equal(own.json.state, "own");
  const r = await api("/api/vouch", { method: "POST", dev: device(), body: { token: S.token } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.ownerName, "Ananya");
  assert.equal(r.json.city, "Kochi");
  const again = await api("/api/vouch", { method: "POST", dev: device(), body: { token: S.token } });
  assert.equal(again.status, 409);
  assert.equal(again.json.state, "used");
  const v = await db.vouch.findFirst({ where: { map: { shortSlug: S.slug } } });
  assert.equal(v!.tier, "tap");
  assert.match(v!.deviceHash!, /^[0-9a-f]{64}$/);
  assert.match(v!.ipHash!, /^[0-9a-f]{64}$/);
});

test("PRIVACY: gold is invisible publicly (public payload byte-identical after the vouch)", async () => {
  const r = await api(`/api/maps/${S.slug}`);
  assert.equal(r.text, S.publicBefore);
  assert.deepEqual(Object.keys(r.json).sort(), ["because", "homeCity", "id", "kind", "lanterns", "ownerName", "places", "stats"]);
  for (const banned of ["gold", "isNew", "entryIndex", "vouch", "tied"]) assert.ok(!r.text.includes(banned), `public payload leaks ${banned}`);
  // A wrong key, or none, gets nothing extra from the public route or the seen endpoint.
  const withBadKey = await api(`/api/maps/${S.slug}`, { key: "not-the-key" });
  assert.equal(withBadKey.text, S.publicBefore);
  assert.equal((await api(`/api/maps/${S.slug}/owner`, { key: "not-the-key" })).status, 403);
  assert.equal((await api(`/api/maps/${S.slug}/seen`, { method: "POST" })).status, 403);
  assert.equal((await api(`/api/maps/${S.slug}/seen`, { method: "POST", key: "not-the-key" })).status, 403);
});

test("owner sees gold, marks it seen; gold lantern takes no new thank link", async () => {
  const r = await api(`/api/maps/${S.slug}/owner`, { key: S.key });
  assert.deepEqual(r.json.gold, [{ entryIndex: 0, city: "Kochi", isNew: true }]);
  assert.equal((await api(`/api/maps/${S.slug}/seen`, { method: "POST", key: S.key })).json.seen, 1);
  const r2 = await api(`/api/maps/${S.slug}/owner`, { key: S.key });
  assert.equal(r2.json.gold[0].isNew, false);
  const t = await prepareThank({ base: BASE, mapId: S.slug, entryIndex: 0 });
  assert.equal((await api("/api/thanks", { method: "POST", key: S.key, body: t.body })).status, 409);
});

test("expired link: 410 and the page says it has gone quiet", async () => {
  const t = await prepareThank({ base: BASE, mapId: S.slug, entryIndex: 1 });
  assert.equal((await api("/api/thanks", { method: "POST", key: S.key, body: t.body })).status, 201);
  await db.thankLink.update({ where: { tokenHash: t.body.tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const token = t.url.split("/t/")[1];
  assert.equal((await api("/api/vouch", { method: "POST", body: { token } })).status, 410);
  assert.ok((await api(`/t/${token}`)).text.includes("gone quiet"));
});

test("PATCH: owner edits recompute the shape; a gold lantern cannot be removed", async () => {
  const more = [...five, { city: "Kochi", questionIndex: 5 }, { city: "Kochi", questionIndex: 6 }];
  const r = await api(`/api/maps/${S.slug}`, { method: "PATCH", key: S.key, body: { entries: more, repeatMax: 1 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.stats.lanterns, 7);
  assert.equal((await api(`/api/maps/${S.slug}`, { method: "PATCH", key: "nope", body: { ownerName: "X" } })).status, 403);
  const dropGold = more.filter((e) => e.questionIndex !== 0);
  assert.equal((await api(`/api/maps/${S.slug}`, { method: "PATCH", key: S.key, body: { entries: dropGold } })).status, 409);
});

test("Make yours: carried lantern pinned to the inviter's home; date only; inviter never public", async () => {
  const r = await api("/api/maps", {
    method: "POST",
    dev: device(),
    body: { homeCity: "Kochi", ownerName: "=HYPERLINK(1)", invitedBy: S.slug, via: "thanks", entries: [{ city: "Delhi", carried: true }, ...five] },
  });
  assert.equal(r.status, 201, r.text);
  S.childSlug = r.json.id;
  const row = await db.map.findFirst({ where: { shortSlug: S.childSlug } });
  const parent = await db.map.findFirst({ where: { shortSlug: S.slug } });
  assert.equal(row!.invitedByMapId, parent!.id);
  assert.deepEqual((row!.entries as any[])[0], { city: "Bengaluru", carried: true });
  assert.equal(row!.createdAt.toISOString().slice(11), "00:00:00.000Z");
  const pub = await api(`/api/maps/${S.childSlug}`);
  assert.ok(pub.json.lanterns.includes("Bengaluru"));
  assert.ok(!pub.text.includes(S.slug) && !pub.text.includes("carried") && !pub.text.includes("thanks"));
});

test("admin connector score: token required; score and CSV", async () => {
  assert.equal((await api("/api/admin/connectors")).status, 401);
  const r = await api("/api/admin/connectors", { headers: { Authorization: `Bearer ${ADMIN}` } });
  assert.equal(r.status, 200);
  const me = r.json.rows.find((x: any) => x.map === S.slug);
  assert.equal(me.vouchesReceived, 1);
  assert.equal(me.distinctVouchers, 1);
  assert.equal(me.mapsBroughtIn, 1);
  assert.equal(me.thankYousSent, 3, "two links in the thank-you test, one more for the 32-character token");
  assert.equal(me.score, 1 + 1 + me.cities);
  const csv = await api("/api/admin/connectors?format=csv", { headers: { Authorization: `Bearer ${ADMIN}` } });
  assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
  assert.ok(csv.text.includes("'=HYPERLINK(1)"), "formula cells are neutralised");
});

test("live counter: exact lantern total from the first lantern", async () => {
  const r = await api("/api/counter");
  const rows = await db.$queryRaw<{ t: bigint }[]>`SELECT COALESCE(SUM(jsonb_array_length(entries)),0)::bigint t FROM "Map"`;
  const total = Number(rows[0].t);
  assert.deepEqual(r.json, total >= 1 ? { show: true, lanterns: total } : { show: false, lanterns: null });
  // Served by the API itself (not only the UI), counted from the first lantern.
  assert.ok(total >= 1 && r.json.show === true);
  assert.equal(r.headers.get("cache-control"), "public, s-maxage=30, stale-while-revalidate=60");
});

test("analytics: allow-listed events; free text dropped", async () => {
  assert.equal((await api("/api/analytics", { method: "POST", body: { event: "anything" } })).status, 400);
  // Share rows carry a day stamp and a random id, so "the latest" is meaningless: find the new row by the ids that appeared.
  const ids = async () => new Set((await db.analyticsEvent.findMany({ where: { event: "share" }, select: { id: true } })).map((x) => x.id));
  const seen = await ids();
  const r = await api("/api/analytics", { method: "POST", body: { event: "share", metadata: { channel: "whatsapp", name: FRIEND, url: "/t/x#Meera" } } });
  assert.equal(r.status, 200);
  const fresh = [...(await ids())].filter((id) => !seen.has(id));
  assert.equal(fresh.length, 1);
  const ev = await db.analyticsEvent.findUnique({ where: { id: fresh[0] } });
  assert.deepEqual(ev!.metadata, { channel: "whatsapp" });
});

test("per-device rate limit: 6th map from one device in an hour is refused; another device is not", async () => {
  const d = device();
  const body = { homeCity: "Pune", ownerName: "Rate", entries: five };
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await api("/api/maps", { method: "POST", dev: d, body })).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
  assert.equal((await api("/api/maps", { method: "POST", dev: device(), body })).status, 201);
  const keys = await db.rateLimit.findMany({ select: { key: true } });
  assert.ok(keys.every((k) => /^[0-9a-f]{64}$/.test(k.key)), "rate-limit keys are hashes");
});

test("key re-issue: new key works, the old one stops working", async () => {
  const made = await api("/api/maps", { method: "POST", dev: device(), body: { homeCity: "Kochi", ownerName: "Rot", entries: five } });
  assert.equal(made.status, 201);
  const oldKey = made.json.ownerKey;
  const r = await api(`/api/maps/${made.json.id}/key`, { method: "POST", key: oldKey });
  assert.equal(r.status, 200);
  assert.notEqual(r.json.ownerKey, oldKey);
  assert.equal((await api(`/api/maps/${made.json.id}/owner`, { key: r.json.ownerKey })).status, 200);
  assert.equal((await api(`/api/maps/${made.json.id}/owner`, { key: oldKey })).status, 403);
});

const pngSize = (buf: Buffer) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

test("share cards: PNG, 1200x627 link preview and 1080x1920 Status/Story; extra params ignored", async () => {
  const get = async (q: string) => {
    const res = await fetch(`${BASE}/api/og${q}`, { headers: { "x-wm-device": DEV } });
    const buf = Buffer.from(await res.arrayBuffer());
    return { res, buf };
  };
  const link = await get(`?id=${S.slug}`);
  assert.equal(link.res.status, 200);
  assert.equal(link.res.headers.get("content-type"), "image/png");
  assert.deepEqual(pngSize(link.buf), { width: 1200, height: 627 });
  assert.ok(link.buf.length < 400_000, `link card is ${link.buf.length} bytes`);
  const story = await get(`?id=${S.slug}&f=story`);
  assert.deepEqual(pngSize(story.buf), { width: 1080, height: 1920 });
  const dl = await get(`?id=${S.slug}&f=story&dl=1`);
  assert.match(dl.res.headers.get("content-disposition") ?? "", /attachment; filename="warm-map-story.png"/);
  const home = await get("");
  assert.deepEqual(pngSize(home.buf), { width: 1200, height: 627 });
  // A name in the query changes nothing: same bytes as without it.
  const withName = await get(`?id=${S.slug}&name=${encodeURIComponent(FRIEND)}&n=${FRIEND}`);
  assert.ok(withName.buf.equals(link.buf), "extra parameters must not change the picture");
  const bogus = await get(`?id=nosuchmap`);
  assert.deepEqual(pngSize(bogus.buf), { width: 1200, height: 627 });
});

test("share cards: cached per map version on the CDN; drawn once here; old versions short; never names", async () => {
  const get = (q: string) => fetch(`${BASE}/api/og${q}`, { headers: { "x-wm-device": DEV } });
  const row = await db.map.findFirst({ where: { shortSlug: S.slug } });
  const v = cardVersion(row!.updatedAt);
  // The map page's preview points at the versioned picture.
  const html = await (await fetch(`${BASE}/m/${S.slug}`)).text();
  assert.ok(html.replace(/&amp;/g, "&").includes(`/api/og?id=${S.slug}&v=${v}`), "the map page's og:image carries the version");
  const first = await get(`?id=${S.slug}&v=${v}&f=story`);
  const again = await get(`?id=${S.slug}&v=${v}&f=story`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), CARD_CACHE.versioned);
  assert.equal(again.headers.get("x-card"), "kept", "the same version is not drawn twice");
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(Buffer.from(await again.arrayBuffer())));
  assert.equal((await get(`?id=${S.slug}`)).headers.get("cache-control"), CARD_CACHE.fallback, "no version: short");
  assert.equal((await get(`?id=${S.slug}&v=0`)).headers.get("cache-control"), CARD_CACHE.fallback, "an old version: short");
  assert.equal((await get(`?id=nosuchmap&v=${v}`)).headers.get("cache-control"), CARD_CACHE.fallback);
  assert.equal((await get("")).headers.get("cache-control"), CARD_CACHE.home);
  for (const q of [`?id=${S.slug}&v=${v}`, `?id=${S.slug}&v=${encodeURIComponent(FRIEND)}`]) {
    const r = await get(q);
    assert.ok(![...r.headers.values()].join(" ").includes(FRIEND), "no name in any header");
  }
});

test("thank-link cap: one per question (8) per map per 30 days, the 9th is refused", async () => {
  const eight = Array.from({ length: 8 }, (_, q) => ({ city: ["Kochi", "Pune", "Delhi", "Mumbai"][q % 4], questionIndex: q }));
  const m = await api("/api/maps", { method: "POST", dev: device(), body: { homeCity: "Bengaluru", ownerName: "Cap", entries: eight } });
  assert.equal(m.status, 201);
  const codes: number[] = [];
  for (let q = 0; q < 9; q++) {
    const t = await prepareThank({ base: BASE, mapId: m.json.id, entryIndex: q % 8 });
    codes.push((await api("/api/thanks", { method: "POST", key: m.json.ownerKey, dev: device(), body: t.body })).status);
  }
  assert.deepEqual(codes, [...Array(8).fill(201), 429]);
});

test("thank-link reuse: the same unused link re-posted costs no new row and no cap slot; nothing else reuses it", async () => {
  const eight = Array.from({ length: 8 }, (_, q) => ({ city: ["Kochi", "Pune", "Delhi", "Mumbai"][q % 4], questionIndex: q }));
  const dev = device();
  const mk = async (name: string) => (await api("/api/maps", { method: "POST", dev: device(), body: { homeCity: "Bengaluru", ownerName: name, entries: eight } })).json;
  const A = await mk("ReuseA");
  const B = await mk("ReuseB");
  const post = (m: any, body: unknown) => api("/api/thanks", { method: "POST", key: m.ownerKey, dev, body });
  const rows = (m: any) => db.thankLink.count({ where: { map: { shortSlug: m.id } } });

  // Reuse within the same map + entry, any number of times.
  const t = await prepareThank({ base: BASE, mapId: A.id, entryIndex: 0 });
  assert.equal((await post(A, t.body)).status, 201);
  for (let i = 0; i < 3; i++) {
    const r = await post(A, t.body);
    assert.equal(r.status, 200);
    assert.equal(r.json.reused, true);
  }
  assert.equal(await rows(A), 1, "one row, one cap slot");

  // Reuse never crosses entries or maps.
  assert.equal((await post(A, { ...t.body, entryIndex: 1 })).status, 409, "other entry");
  assert.equal((await post(B, { ...t.body, mapId: B.id })).status, 409, "other map, its own key");
  assert.equal((await post(B, { ...t.body, mapId: B.id, entryIndex: 0 })).status, 409);
  assert.equal(await rows(B), 0);
  assert.equal((await api("/api/thanks", { method: "POST", dev, body: t.body })).status, 403, "still owner-only");

  // The cap counts it once: seven more links fill all eight slots; re-posting the first still answers 200.
  for (let q = 1; q < 8; q++) {
    assert.equal((await post(A, (await prepareThank({ base: BASE, mapId: A.id, entryIndex: q })).body)).status, 201);
  }
  assert.equal(await rows(A), 8);
  assert.equal((await post(A, t.body)).status, 200, "at the cap, a known link is still reusable");
  assert.equal((await post(A, (await prepareThank({ base: BASE, mapId: A.id, entryIndex: 0 })).body)).status, 429, "a new hash is still capped");

  // Not reused once expired, opened, or tied back.
  const C = await mk("ReuseC");
  const postC = (body: unknown) => api("/api/thanks", { method: "POST", key: C.ownerKey, dev, body });
  const tx = await prepareThank({ base: BASE, mapId: C.id, entryIndex: 0 });
  const tu = await prepareThank({ base: BASE, mapId: C.id, entryIndex: 1 });
  const tv = await prepareThank({ base: BASE, mapId: C.id, entryIndex: 2 });
  for (const x of [tx, tu, tv]) assert.equal((await postC(x.body)).status, 201);
  await db.thankLink.update({ where: { tokenHash: tx.body.tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await db.thankLink.update({ where: { tokenHash: tu.body.tokenHash }, data: { usedAt: new Date() } });
  const link = await db.thankLink.findUnique({ where: { tokenHash: tv.body.tokenHash } });
  await db.vouch.create({ data: { mapId: link!.mapId, entryIndex: 2, tier: "tap", thankLinkId: link!.id } });
  assert.equal((await postC(tx.body)).status, 409, "expired");
  assert.equal((await postC(tu.body)).status, 409, "opened");
  assert.equal((await postC(tv.body)).status, 409, "tied back");
  assert.equal(await db.thankLink.count({ where: { mapId: link!.mapId } }), 3, "no new rows");
});

test("pre-v2 verified vouches stay in the DB but are shown nowhere (owner, public, admin)", async () => {
  // A legacy map as the migration leaves it, plus (to probe the owner view)
  // a key fingerprint it would never have in real life.
  const key = "legacy-probe-key-" + DEV;
  const map = await db.map.create({
    data: {
      shortSlug: "lg" + DEV.slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, "x"),
      homeCity: "Bengaluru", ownerName: "Ravi", questionSet: 1,
      entries: [{ city: "Kochi", questionIndex: 0 }, { city: "Pune", questionIndex: 1 }, { city: "Delhi", questionIndex: 2 }, { city: "Mumbai", questionIndex: 3 }, { city: "Chennai", questionIndex: 4 }],
      ownerKeyHash: createHash("sha256").update(key).digest("hex"),
    },
  });
  await db.vouch.create({ data: { mapId: map.id, entryIndex: 0, tier: "tap", thankLinkId: null } });
  assert.equal(await db.vouch.count({ where: { mapId: map.id } }), 1, "kept in the database");
  const owner = await api(`/api/maps/${map.shortSlug}/owner`, { key });
  assert.equal(owner.status, 200);
  assert.deepEqual(owner.json.gold, []);
  const pub = await api(`/api/maps/${map.shortSlug}`);
  assert.ok(!/gold|vouch/.test(pub.text));
  const admin = await api("/api/admin/connectors", { headers: { Authorization: `Bearer ${ADMIN}` } });
  const row = admin.json.rows.find((r: any) => r.map === map.shortSlug);
  assert.equal(row.vouchesReceived, 0);
  assert.equal(row.distinctVouchers, 0);
  // Still read-only: no edits, no thank-yous.
  assert.equal((await api(`/api/maps/${map.shortSlug}`, { method: "PATCH", key, body: { ownerName: "X" } })).status, 409);
  const t = await prepareThank({ base: BASE, mapId: map.shortSlug!, entryIndex: 1 });
  assert.equal((await api("/api/thanks", { method: "POST", key, body: t.body })).status, 409);
  await db.map.delete({ where: { id: map.id } });
});

test("a set-2 map saved on the preview: its 12 questions, thank links and edits still work; the friend page says twelve", async () => {
  const key = "set2-probe-key-" + DEV;
  const slug = "s2" + DEV.slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, "x");
  const map = await db.map.create({
    data: {
      shortSlug: slug, homeCity: "Bengaluru", ownerName: "Rhea", questionSet: 2,
      entries: [0, 1, 2, 3, 11].map((q, i) => ({ city: ["Kochi", "Pune", "Delhi", "Mumbai", "Chennai"][i], questionIndex: q })),
      ownerKeyHash: createHash("sha256").update(key).digest("hex"),
    },
  });
  const t = await prepareThank({ base: BASE, mapId: slug, entryIndex: 11 });
  assert.equal((await api("/api/thanks", { method: "POST", key, body: t.body })).status, 201);
  const page = await api(`/t/${t.url.split("/t/")[1]}`);
  assert.ok(page.text.includes("Who haven&#x27;t you thanked properly yet?") || page.text.includes("Who haven't you thanked properly yet?"));
  assert.match(page.text, /one of twelve questions/);
  const t3 = await prepareThank({ base: BASE, mapId: slug, entryIndex: 3 });
  assert.equal((await api("/api/thanks", { method: "POST", key, body: t3.body })).status, 201);
  assert.ok((await api(`/t/${t3.url.split("/t/")[1]}`)).text.includes("still makes you laugh"), "old wording kept for set 2");
  const patch = await api(`/api/maps/${slug}`, { method: "PATCH", key, body: { entries: [0, 1, 2, 3, 11, 9].map((q, i) => ({ city: ["Kochi", "Pune", "Delhi", "Mumbai", "Chennai", "Goa"][i], questionIndex: q })) } });
  assert.equal(patch.status, 200, patch.text);
  // A new map is set 3 and cannot use index 8+.
  const bad = await api("/api/maps", { method: "POST", body: { homeCity: "Kochi", ownerName: "Z", entries: [0, 1, 2, 3, 8].map((q) => ({ city: "Delhi", questionIndex: q })) } });
  assert.equal(bad.status, 400);
  await db.map.delete({ where: { id: map.id } });
});

test("delete via keeper key: real delete, cascades, brought-in maps keep living", async () => {
  const parent = await db.map.findFirst({ where: { shortSlug: S.slug } });
  assert.equal((await api(`/api/maps/${S.slug}`, { method: "DELETE", key: "wrong" })).status, 403);
  assert.equal((await api(`/api/maps/${S.slug}`, { method: "DELETE", key: S.key })).status, 200);
  assert.equal((await api(`/api/maps/${S.slug}`)).status, 404);
  assert.equal(await db.thankLink.count({ where: { mapId: parent!.id } }), 0);
  assert.equal(await db.vouch.count({ where: { mapId: parent!.id } }), 0);
  assert.equal(await db.analyticsEvent.count({ where: { mapId: parent!.id } }), 0);
  assert.equal(await db.map.count({ where: { invitedByMapId: parent!.id } }), 0);
  assert.equal((await api(`/t/${S.token}`)).text.includes("couldn"), true);
});

test("PRIVACY sweep: the friend's name and raw tokens appear in no table", async () => {
  const dump = await db.$queryRawUnsafe<{ j: string }[]>(
    `SELECT string_agg(t::text, ' ') AS j FROM (
       SELECT row_to_json(m)::text t FROM "Map" m UNION ALL
       SELECT row_to_json(l)::text FROM "ThankLink" l UNION ALL
       SELECT row_to_json(v)::text FROM "Vouch" v UNION ALL
       SELECT row_to_json(e)::text FROM "AnalyticsEvent" e UNION ALL
       SELECT row_to_json(r)::text FROM "RateLimit" r) x`
  );
  const all = dump[0].j ?? "";
  assert.ok(all.length > 1000);
  assert.ok(!all.includes(FRIEND), "friend name found in the database");
  assert.ok(!all.includes(S.token), "raw token found in the database");
});

test("GET /api/cities: ranked, qualified suggestions from the full list; small and quick", async () => {
  const t = Date.now();
  const r = await api("/api/cities?q=springfield&home=Seattle");
  const ms = Date.now() - t;
  assert.equal(r.status, 200);
  assert.ok(r.text.length < 2000, `${r.text.length} bytes`);
  assert.ok(ms < 1000, `${ms} ms`);
  const labels = r.json.results.map((x: { label: string }) => x.label);
  assert.ok(labels.includes("Springfield, IL") && labels.includes("Springfield, MO"), labels.join());
  assert.equal(r.json.match, null);
  const h = await api("/api/cities?q=hyderabad");
  assert.deepEqual(h.json.results.slice(0, 2).map((x: { label: string }) => x.label), ["Hyderabad, India", "Hyderabad, Pakistan"]);
  assert.equal((await api("/api/cities?q=Tirunelveli")).json.match, "Tirunelveli");
  assert.equal((await api("/api/cities?q=US&limit=3")).json.country, "USA");
  assert.deepEqual((await api("/api/cities")).json.results, []);
  assert.equal((await api(`/api/cities?q=${"x".repeat(5000)}`)).status, 200);
  assert.ok(!(await api("/api/cities?q=kannur")).text.includes("Kanpur"));
});

test("a map with GeoNames cities (a Canadian city, an Indian town, a collision) saves and reads back with its places", async () => {
  const entries = ["Tirunelveli", "Winnipeg", "Springfield, IL", "Leeds", "Kochi"].map((city, questionIndex) => ({ city, questionIndex }));
  const r = await api("/api/maps", { method: "POST", dev: device(), body: { homeCity: "Bengaluru", ownerName: "Ananya", entries } });
  assert.equal(r.status, 201, r.text);
  const pub = await api(`/api/maps/${r.json.id}`);
  assert.deepEqual(pub.json.lanterns, ["Kochi", "Leeds", "Springfield, IL", "Tirunelveli", "Winnipeg"]);
  assert.ok(pub.json.places.some((p: { name: string; lat: number }) => p.name === "Winnipeg" && p.lat > 49));
  const bad = await api("/api/maps", { method: "POST", dev: device(), body: { homeCity: "Bengaluru", ownerName: "Ananya", entries: entries.map((e, i) => (i ? e : { ...e, city: "Atlantis" })) } });
  assert.equal(bad.status, 400);
});
