/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// Phase 3: the manual engagement log against a running local server and the LOCAL database
// (migration 20261120120000_engagement_log applied).
//   BASE=http://localhost:3106 DATABASE_URL=… ADMIN_TOKEN=… npm run test:api
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3106";
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
for (const u of [BASE, process.env.DATABASE_URL ?? ""]) {
  if (!/(localhost|127\.0\.0\.1)/.test(u)) throw new Error(`refusing non-local target: ${u}`);
}
const db = new PrismaClient();
const tag = Date.now().toString(36);
const PATH = "/admin/dashboard/engagement";
const json = { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" };
const bearer = { Authorization: `Bearer ${ADMIN}` };
const CAMP = `t-${tag}`;
const OWNER = `Zzeng${tag}`;
const SURNAME = `Zzsurn${tag}`;
const mapIds: string[] = [];
const entryIds: string[] = [];

const mk = async (ownerName: string) => {
  const m = await db.map.create({ data: { homeCity: "Pune", ownerName, entries: [{ city: "Pune", questionIndex: 0 }] } });
  mapIds.push(m.id);
  return m;
};
const post = async (body: unknown, headers: Record<string, string> = json) => {
  const r = await fetch(BASE + PATH, { method: "POST", headers, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (j.id) entryIds.push(j.id);
  return { status: r.status, j };
};
const view = async (qs: string) => (await fetch(`${BASE}${PATH}?format=json&${qs}`, { headers: bearer })).json() as Promise<any>;

after(async () => {
  await db.engagementLog.deleteMany({ where: { OR: [{ id: { in: entryIds } }, { campaign: CAMP }] } });
  await db.map.deleteMany({ where: { id: { in: mapIds } } });
  await db.$disconnect();
});

test("auth gate: no token or a wrong token gets 401 and nothing is written", async () => {
  const before = await db.engagementLog.count();
  assert.equal((await fetch(BASE + PATH)).status, 401);
  const page = await fetch(BASE + PATH);
  assert.match(await page.text(), /name="token"/);
  for (const h of [{ "Content-Type": "application/json" }, { ...json, Authorization: "Bearer wrong-token-wrong-token" }]) {
    const r = await fetch(BASE + PATH, { method: "POST", headers: h, body: JSON.stringify({ platform: "linkedin", occurredOn: "2026-11-19", campaign: CAMP }) });
    assert.equal(r.status, 401);
  }
  assert.equal((await fetch(`${BASE}${PATH}?format=json`)).status, 401);
  const del = await fetch(BASE + PATH, { method: "POST", body: new URLSearchParams({ deleteId: "whatever1" }) });
  assert.equal(del.status, 401);
  assert.equal(await db.engagementLog.count(), before);
});

test("validation: each bad field is a 400 naming the field; nothing is stored", async () => {
  const ok = { platform: "linkedin", occurredOn: "2026-11-19", campaign: CAMP };
  for (const [patch, field] of [
    [{ platform: "tiktok" }, "platform"], [{ likes: -5 }, "likes"], [{ comments: "x" }, "comments"], [{ postUrl: "javascript:alert(1)" }, "postUrl"],
    [{ occurredOn: "2999-01-01" }, "occurredOn"], [{ note: "n".repeat(281) }, "note"], [{ campaign: "a/b" }, "campaign"],
  ] as const) {
    const r = await post({ ...ok, ...patch });
    assert.equal(r.status, 400, field);
    assert.ok(field in r.j.errors, field);
  }
  assert.equal(await db.engagementLog.count({ where: { campaign: CAMP } }), 0);
});

test("map scoping: by public id, by unique owner name; unknown and ambiguous names are refused", async () => {
  const a = await mk(`${OWNER} ${SURNAME}`);
  const b = await mk(`Zzdup${tag}`);
  await mk(`Zzdup${tag} Other`);
  const base = { platform: "linkedin", occurredOn: "2026-11-19", campaign: CAMP, likes: 4 };
  assert.equal((await post({ ...base, map: a.publicId })).status, 201);
  assert.equal((await post({ ...base, map: OWNER.toLowerCase(), likes: 6 })).status, 201);
  const unknown = await post({ ...base, map: `nomap${tag}` });
  assert.equal(unknown.status, 404);
  assert.match(unknown.j.errors.map, /No map/);
  const amb = await post({ ...base, map: `Zzdup${tag}` });
  assert.equal(amb.status, 404, "two maps share that first name");
  assert.match(amb.j.errors.map, /public id/);
  assert.equal((await post({ ...base, map: b.publicId })).status, 201);
  const rows = await db.engagementLog.findMany({ where: { campaign: CAMP } });
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((r) => r.mapId === a.id).length, 2);
});

test("aggregate: per map / platform / campaign totals, and the map and platform filters", async () => {
  const m = await mk(`Zzagg${tag}`);
  const c2 = `${CAMP}-b`;
  await post({ map: m.publicId, platform: "instagram", occurredOn: "2026-11-18", campaign: c2, likes: 10, comments: 2, reshares: 1 });
  await post({ map: m.publicId, platform: "linkedin", occurredOn: "2026-11-19", campaign: c2, likes: 1, comments: 1, reshares: 1 });
  await post({ platform: "whatsapp_status", occurredOn: "2026-11-19", campaign: c2, reshares: 7 });
  const all = await view(`campaign=${c2}`);
  assert.deepEqual(all.totals, { posts: 3, likes: 11, comments: 3, reshares: 9, total: 23 });
  assert.deepEqual(all.perCampaign.map((g: any) => [g.key, g.posts, g.total]), [[c2, 3, 23]]);
  assert.deepEqual(all.perPlatform.map((g: any) => g.key).sort(), ["instagram", "linkedin", "whatsapp_status"]);
  const byMap = Object.fromEntries(all.perMap.map((g: any) => [g.key, g.total]));
  assert.equal(byMap[m.id], 16);
  assert.equal(byMap["null"] ?? all.perMap.find((g: any) => g.key === null).total, 7);
  const one = await view(`campaign=${c2}&map=${m.publicId}`);
  assert.equal(one.totals.posts, 2);
  const li = await view(`campaign=${c2}&platform=linkedin`);
  assert.deepEqual(li.totals, { posts: 1, likes: 1, comments: 1, reshares: 1, total: 3 });
  const nope = await view(`campaign=${c2}&map=nomap${tag}`);
  assert.equal(nope.totals.posts, 0);
  await db.engagementLog.deleteMany({ where: { campaign: c2 } });
});

test("form POST (cookie): 303 and a row; a foreign Origin is 403; delete removes it; no names or hashes leak", async () => {
  const m = await mk(`${OWNER}x ${SURNAME}x`);
  const ok = await fetch(BASE + "/admin/dashboard", { method: "POST", body: new URLSearchParams({ token: ADMIN }), redirect: "manual" });
  const cookie = ok.headers.get("set-cookie")!.split(";")[0];
  const form = (extra: Record<string, string> = {}, headers: Record<string, string> = {}) =>
    fetch(BASE + PATH, {
      method: "POST", redirect: "manual", headers: { Cookie: cookie, ...headers },
      body: new URLSearchParams({ map: m.publicId, platform: "whatsapp_status", campaign: CAMP, likes: "3", comments: "0", reshares: "1", occurredOn: "2026-11-19", note: "from the form", ...extra }),
    });
  const evil = await form({}, { Origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  assert.equal(await db.engagementLog.count({ where: { mapId: m.id } }), 0);
  const r = await form({}, { Origin: BASE });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location") ?? "", /engagement\?ok=1/);
  const row = await db.engagementLog.findFirstOrThrow({ where: { mapId: m.id } });
  assert.equal(row.reshares, 1);
  const bad = await form({ likes: "abc" });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Likes must be a whole number/);
  const page = await fetch(`${BASE}${PATH}?campaign=${CAMP}`, { headers: { Cookie: cookie } });
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /<form class="log"/);
  assert.match(html, new RegExp(`${OWNER}x, Pune`));
  assert.doesNotMatch(html, new RegExp(SURNAME));
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.match(page.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.doesNotMatch(JSON.stringify(await view(`campaign=${CAMP}`)), new RegExp(`${SURNAME}|deviceHash|ipHash`));
  const del = await fetch(BASE + PATH, { method: "POST", redirect: "manual", headers: { Cookie: cookie }, body: new URLSearchParams({ deleteId: row.id }) });
  assert.equal(del.status, 303);
  assert.equal(await db.engagementLog.count({ where: { id: row.id } }), 0);
  assert.equal((await fetch(BASE + PATH, { method: "POST", headers: { Cookie: cookie }, body: new URLSearchParams({ deleteId: row.id }) })).status, 404);
});

test("deleting a map deletes its engagement rows", async () => {
  const m = await mk(`Zzcasc${tag}`);
  await post({ map: m.publicId, platform: "other", occurredOn: "2026-11-19", campaign: CAMP, likes: 1 });
  assert.equal(await db.engagementLog.count({ where: { mapId: m.id } }), 1);
  await db.map.delete({ where: { id: m.id } });
  assert.equal(await db.engagementLog.count({ where: { mapId: m.id } }), 0);
});
