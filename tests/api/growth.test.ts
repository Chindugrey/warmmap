/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Phase-1 analytics pages against a running local server and the LOCAL database:
// every page is behind the admin gate; counts match a seeded fixture; and no
// friend's name, no device / IP hash and no surname ever reaches HTML, JSON or CSV.
// Owner first names appear only on the creators list and the ranking.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { istStamp } from "@/lib/growth";
import { istDayStart } from "@/lib/dashboard";

const BASE = process.env.BASE ?? "http://localhost:3102";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const bearer = { Authorization: `Bearer ${ADMIN}` };
const tag = Date.now().toString(36);
const OWNER_A = `Zzgrowa${tag}`;
const SURNAME = `Zzsurname${tag}`;
const OWNER_B = `Zzgrowb${tag}`;
const OWNER_C = `Zzgrowc${tag}`;
const FRIEND = `Zzfriend${tag}`; // put straight into stored JSON: must still never show
const DEVICE = `devhash${tag}`.padEnd(64, "d");
const IP = `iphash${tag}`.padEnd(64, "e");
const mapIds: string[] = [];
const eventIds: string[] = [];
const DAY = 86_400_000;

after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } }); // cascades links, vouches, map events
  await db.analyticsEvent.deleteMany({ where: { id: { in: eventIds } } });
  await db.$disconnect();
});

const PAGES = ["/admin/dashboard/creators", "/admin/dashboard/virality", "/admin/dashboard/ranking", "/admin/dashboard/map/someid"];

test("every analytics page: 401 without a token, the token form for browsers, no data", async () => {
  for (const p of PAGES) {
    const bare = await fetch(BASE + p);
    assert.equal(bare.status, 401, p);
    const t = await bare.text();
    assert.match(t, /name="token"/, p);
    assert.doesNotMatch(t, /<table/, p);
    assert.match(bare.headers.get("x-robots-tag") ?? "", /noindex/, p);
    assert.equal(bare.headers.get("cache-control"), "no-store", p);
    for (const format of ["json", "csv"]) {
      for (const init of [{}, { headers: { Authorization: "Bearer wrong-token-wrong-token" } }]) {
        const r = await fetch(`${BASE}${p}?format=${format}`, init);
        assert.equal(r.status, 401, `${p} ${format}`);
        assert.deepEqual(await r.json(), { error: "Unauthorized" });
      }
    }
  }
  const forged = await fetch(`${BASE}/admin/dashboard/creators?format=csv`, { headers: { Cookie: `wm_admin=${Date.now() + 1e7}.${"0".repeat(64)}` } });
  assert.equal(forged.status, 401);
});

test("a signed-in browser (cookie) reaches the sub-pages", async () => {
  const ok = await fetch(`${BASE}/admin/dashboard`, { method: "POST", body: new URLSearchParams({ token: ADMIN }), redirect: "manual" });
  assert.equal(ok.status, 303);
  const cookie = ok.headers.get("set-cookie")!.split(";")[0];
  for (const p of PAGES.slice(0, 3)) {
    const r = await fetch(BASE + p, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200, p);
    assert.match(await r.text(), /<nav class="adm">/);
  }
  // Signed-in answers (HTML, JSON, CSV) are never cached and carry the admin headers.
  for (const p of ["/admin/dashboard", "/admin/dashboard?format=json", ...PAGES.slice(0, 3), ...PAGES.slice(0, 3).map((x) => `${x}?format=json`), "/admin/dashboard/creators?format=csv"]) {
    const r = await fetch(BASE + p, { headers: bearer });
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get("cache-control"), "no-store", p);
    assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/, p);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff", p);
    assert.equal(r.headers.get("referrer-policy"), "no-referrer", p);
    await r.arrayBuffer();
  }
  const csv = await fetch(`${BASE}/admin/dashboard/creators?format=csv`, { headers: { Cookie: cookie } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(csv.headers.get("content-disposition") ?? "", /attachment; filename="warmmap-creators.csv"/);
});

test("fixture: counts are right, and names / hashes stay where they belong", async () => {
  const now = Date.now();
  const q = (i: number, city: string) => ({ city, questionIndex: i });
  const A = await db.map.create({
    data: { homeCity: "Kochi", ownerName: `${OWNER_A} ${SURNAME}`, kind: "voyager", km: 1234, arrivedVia: "cold",
      entries: [q(0, "Pune"), q(1, "Delhi"), q(2, "Mumbai"), q(3, "Delhi"), { ...q(4, "Goa"), name: FRIEND }] },
  });
  const B = await db.map.create({
    data: { homeCity: "Pune", ownerName: OWNER_B, arrivedVia: "map", invitedByMapId: A.id, kind: "hearth", km: 10, createdAt: new Date(istDayStart(new Date(now)).getTime() - 12 * 3600_000 + 3 * 60_000 + 17_000),
      entries: [{ city: "Kochi", carried: true }, q(0, "Pune"), q(1, "Delhi"), q(2, "Pune"), q(3, "Pune"), q(4, "Pune")] },
  });
  const C = await db.map.create({
    data: { homeCity: "Pune", ownerName: OWNER_C, arrivedVia: "thanks", invitedByMapId: B.id, kind: "hearth", km: 0,
      createdAt: new Date(new Date(now).toISOString().slice(0, 10) + "T00:00:00.000Z"),
      entries: [q(0, "Pune"), q(1, "Pune"), q(2, "Pune"), q(3, "Pune"), q(4, "Pune")] },
  });
  mapIds.push(A.id, B.id, C.id);
  const l1 = await db.thankLink.create({ data: { tokenHash: `zzg-${tag}-1`, mapId: A.id, entryIndex: 0, expiresAt: new Date(now + DAY), usedAt: new Date() } });
  await db.thankLink.create({ data: { tokenHash: `zzg-${tag}-2`, mapId: A.id, entryIndex: 1, expiresAt: new Date(now + DAY) } });
  await db.vouch.create({ data: { mapId: A.id, entryIndex: 0, thankLinkId: l1.id, tier: "tap", deviceHash: DEVICE, ipHash: IP } });
  // Exact times on one IST day (yesterday, around noon), well away from the links and ties (made "now"), so a leak would be visible.
  const noonYesterday = istDayStart(new Date(now)).getTime() - 12 * 3600_000;
  const ago = (min: number) => new Date(noonYesterday + min * 60_000 + 7_000);
  const exactEvents = [
    { mapId: A.id, event: "share", metadata: { channel: "whatsapp" }, createdAt: ago(97) },
    { mapId: A.id, event: "share", metadata: { channel: "whatsapp" }, createdAt: ago(131) },
    { mapId: A.id, event: "share", metadata: { channel: "linkedin" }, createdAt: ago(173) },
    { mapId: A.id, event: "map_view", metadata: { s: "wa" }, createdAt: ago(211) },
    { mapId: A.id, event: "map_view", metadata: {}, createdAt: ago(257) },
  ];
  await db.analyticsEvent.createMany({ data: exactEvents });

  // Creators JSON: search by the unique first name.
  const cj = await (await fetch(`${BASE}/admin/dashboard/creators?format=json&q=${OWNER_A}`, { headers: bearer })).json();
  assert.equal(cj.total, 1);
  const a = cj.rows[0];
  assert.equal(a.firstName, OWNER_A);
  assert.deepEqual(
    { homeCity: a.homeCity, kind: a.kind, km: a.km, lanterns: a.lanterns, cities: a.cities, gold: a.gold, thankLinks: a.thankLinks, sharesTotal: a.sharesTotal, opens: a.opens, spawnedDirect: a.spawnedDirect, spawnedAll: a.spawnedAll, arrivedVia: a.arrivedVia },
    { homeCity: "Kochi", kind: "voyager", km: 1234, lanterns: 5, cities: 4, gold: 1, thankLinks: 2, sharesTotal: 3, opens: 2, spawnedDirect: 1, spawnedAll: 2, arrivedVia: "cold" }
  );
  assert.deepEqual(a.shares, { whatsapp: 2, linkedin: 1, copy: 0, story: 0, native: 0 });
  // warmth = 1x2 thank-links + 2x1 tie-back + 1x3 shares + 3x1 spawned + 1x1 later generation
  assert.equal(a.warmth, 11);
  const bRow = (await (await fetch(`${BASE}/admin/dashboard/creators?format=json&q=${OWNER_B}`, { headers: bearer })).json()).rows[0];
  assert.equal(bRow.lanterns, 5, "the carried lantern is not counted");

  // Ranking: A is listed with its components.
  const rj = await (await fetch(`${BASE}/admin/dashboard/ranking?format=json`, { headers: bearer })).json();
  assert.match(rj.formula, /warmth = /);
  assert.equal(rj.rows.find((r: any) => r.id === A.id)?.warmth, 11);

  // Timeline of A: links and ties exact; opens, shares and spawned maps as daily counts. No names, no child id.
  const tj = await (await fetch(`${BASE}/admin/dashboard/map/${A.id}?format=json`, { headers: bearer })).json();
  const whats = tj.items.map((i: any) => i.what);
  for (const w of ["Created", "Lanterns", "Shared 3 times", "Opened 2 times", "Thank-link sent", "Tied back (gold)"]) assert.ok(whats.includes(w), w);
  assert.ok(whats.some((w: string) => /^Spawned 1 map$/.test(w)), "one direct child, as a count");
  assert.equal(tj.items.find((i: any) => i.what === "Opened 2 times").detail, "1 WhatsApp, 1 untagged");
  assert.match(tj.items.find((i: any) => i.what === "Created").detail, /2 maps below it in all generations/);
  const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const days = tj.items.map((i: any) => istDay(i.at));
  assert.deepEqual(days, [...days].sort(), "in day order");
  const timelineHtml = await (await fetch(`${BASE}/admin/dashboard/map/${A.id}`, { headers: bearer })).text();
  const timelineText = JSON.stringify(tj) + timelineHtml;
  assert.ok(!timelineText.includes(B.id) && !timelineText.includes(C.id), "spawned maps are not linked");
  // S1 + S2: no exact child creation time and no exact open / share time, in JSON or HTML.
  const exact = [B.createdAt, C.createdAt, ...exactEvents.map((e) => e.createdAt)];
  const ats = new Set(tj.items.map((i: any) => i.at));
  for (const t of exact) {
    assert.ok(!ats.has(t.toISOString()), `exact ${t.toISOString()} in timeline JSON`);
    assert.ok(!timelineText.includes(t.toISOString()), `exact ${t.toISOString()} in timeline`);
    assert.ok(!timelineHtml.includes(istStamp(t)), `exact ${istStamp(t)} in timeline HTML`);
  }
  for (const i of tj.items.filter((x: any) => /^(Shared|Opened|Spawned)/.test(x.what))) {
    assert.equal(i.dateOnly, true, i.what);
    assert.match(i.at, /T18:30:00\.000Z$/, `${i.what} sits on an IST midnight`);
  }
  const bySlug = await fetch(`${BASE}/admin/dashboard/map/${A.publicId}?format=json`, { headers: bearer });
  assert.equal((await bySlug.json()).id, A.id);
  assert.equal((await fetch(`${BASE}/admin/dashboard/map/nosuchmap123?format=json`, { headers: bearer })).status, 404);
  assert.equal((await fetch(`${BASE}/admin/dashboard/map/${encodeURIComponent("x' or 1=1")}?format=json`, { headers: bearer })).status, 404);

  // Virality sees the tree.
  const vj = await (await fetch(`${BASE}/admin/dashboard/virality?format=json`, { headers: bearer })).json();
  assert.ok(vj.generations.find((g: any) => g.generation === 2)?.maps >= 1);
  assert.ok(vj.topTrees.some((t: any) => t.rootId === A.id && t.size === 3 && t.generations === 2 && t.fromMap === 1 && t.fromThanks === 1));
  assert.equal(vj.funnel.rows.length, 4);
  assert.equal(vj.kByRoute.map.maps + vj.kByRoute.thanks.maps + vj.kByRoute.other.maps, vj.viral.invited, "routes add up");

  // CSV: first name, city, dates, counts. No ids, no surname.
  const csv = await (await fetch(`${BASE}/admin/dashboard/creators?format=csv&q=${OWNER_A}`, { headers: bearer })).text();
  const [header, line, ...rest] = csv.trim().split("\n");
  assert.equal(rest.length, 0);
  assert.match(header, /^first_name,home_city,created_ist,/);
  assert.match(line, new RegExp(`^${OWNER_A},Kochi,`));
  assert.ok(!csv.includes(A.id) && !csv.includes(A.publicId));

  // Collect everything every page says, in every format.
  const get = async (p: string) => (await fetch(BASE + p, { headers: bearer })).text();
  const named = [
    await get("/admin/dashboard/creators?q=Zzgrow"), await get(`/admin/dashboard/creators?format=json&q=Zzgrow`),
    await get("/admin/dashboard/creators?format=csv"), await get("/admin/dashboard/ranking"), await get("/admin/dashboard/ranking?format=json"),
  ];
  const nameless = [
    await get("/admin/dashboard"), await get("/admin/dashboard?format=json"),
    await get("/admin/dashboard/virality"), await get("/admin/dashboard/virality?format=json"), await get("/admin/dashboard/virality?w=d7"),
    timelineText, await get(`/admin/dashboard/map/${B.id}`), await get(`/admin/dashboard/map/${C.id}?format=json`),
  ];
  assert.ok(named[0].includes(OWNER_A) && named[0].includes(OWNER_C), "the creators list shows first names");
  for (const text of [...named, ...nameless]) {
    for (const banned of [FRIEND, SURNAME, DEVICE, IP, "deviceHash", "ipHash", "tokenHash", "ownerKeyHash"]) {
      assert.ok(!text.includes(banned), `${banned} leaked`);
    }
  }
  for (const text of nameless) {
    for (const owner of [OWNER_A, OWNER_B, OWNER_C]) assert.ok(!text.includes(owner), `${owner} on a name-free page`);
  }
});

test("funnel: channel counts and the window, as deltas on a fixture", async () => {
  const vir = async (w: string) => (await (await fetch(`${BASE}/admin/dashboard/virality?format=json&w=${w}`, { headers: bearer })).json()).funnel;
  const before = { all: await vir("all"), d7: await vir("d7"), d30: await vir("d30") };
  const old = new Date(Date.now() - 40 * DAY);
  const rows = [
    { event: "share", metadata: { channel: "whatsapp" } },
    { event: "share", metadata: { channel: "whatsapp" } },
    { event: "share", metadata: { channel: "linkedin" }, createdAt: old },
    { event: "share", metadata: { channel: "native" } },
    { event: "map_view", metadata: { s: "wa" } },
    { event: "t_open", metadata: { via: "thanks", s: "wa" } },
    { event: "t_open", metadata: { via: "thanks", s: "li" }, createdAt: old },
    { event: "make_yours", metadata: { via: "map", s: "wa" } },
    { event: "make_yours", metadata: { via: "map", s: "li" }, createdAt: old },
    { event: "make_yours", metadata: { via: "thanks" } },
  ];
  for (const r of rows) eventIds.push((await db.analyticsEvent.create({ data: r as any })).id);
  const after = { all: await vir("all"), d7: await vir("d7"), d30: await vir("d30") };
  const ch = (f: any, c: string) => f.rows.find((r: any) => r.channel === c);
  const d = (w: "all" | "d7" | "d30", c: string, k: string) => ch(after[w], c)[k] - ch(before[w], c)[k];
  assert.deepEqual([d("all", "wa", "shares"), d("all", "wa", "opens"), d("all", "wa", "makeYours")], [2, 2, 1]);
  assert.deepEqual([d("all", "li", "shares"), d("all", "li", "opens"), d("all", "li", "makeYours")], [1, 1, 1]);
  for (const w of ["d7", "d30"] as const) {
    assert.deepEqual([d(w, "wa", "shares"), d(w, "wa", "opens"), d(w, "wa", "makeYours")], [2, 2, 1], w);
    assert.deepEqual([d(w, "li", "shares"), d(w, "li", "opens"), d(w, "li", "makeYours")], [0, 0, 0], `${w}: the 40-day-old events are outside`);
  }
  assert.equal(after.all.makeYoursAll - before.all.makeYoursAll, 3);
  assert.equal(after.d7.makeYoursAll - before.d7.makeYoursAll, 2);
  assert.equal(after.all.makeYoursUntagged - before.all.makeYoursUntagged, 1);
  assert.equal(after.all.nativeShares - before.all.nativeShares, 1);
  for (const r of after.all.rows) for (const k of Object.keys(r)) if (/saved|^k/i.test(k)) assert.match(k, /Est/, k);
});

test("tree depth cap: counted to 50 levels and said (50+), on the timeline and the creators list", async () => {
  const root = await db.map.create({ data: { homeCity: "Kochi", ownerName: `Zzchain${tag}`, kind: "hearth", km: 0, entries: [], arrivedVia: "cold" } });
  mapIds.push(root.id);
  let parent = root.id;
  for (let i = 0; i < 55; i++) {
    const m = await db.map.create({ data: { homeCity: "Kochi", ownerName: null, kind: "hearth", km: 0, entries: [], arrivedVia: "map", invitedByMapId: parent } });
    mapIds.push(m.id);
    parent = m.id;
  }
  const deep = await (await fetch(`${BASE}/admin/dashboard/map/${parent}?format=json`, { headers: bearer })).json();
  assert.match(deep.items[0].detail, /generation 50\+/);
  assert.match(deep.items[0].detail, /depth capped at 50/);
  const top = await (await fetch(`${BASE}/admin/dashboard/map/${root.id}?format=json`, { headers: bearer })).json();
  assert.match(top.items[0].detail, /generation 0,/);
  assert.match(top.items[0].detail, /50\+ maps below it/);
  const html = await (await fetch(`${BASE}/admin/dashboard/map/${root.id}`, { headers: bearer })).text();
  assert.match(html, /depth capped at 50/);
  const row = (await (await fetch(`${BASE}/admin/dashboard/creators?format=json&q=Zzchain${tag}`, { headers: bearer })).json()).rows[0];
  assert.deepEqual([row.spawnedDirect, row.spawnedAll, row.spawnedAllCapped], [1, 50, true]);
  const csv = await (await fetch(`${BASE}/admin/dashboard/creators?format=csv&q=Zzchain${tag}`, { headers: bearer })).text();
  assert.match(csv.split("\n")[1], /,50\+,/);
  // A shallow tree is not flagged.
  const a = (await (await fetch(`${BASE}/admin/dashboard/creators?format=json&q=Zzgrowa${tag}`, { headers: bearer })).json()).rows[0];
  assert.equal(a.spawnedAllCapped, false);
});

test("creators: SQL search is literal, sort and paging are server-side", async () => {
  const j = async (qs: string) => (await fetch(`${BASE}/admin/dashboard/creators?format=json&${qs}`, { headers: bearer })).json();
  assert.equal((await j("q=%25")).total, 0, "a % in the search is a literal %, not a wildcard");
  const page = await j("q=Zzgrow&sort=firstName&dir=asc");
  assert.deepEqual(page.rows.map((r: any) => r.firstName), [`Zzgrowa${tag}`, `Zzgrowb${tag}`, `Zzgrowc${tag}`]);
  const past = await j("q=Zzgrow&page=99");
  assert.equal(past.page, 1, "a page past the end shows the last page");
  assert.equal(past.rows.length, 3);
  assert.equal((await j("page=-4")).page, 1);
});
