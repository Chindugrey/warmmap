/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Phase-1 analytics pages against a running local server and the LOCAL database:
// every page is behind the admin gate; counts match a seeded fixture; and no
// friend's name, no device / IP hash and no surname ever reaches HTML, JSON or CSV.
// Owner first names appear only on the creators list and the ranking.
//   BASE=http://localhost:3102 DATABASE_URL=… ADMIN_TOKEN=local-admin-token npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

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
const DAY = 86_400_000;

after(async () => {
  await db.map.deleteMany({ where: { id: { in: mapIds } } }); // cascades links, vouches, events
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
    data: { homeCity: "Pune", ownerName: OWNER_B, arrivedVia: "map", invitedByMapId: A.id, kind: "hearth", km: 10,
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
  await db.analyticsEvent.createMany({
    data: [
      { mapId: A.id, event: "share", metadata: { channel: "whatsapp" } },
      { mapId: A.id, event: "share", metadata: { channel: "whatsapp" } },
      { mapId: A.id, event: "share", metadata: { channel: "linkedin" } },
      { mapId: A.id, event: "map_view", metadata: { s: "wa" } },
      { mapId: A.id, event: "map_view", metadata: {} },
    ],
  });

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

  // Timeline of A: ordered, with its shares / opens / links / vouch / spawned map, and no names, no child id.
  const tj = await (await fetch(`${BASE}/admin/dashboard/map/${A.id}?format=json`, { headers: bearer })).json();
  const whats = tj.items.map((i: any) => i.what);
  for (const w of ["Created", "Lanterns", "Shared", "Opened", "Thank-link sent", "Tied back (gold)", "Spawned a map"]) assert.ok(whats.includes(w), w);
  assert.equal(whats.filter((w: string) => w === "Shared").length, 3);
  const sorted = [...tj.items].map((i: any) => i.at).sort();
  assert.deepEqual(tj.items.map((i: any) => i.at), sorted);
  const timelineText = JSON.stringify(tj) + (await (await fetch(`${BASE}/admin/dashboard/map/${A.id}`, { headers: bearer })).text());
  assert.ok(!timelineText.includes(B.id) && !timelineText.includes(C.id), "spawned maps are not linked");
  const bySlug = await fetch(`${BASE}/admin/dashboard/map/${A.publicId}?format=json`, { headers: bearer });
  assert.equal((await bySlug.json()).id, A.id);
  assert.equal((await fetch(`${BASE}/admin/dashboard/map/nosuchmap123?format=json`, { headers: bearer })).status, 404);
  assert.equal((await fetch(`${BASE}/admin/dashboard/map/${encodeURIComponent("x' or 1=1")}?format=json`, { headers: bearer })).status, 404);

  // Virality sees the tree.
  const vj = await (await fetch(`${BASE}/admin/dashboard/virality?format=json`, { headers: bearer })).json();
  assert.ok(vj.generations.find((g: any) => g.generation === 2)?.maps >= 1);
  assert.ok(vj.topTrees.some((t: any) => t.rootId === A.id && t.size === 3 && t.generations === 2 && t.fromMap === 1 && t.fromThanks === 1));
  assert.equal(vj.funnel.rows.length, 4);

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
