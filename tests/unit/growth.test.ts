import test from "node:test";
import assert from "node:assert/strict";
import {
  buildForest, channelFunnel, cohorts, creatorRows, firstName, generationCounts, istWeekStart, parseCreatorQuery,
  queryCreators, timeline, topTrees, viralFactor, warmth, CREATOR_CSV_COLUMNS, type MapFacts, type MapNode,
} from "@/lib/growth";

const at = (iso: string) => new Date(iso);
// IST 09:00 on 10 Nov 2026 = 03:30 UTC.
const nodes: MapNode[] = [
  { id: "A", parent: null, createdAt: at("2026-11-10T03:30:00Z"), arrivedVia: "cold" },
  { id: "B", parent: "A", createdAt: at("2026-11-11T03:30:00Z"), arrivedVia: "map" },
  { id: "C", parent: "B", createdAt: at("2026-11-12T00:00:00Z"), arrivedVia: "thanks" },
  { id: "D", parent: "A", createdAt: at("2026-11-17T03:30:00Z"), arrivedVia: "map" },
  { id: "E", parent: null, createdAt: at("2026-11-17T04:30:00Z"), arrivedVia: "seed" },
  { id: "F", parent: "deleted-map", createdAt: at("2026-11-18T03:30:00Z"), arrivedVia: "map" }, // inviter gone: a root
];

test("forest: depth, children, descendants; a dangling pointer is a root", () => {
  const f = buildForest(nodes);
  assert.deepEqual(Object.fromEntries(f.depth), { A: 0, B: 1, C: 2, D: 1, E: 0, F: 0 });
  assert.deepEqual(f.children.get("A"), ["B", "D"]);
  assert.deepEqual(f.children.get("B"), ["C"]);
  assert.equal(f.children.has("E"), false);
  assert.deepEqual(Object.fromEntries(f.descendants), { A: 3, B: 1, C: 0, D: 0, E: 0, F: 0 });
  assert.equal(f.root.get("C"), "A");
});

test("forest: a cycle does not hang, and every node gets a depth", () => {
  const f = buildForest([
    { id: "X", parent: "Y", createdAt: at("2026-11-01T00:00:00Z"), arrivedVia: "map" },
    { id: "Y", parent: "X", createdAt: at("2026-11-01T00:00:00Z"), arrivedVia: "map" },
  ]);
  assert.equal(f.depth.size, 2);
  assert.deepEqual([...f.depth.values()].sort(), [0, 1]);
});

test("generations and viral factor", () => {
  const f = buildForest(nodes);
  assert.deepEqual(generationCounts(f), [{ generation: 0, maps: 3 }, { generation: 1, maps: 2 }, { generation: 2, maps: 1 }]);
  // 3 of 6 maps carry a live inviter (F's inviter was deleted): k = 0.5; A and B brought maps in.
  assert.deepEqual(viralFactor(nodes, f), { maps: 6, invited: 3, inviters: 2, k: 0.5 });
  assert.deepEqual(viralFactor([], buildForest([])), { maps: 0, invited: 0, inviters: 0, k: 0 });
});

test("top trees: size, depth, arrivals; single-map trees left out", () => {
  const t = topTrees(nodes, buildForest(nodes));
  assert.equal(t.length, 1);
  assert.deepEqual({ ...t[0], rootCreatedAt: undefined }, { rootId: "A", rootCreatedAt: undefined, size: 4, generations: 2, fromMap: 2, fromThanks: 1 });
});

test("IST weeks start Monday 00:00 IST", () => {
  // Thu 19 Nov 2026 10:00 IST -> Mon 16 Nov 00:00 IST = Sun 15 Nov 18:30 UTC.
  assert.equal(istWeekStart(at("2026-11-19T04:30:00Z")).toISOString(), "2026-11-15T18:30:00.000Z");
  // Mon 16 Nov 00:10 IST is still that week.
  assert.equal(istWeekStart(at("2026-11-15T18:40:00Z")).toISOString(), "2026-11-15T18:30:00.000Z");
  // Sun 15 Nov 23:50 IST is the week before.
  assert.equal(istWeekStart(at("2026-11-15T18:20:00Z")).toISOString(), "2026-11-08T18:30:00.000Z");
});

test("cohorts: weekly and daily viral factor", () => {
  const f = buildForest(nodes);
  const now = at("2026-11-19T04:30:00Z");
  const weeks = cohorts(nodes, f, "week", now, 2);
  // Week of 9 Nov: A, B, C (B and C invited); A brought B and D, B brought C -> 3 children over 3 maps.
  assert.deepEqual(weeks[0], { start: "2026-11-08T18:30:00.000Z", maps: 3, invitedMaps: 2, children: 3, descendants: 4, k: 1 });
  // Week of 16 Nov: D, E, F; D invited; none brought anyone in.
  assert.deepEqual(weeks[1], { start: "2026-11-15T18:30:00.000Z", maps: 3, invitedMaps: 1, children: 0, descendants: 0, k: 0 });
  const days = cohorts(nodes, f, "day", now, 10);
  assert.equal(days.length, 10);
  assert.equal(days.reduce((a, d) => a + d.maps, 0), 6);
  const d10 = days.find((d) => d.start === "2026-11-09T18:30:00.000Z")!; // 10 Nov IST: A only
  assert.deepEqual({ maps: d10.maps, children: d10.children, k: d10.k }, { maps: 1, children: 2, k: 2 });
  // C was stamped 12 Nov 00:00 UTC = 05:30 IST on the 12th.
  assert.equal(days.find((d) => d.start === "2026-11-11T18:30:00.000Z")!.maps, 1);
});

test("channel funnel: conversions and the estimated saved maps", () => {
  const r = channelFunnel(
    [
      { channel: "wa", label: "WhatsApp", shares: 10, opens: 5, makeYours: 4 },
      { channel: "li", label: "LinkedIn", shares: 0, opens: 3, makeYours: 0 },
    ],
    { makeYoursAll: 8, invitedSaved: 2, mapsTotal: 20 }
  );
  assert.equal(r.saveRate, 0.25);
  assert.deepEqual(
    { ...r.rows[0] },
    { channel: "wa", label: "WhatsApp", shares: 10, opens: 5, makeYours: 4, openPerShare: 50, makeYoursPerOpen: 80, savedEst: 1, savedPerMakeYours: 25, savedPerShare: 10, k: 0.05 }
  );
  assert.equal(r.rows[1].openPerShare, null, "no shares: no percentage, not Infinity");
  assert.equal(r.rows[1].savedEst, 0);
  // The rate is capped at 100% (more saved invited maps than taps, e.g. older maps).
  assert.equal(channelFunnel([], { makeYoursAll: 2, invitedSaved: 5, mapsTotal: 5 }).saveRate, 1);
  assert.equal(channelFunnel([], { makeYoursAll: 0, invitedSaved: 5, mapsTotal: 5 }).saveRate, 0);
});

test("warmth: the documented weights", () => {
  assert.equal(warmth({ thankLinks: 0, tiesBack: 0, shares: 0, spawnedDirect: 0, spawnedAll: 0 }), 0);
  // 1x4 + 2x3 + 1x5 + 3x2 + 1x(7-2)
  assert.equal(warmth({ thankLinks: 4, tiesBack: 3, shares: 5, spawnedDirect: 2, spawnedAll: 7 }), 26);
});

test("first name only", () => {
  assert.equal(firstName("  Ananya   Rao "), "Ananya");
  assert.equal(firstName(null), "");
});

const fact = (n: MapNode, extra: Partial<MapFacts>): MapFacts => ({
  ...n, ownerName: null, homeCity: "Kochi", kind: "hearth", km: 0, lanterns: 5, cities: 3, gold: 0, thankLinks: 0, opens: 0,
  shares: { whatsapp: 0, linkedin: 0, copy: 0, story: 0, native: 0 }, ...extra,
});

test("creators: rows, search, sort, pages, CSV columns", () => {
  const facts = [
    fact(nodes[0], { ownerName: "Ananya Rao", homeCity: "Bengaluru", gold: 2, thankLinks: 3, shares: { whatsapp: 2, linkedin: 1, copy: 0, story: 0, native: 0 } }),
    fact(nodes[1], { ownerName: "Arjun", homeCity: "Pune" }),
    fact(nodes[2], { ownerName: "Meera", homeCity: "Kochi" }),
    fact(nodes[3], { ownerName: "Zoya", homeCity: "Delhi" }),
    fact(nodes[4], { ownerName: "Kabir", homeCity: "Bengaluru" }),
    fact(nodes[5], { ownerName: "Ravi", homeCity: "Kochi" }),
  ];
  const rows = creatorRows(facts, buildForest(facts));
  const a = rows.find((r) => r.id === "A")!;
  assert.equal(a.firstName, "Ananya");
  assert.equal(a.sharesTotal, 3);
  assert.equal(a.spawnedDirect, 2);
  assert.equal(a.spawnedAll, 3);
  assert.equal(a.warmth, 3 + 2 * 2 + 3 + 3 * 2 + 1);

  const q = (s: string) => parseCreatorQuery(new URLSearchParams(s));
  assert.deepEqual(queryCreators(rows, q("q=bengal")).rows.map((r) => r.id).sort(), ["A", "E"]);
  assert.deepEqual(queryCreators(rows, q("q=ARJ")).rows.map((r) => r.id), ["B"]);
  assert.deepEqual(queryCreators(rows, q("sort=firstName&dir=asc")).rows.map((r) => r.firstName), ["Ananya", "Arjun", "Kabir", "Meera", "Ravi", "Zoya"]);
  assert.equal(queryCreators(rows, q("")).rows[0].id, "F", "default: newest first");
  assert.equal(queryCreators(rows, q("sort=warmth")).rows[0].id, "A");
  const paged = queryCreators(rows, { ...q(""), perPage: 4, page: 2 });
  assert.deepEqual({ total: paged.total, pages: paged.pages, n: paged.rows.length }, { total: 6, pages: 2, n: 2 });
  assert.equal(queryCreators(rows, { ...q("page=99"), perPage: 4 }).rows.length, 2, "a page past the end shows the last page");
  assert.equal(q("sort=ownerName;drop").sort, "createdAt", "unknown sort keys fall back");

  const cols = CREATOR_CSV_COLUMNS.map(([h]) => h);
  for (const banned of ["id", "hash", "device", "ip", "name"]) {
    assert.ok(!cols.some((c) => c === banned || (c.includes(banned) && c !== "first_name")), `CSV column ${banned}`);
  }
});

test("timeline: ordered, date-only for thank-you maps, no names", () => {
  const items = timeline({
    map: { createdAt: at("2026-11-10T00:00:00Z"), updatedAt: at("2026-11-10T00:00:10Z"), arrivedVia: "thanks", lanterns: 5, cities: 4, kind: "hearth", homeCity: "Kochi", generation: 1 },
    thankLinks: [{ createdAt: at("2026-11-11T10:00:00Z"), usedAt: at("2026-11-11T12:00:00Z") }],
    vouches: [{ createdAt: at("2026-11-11T12:00:00Z"), seenByOwnerAt: null }],
    events: [
      { createdAt: at("2026-11-10T09:00:00Z"), event: "share", metadata: { channel: "whatsapp" } },
      { createdAt: at("2026-11-10T09:30:00Z"), event: "map_view", metadata: { s: "wa" } },
    ],
    spawned: [{ createdAt: at("2026-11-13T00:00:00Z"), arrivedVia: "thanks", descendants: 2 }],
  });
  assert.deepEqual(items.map((i) => i.what), ["Created", "Lanterns", "Shared", "Opened", "Thank-link sent", "Tied back (gold)", "Spawned a map"]);
  assert.equal(items[0].dateOnly, true);
  assert.equal(items.at(-1)!.dateOnly, true);
  assert.match(items.at(-1)!.detail, /brought 2 more/);
  assert.equal(items[2].detail, "WhatsApp");
  assert.ok(!items.some((i) => i.what === "Last changed"), "an update within a minute of creation is not listed");
});
