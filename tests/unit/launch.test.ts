import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_START, TIE_MIN_LINKS, mapInWindow, parseLaunchWindow, scoreboard, utcDayStart,
  type LaunchInput, type LaunchMap,
} from "@/lib/launch";
import { renderLaunch } from "@/lib/launch-html";

const at = (iso: string) => new Date(iso);
const H = 3_600_000;
const from = at(LAUNCH_START); // 25 Nov 13:00Z = 18:30 IST
const W = { from, to: at("2026-11-28T13:00:00Z"), note: null };
const NOW = at("2026-11-28T13:00:00Z");
const COUNTRY: Record<string, string> = { Bengaluru: "India", Kochi: "India", London: "UK", Dubai: "UAE" };
const countryOf = (c: string) => COUNTRY[c] ?? null;
const lit = (...cities: string[]) => cities.map((city, questionIndex) => ({ city, questionIndex }));
const noChannels = [
  { channel: "wa", label: "WhatsApp", shares: 0, opens: 0, makeYours: 0 },
  { channel: "li", label: "LinkedIn", shares: 0, opens: 0, makeYours: 0 },
  { channel: "cp", label: "Copied link", shares: 0, opens: 0, makeYours: 0 },
  { channel: "st", label: "Story picture", shares: 0, opens: 0, makeYours: 0 },
  { channel: "native", label: "Share sheet", shares: 0, opens: 0, makeYours: 0 },
];
const input = (o: Partial<LaunchInput>): LaunchInput => ({
  window: W, now: NOW, maps: [], links: [], vouches: [], channels: noChannels, linkedinPosts: null, countryOf, ...o,
});
const map = (id: string, iso: string, o: Partial<LaunchMap> = {}): LaunchMap => ({
  id, invitedByMapId: null, createdAt: at(iso), arrivedVia: "cold", entries: lit("Bengaluru"), ...o,
});

test("window: default is launch to now; overrides, bad values and a reversed pair", () => {
  const now = at("2026-11-26T00:00:00Z");
  const d = parseLaunchWindow(new URLSearchParams(), now);
  assert.equal(d.from.toISOString(), "2026-11-25T13:00:00.000Z");
  assert.equal(d.to, now);
  assert.equal(d.note, null);
  const o = parseLaunchWindow(new URLSearchParams("from=2026-11-20T00:00:00Z&to=2026-11-21T00:00:00%2B05:30"), now);
  assert.equal(o.from.toISOString(), "2026-11-20T00:00:00.000Z");
  assert.equal(o.to.toISOString(), "2026-11-20T18:30:00.000Z");
  const bad = parseLaunchWindow(new URLSearchParams("from=yesterday"), now);
  assert.equal(bad.from.toISOString(), LAUNCH_START);
  assert.match(bad.note!, /from= was not a date/);
  const rev = parseLaunchWindow(new URLSearchParams("from=2026-11-27T00:00:00Z&to=2026-11-26T00:00:00Z"), now);
  assert.ok(rev.from < rev.to);
  assert.match(rev.note!, /swapped/);
});

test("maps in the window: seed left out, bounds inclusive, a thank-you map's date-only stamp counts from 00:00 UTC", () => {
  assert.equal(mapInWindow({ createdAt: from, arrivedVia: "cold" }, W), true);
  assert.equal(mapInWindow({ createdAt: new Date(from.getTime() - 1), arrivedVia: "map" }, W), false);
  assert.equal(mapInWindow({ createdAt: W.to, arrivedVia: "map" }, W), true);
  assert.equal(mapInWindow({ createdAt: from, arrivedVia: "seed" }, W), false);
  assert.equal(utcDayStart(from).toISOString(), "2026-11-25T00:00:00.000Z");
  assert.equal(mapInWindow({ createdAt: at("2026-11-25T00:00:00Z"), arrivedVia: "thanks" }, W), true);
  assert.equal(mapInWindow({ createdAt: at("2026-11-24T00:00:00Z"), arrivedVia: "thanks" }, W), false);
});

test("empty window: zeros and 'no data' / 'too early', never a division by zero", () => {
  const s = scoreboard(input({}));
  assert.equal(s.maps.value, 0);
  assert.equal(s.maps.status, "below");
  assert.equal(s.k.value, null);
  assert.equal(s.k.status, "none");
  assert.equal(s.tieBack.value, null);
  assert.equal(s.tieBack.status, "early");
  assert.equal(s.funnel.overall.openPerShare, null);
  assert.equal(s.funnel.overall.openStatus, "none");
  assert.equal(s.lanterns, 0);
  assert.equal(s.countries, 0);
  assert.equal(s.friday.post, "learned");
  assert.equal(s.friday.line, "0 lanterns lit across 0 countries");
  assert.equal(s.hourly.rows.length, 72 + 1);
  assert.ok(s.hourly.rows.every((h) => h.maps === 0 && h.tieBacks === 0));
  const html = renderLaunch(s);
  assert.match(html, /too early/);
  assert.match(html, /from the roster sheet/);
  assert.doesNotMatch(html, /NaN|undefined|Infinity/);
});

test("maps, K, lanterns, countries on a small fixture", () => {
  const maps = [
    map("old", "2026-11-20T10:00:00Z", { entries: lit("London", "London") }), // before the window: an inviter only
    map("a", "2026-11-25T13:30:00Z", { entries: [...lit("Bengaluru", "Kochi", "London"), { city: "Dubai", carried: true }] }),
    map("b", "2026-11-25T14:10:00Z", { invitedByMapId: "old", arrivedVia: "map", entries: lit("Atlantis") }),
    map("c", "2026-11-26T00:00:00Z", { invitedByMapId: "a", arrivedVia: "thanks", entries: lit("Kochi", "Dubai") }),
    map("d", "2026-11-26T02:00:00Z", { invitedByMapId: "a", arrivedVia: "map" }),
    map("seed1", "2026-11-25T14:00:00Z", { arrivedVia: "seed", entries: lit("London", "London", "London") }),
  ];
  const s = scoreboard(input({ maps }));
  assert.equal(s.maps.value, 4);
  assert.equal(s.maps.seedLeftOut, 1);
  assert.equal(s.maps.fromThanks, 1);
  // K = invited / maps = 3 / 4; inviters "old" and "a".
  assert.equal(s.k.value, 0.75);
  assert.equal(s.k.status, "ok");
  assert.equal(s.k.inviters, 2);
  assert.equal(s.k.perInviter, 1.5);
  // Lanterns: a 3 (carried Dubai left out) + b 1 + c 2 + d 1 = 7. Countries: India, UK, UAE (Atlantis unplaced).
  assert.equal(s.lanterns, 7);
  assert.equal(s.countries, 3);
  assert.equal(s.citiesUnplaced, 1);
  assert.equal(s.friday.line, "7 lanterns lit across 3 countries");
  // Hourly: rows start at the IST hour holding 18:30 (18:00 IST); the 19:00 IST hour has a and b; the thank-you map c is date-only.
  assert.equal(s.hourly.rows[0].hour, "2026-11-25T12:30:00.000Z");
  assert.equal(s.hourly.rows[0].maps, 0);
  assert.equal(s.hourly.rows[1].hour, "2026-11-25T13:30:00.000Z");
  assert.equal(s.hourly.rows[1].maps, 2);
  assert.equal(s.hourly.rows[1].lanterns, 4);
  assert.equal(s.hourly.dateOnlyMaps, 1);
  assert.equal(s.hourly.dateOnlyLanterns, 2);
  assert.equal(s.hourly.rows.reduce((a, h) => a + h.maps, 0), 3);
});

test("Friday gate: both bars or nothing", () => {
  const many = (n: number, lanterns: number) =>
    Array.from({ length: n }, (_, i) => map(`m${i}`, "2026-11-26T05:00:00Z", { entries: lit(...Array(lanterns).fill("Bengaluru")) }));
  assert.equal(scoreboard(input({ maps: many(200, 5) })).friday.post, "numbers"); // 200 maps, 1,000 lanterns
  assert.equal(scoreboard(input({ maps: many(199, 6) })).friday.post, "learned"); // 1,194 lanterns but 199 maps
  assert.equal(scoreboard(input({ maps: many(250, 3) })).friday.post, "learned"); // 750 lanterns
  assert.equal(scoreboard(input({ maps: many(200, 5) })).friday.line, "1,000 lanterns lit across 1 country");
});

test("tie-back rate: only links 48 h old count; tied means used within 48 h; under 20 is too early", () => {
  const made = (h: number) => new Date(from.getTime() + h * H);
  const links = [
    ...Array.from({ length: 10 }, (_, i) => ({ createdAt: made(i), usedAt: new Date(made(i).getTime() + 2 * H) })), // tied fast
    ...Array.from({ length: 5 }, (_, i) => ({ createdAt: made(i), usedAt: new Date(made(i).getTime() + 49 * H) })), // tied late
    ...Array.from({ length: 15 }, (_, i) => ({ createdAt: made(i), usedAt: null })),
    { createdAt: made(40), usedAt: made(41) }, // 32 h old at the end: not judged yet
    { createdAt: new Date(from.getTime() - H), usedAt: from }, // before the window
  ];
  const s = scoreboard(input({ links }));
  assert.equal(s.tieBack.links, 31);
  assert.equal(s.tieBack.eligible, 30);
  assert.equal(s.tieBack.tiedIn48h, 10);
  assert.equal(s.tieBack.value, 33);
  assert.equal(s.tieBack.status, "ok");
  assert.equal(s.tieBack.tiedAnyTime, 16);
  // Same links, judged 48 h after the first ones: only those made in the first hour are old enough.
  const early = scoreboard(input({ links, now: new Date(from.getTime() + 48.5 * H) }));
  assert.equal(early.tieBack.eligible, 3);
  assert.equal(early.tieBack.status, "early");
  assert.ok(early.tieBack.eligible < TIE_MIN_LINKS);
  // All links younger than 48 h: nothing to judge.
  const fresh = scoreboard(input({ links: [{ createdAt: from, usedAt: from }], now: new Date(from.getTime() + 10 * H) }));
  assert.equal(fresh.tieBack.eligible, 0);
  assert.equal(fresh.tieBack.value, null);
  assert.equal(fresh.tieBack.status, "early");
  // Below target with enough links.
  const low = scoreboard(input({ links: Array.from({ length: 25 }, () => ({ createdAt: from, usedAt: null })) }));
  assert.equal(low.tieBack.value, 0);
  assert.equal(low.tieBack.status, "below");
});

test("funnel: per channel and overall; zero shares; native has no attributable opens", () => {
  const channels = [
    { channel: "wa", label: "WhatsApp", shares: 100, opens: 40, makeYours: 12 },
    { channel: "li", label: "LinkedIn", shares: 10, opens: 2, makeYours: 1 },
    { channel: "cp", label: "Copied link", shares: 0, opens: 3, makeYours: 0 },
    { channel: "st", label: "Story picture", shares: 0, opens: 0, makeYours: 0 },
    { channel: "native", label: "Share sheet", shares: 40, opens: 0, makeYours: 0 },
  ];
  const s = scoreboard(input({ channels }));
  const by = Object.fromEntries(s.funnel.rows.map((r) => [r.channel, r]));
  assert.equal(by.wa.openPerShare, 40);
  assert.equal(by.wa.openStatus, "ok");
  assert.equal(by.wa.startPerOpen, 30);
  assert.equal(by.wa.startStatus, "ok");
  assert.equal(by.li.openPerShare, 20);
  assert.equal(by.li.openStatus, "below");
  assert.equal(by.cp.openPerShare, null); // opens but no shares: no rate
  assert.equal(by.cp.startPerOpen, 0);
  assert.equal(by.st.openStatus, "none");
  assert.equal(by.native.openPerShare, null);
  assert.equal(by.native.openStatus, "none");
  // Overall: 45 tagged opens / 150 shares (native included) = 30%; 13 / 45 = 29%.
  assert.equal(s.funnel.overall.shares, 150);
  assert.equal(s.funnel.overall.opens, 45);
  assert.equal(s.funnel.overall.openPerShare, 30);
  assert.equal(s.funnel.overall.openStatus, "ok");
  assert.equal(s.funnel.overall.startPerOpen, 29);
});

test("hourly: IST hour buckets, ties counted, the latest 14 days kept on a long window", () => {
  const s = scoreboard(input({
    maps: [map("a", "2026-11-25T13:29:59Z"), map("b", "2026-11-25T13:30:00Z")],
    vouches: [{ createdAt: at("2026-11-25T13:45:00Z") }, { createdAt: at("2026-11-24T13:45:00Z") }],
  }));
  assert.equal(s.hourly.rows[0].hour, "2026-11-25T12:30:00.000Z"); // 18:00 IST
  assert.equal(s.hourly.rows[0].maps, 1);
  assert.equal(s.hourly.rows[1].maps, 1);
  assert.equal(s.hourly.rows[1].tieBacks, 1);
  assert.equal(s.hourly.rows.reduce((a, h) => a + h.tieBacks, 0), 1);
  const long = scoreboard(input({ window: { from: at("2026-10-01T00:00:00Z"), to: NOW, note: null } }));
  assert.equal(long.hourly.rows.length, 24 * 14);
  assert.equal(long.hourly.truncated, true);
  assert.equal(long.hourly.rows.at(-1)!.hour, "2026-11-28T12:30:00.000Z");
});

test("rendering: values, targets, statuses and definitions; a LinkedIn count when the log exists; no names", () => {
  const s = scoreboard(input({
    maps: [map("a", "2026-11-25T13:30:00Z", { entries: lit("Bengaluru", "London") })],
    linkedinPosts: 7,
  }));
  const html = renderLaunch(s);
  for (const t of ["Maps created", "K (new maps per map)", "Tie-back rate", "Share → open", "Open → start map", "LinkedIn posts", "Post what we learned", "2 lanterns lit across 2 countries", "By IST hour"]) {
    assert.ok(html.includes(t), t);
  }
  assert.match(html, /≥ 250/);
  assert.match(html, /≥ 0.5/);
  assert.match(html, /≥ 20%/);
  assert.match(html, /<td class="n"><b>7<\/b>/);
  assert.match(html, /<nav class="adm">.*Launch scoreboard/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /ownerName/);
});
