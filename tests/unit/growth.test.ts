import test from "node:test";
import assert from "node:assert/strict";
import {
  buildForest, capped, channelFunnel, cohorts, firstName, generationCounts, istDayIso, istWeekStart, likePattern, parseCreatorQuery,
  timeline, topTrees, viralFactor, warmth, CREATOR_CSV_COLUMNS, TREE_DEPTH_CAP, type CreatorRow, type MapNode, type TimelineInput,
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
    { channel: "wa", label: "WhatsApp", shares: 10, opens: 5, makeYours: 4, openPerShare: 50, makeYoursPerOpen: 80, savedEst: 1, savedEstPerShare: 10, kEst: 0.05 }
  );
  assert.equal(r.rows[1].openPerShare, null, "no shares: no percentage, not Infinity");
  assert.equal(r.rows[1].savedEst, 0);
  // Every number derived from the estimate says so in its name; the per-row "saved / make yours" (just the overall rate) is gone.
  for (const k of Object.keys(r.rows[0])) if (/saved|^k/i.test(k)) assert.match(k, /Est/, k);
  assert.ok(!("savedPerMakeYours" in r.rows[0]));
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

test("creators query: clamps, allow-listed sort, literal search pattern", () => {
  const q = (x: string) => parseCreatorQuery(new URLSearchParams(x));
  assert.deepEqual(q(""), { q: "", sort: "createdAt", dir: "desc", page: 1, perPage: 50 });
  assert.equal(q("sort=ownerName;drop").sort, "createdAt", "unknown sort keys fall back");
  assert.equal(q("sort=warmth&dir=asc").sort, "warmth");
  assert.equal(q("dir=sideways").dir, "desc");
  for (const p of ["-3", "0", "abc", ""]) assert.equal(q(`page=${p}`).page, 1, `page=${p}`);
  assert.equal(q("page=999999999").page, 100_000);
  assert.equal(q(`q=${"x".repeat(200)}`).q.length, 60);
  assert.equal(likePattern("ko"), "%ko%");
  assert.equal(likePattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
});

test("CSV columns: no id, no hash; thank-you maps date-only; capped counts marked", () => {
  const cols = CREATOR_CSV_COLUMNS.map(([h]) => h);
  for (const banned of ["id", "hash", "device", "ip", "name"]) {
    assert.ok(!cols.some((c) => c === banned || (c.includes(banned) && c !== "first_name")), `CSV column ${banned}`);
  }
  const row: CreatorRow = {
    id: "x", firstName: "Meera", homeCity: "Kochi", createdAt: "2026-11-12T00:00:00.000Z", kind: "hearth", lanterns: 5, cities: 3, km: 0,
    gold: 0, thankLinks: 0, shares: { whatsapp: 0, linkedin: 0, copy: 0, story: 0, native: 0 }, sharesTotal: 0, shares30d: 0, opens: 0,
    spawnedDirect: 1, spawnedAll: 60, spawnedAllCapped: true, arrivedVia: "thanks", warmth: 0,
  };
  const cell = (name: string) => CREATOR_CSV_COLUMNS.find(([h]) => h === name)![1](row);
  assert.doesNotMatch(String(cell("created_ist")), /:/, "date only");
  assert.equal(cell("maps_spawned_all"), "60+");
  assert.equal(capped(3, false), "3");
});

const tlBase: TimelineInput = {
  map: {
    createdAt: at("2026-11-10T00:00:00Z"), updatedAt: at("2026-11-10T00:00:10Z"), arrivedVia: "thanks", lanterns: 5, cities: 4, kind: "hearth",
    homeCity: "Kochi", generation: 1, generationCapped: false, descendants: 3, descendantsCapped: false,
  },
  thankLinks: [{ createdAt: at("2026-11-11T10:00:00Z"), usedAt: at("2026-11-11T12:00:00Z") }],
  vouches: [{ createdAt: at("2026-11-11T12:00:00Z"), seenByOwnerAt: null }],
  daily: [
    { event: "share", days: [{ day: "2026-11-10", key: "whatsapp", count: 2 }, { day: "2026-11-10", key: "linkedin", count: 1 }] },
    { event: "map_view", days: [{ day: "2026-11-11", key: "wa", count: 9 }, { day: "2026-11-11", key: null, count: 5 }] },
    { event: "gold_seen", days: [] },
    { event: "link_report", days: [] },
  ],
  spawned: [{ day: "2026-11-13", key: "map", count: 2 }, { day: "2026-11-13", key: "thanks", count: 1 }],
};

test("timeline: ordered; opens, shares and spawned maps are daily counts, never exact times", () => {
  const items = timeline(tlBase);
  // The 11th: the exact link and tie first, then that day's count of opens.
  assert.deepEqual(items.map((i) => i.what), ["Created", "Lanterns", "Shared 3 times", "Thank-link sent", "Tied back (gold)", "Opened 14 times", "Spawned 3 maps"]);
  const opened = items.find((i) => i.what.startsWith("Opened"))!;
  assert.equal(opened.detail, "9 WhatsApp, 5 untagged");
  assert.equal(opened.at, "2026-11-10T18:30:00.000Z", "00:00 IST on the 11th");
  const spawned = items.at(-1)!;
  assert.equal(spawned.detail, "2 via shared map, 1 via thank-you");
  assert.doesNotMatch(spawned.detail, /brought|more/, "no per-child reach");
  // Every row that is not the map's own link / tie / edit sits on an IST midnight and is date-only.
  for (const i of items.filter((x) => !["Thank-link sent", "Tied back (gold)", "Last changed"].includes(x.what))) {
    assert.equal(i.dateOnly, true, i.what);
  }
  for (const i of items.filter((x) => /^(Shared|Opened|Spawned)/.test(x.what))) assert.match(i.at, /T18:30:00\.000Z$/, i.what);
  assert.match(items[0].detail, /3 maps below it in all generations/);
  assert.ok(!items.some((i) => i.what === "Last changed"), "an update within a minute of creation is not listed");
  assert.equal(istDayIso("2026-11-13"), "2026-11-12T18:30:00.000Z");
});

test("timeline: the depth cap is said, not hidden", () => {
  const items = timeline({ ...tlBase, map: { ...tlBase.map, generation: TREE_DEPTH_CAP, generationCapped: true, descendants: 50, descendantsCapped: true } });
  assert.match(items[0].detail, new RegExp(`generation ${TREE_DEPTH_CAP}\\+`));
  assert.match(items[0].detail, /50\+ maps below/);
  assert.match(items[0].detail, /depth capped at 50/);
  assert.equal(TREE_DEPTH_CAP, 50);
});
