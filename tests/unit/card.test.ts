import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCardParams, cardModel, CARD_SIZES, cardUrl, CARD_THREAD, cardVersion, cardCache, CARD_CACHE } from "@/lib/card";
import { toPublicMap } from "@/lib/public-map";
import { computeKind } from "@/lib/kinds";

const row = (cities: string[], ownerName = "Ananya", home = "Bengaluru") => ({
  shortSlug: "k7q2x9ab", publicId: "p", homeCity: home, ownerName, kind: null,
  entries: cities.map((city, questionIndex) => ({ city, questionIndex })),
});

test("card params: only id, v, f, dl are read; everything else (a name) is ignored", () => {
  const p = parseCardParams(new URLSearchParams("id=k7q2x9ab&v=mi3k2x1a&f=story&dl=1&name=Meera&n=Meera%20Nair&t=abc"));
  assert.deepEqual(p, { id: "k7q2x9ab", format: "story", download: true, version: "mi3k2x1a" });
  assert.deepEqual(parseCardParams(new URLSearchParams("id=../../etc&f=huge&v=Meera")), { id: null, format: "link", download: false, version: null });
  assert.equal(parseCardParams(new URLSearchParams("id=k7q2x9ab&v=" + "a".repeat(17))).version, null, "an over-long version is dropped");
});

test("card sizes: link preview / LinkedIn 1200x627, Status / Story 1080x1920", () => {
  assert.deepEqual(CARD_SIZES.link, { width: 1200, height: 627 });
  assert.deepEqual(CARD_SIZES.story, { width: 1080, height: 1920 });
});

test("card URLs carry the map id only, on the fixed site address", () => {
  assert.equal(cardUrl("k7q2x9ab"), "https://warmmap.world/api/og?id=k7q2x9ab");
  assert.equal(cardUrl("k7q2x9ab", "story"), "https://warmmap.world/api/og?id=k7q2x9ab&f=story");
  assert.equal(cardUrl(null), "https://warmmap.world/api/og");
  assert.equal(cardUrl("k7q2x9ab", "link", false, "mi3k2x1a"), "https://warmmap.world/api/og?id=k7q2x9ab&v=mi3k2x1a");
  assert.equal(cardUrl("k7q2x9ab", "story", true, "mi3k2x1a"), "https://warmmap.world/api/og?id=k7q2x9ab&v=mi3k2x1a&f=story&dl=1");
  assert.equal(cardUrl(null, "link", false, "mi3k2x1a"), "https://warmmap.world/api/og", "the home card has no version");
});

test("card version: 12 hex characters from the map's id and last change; a later change is a new URL; no readable time", () => {
  const at = new Date("2026-11-25T13:00:00.000Z");
  const a = cardVersion({ id: "cmap1", updatedAt: at });
  const b = cardVersion({ id: "cmap1", updatedAt: new Date(at.getTime() + 1) });
  const c = cardVersion({ id: "cmap2", updatedAt: at });
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  assert.notEqual(a, c, "two maps changed at the same moment still differ");
  assert.equal(a, cardVersion({ id: "cmap1", updatedAt: new Date(at) }), "stable for the same change");
  assert.notEqual(a, at.getTime().toString(36), "not the time itself");
  assert.equal(parseCardParams(new URLSearchParams(`id=k7q2x9ab&v=${a}`)).version, a, "a version we make is one we read back");
});

test("card caching: drawn once per CDN edge when versioned; short for old or missing versions; errors never cached", () => {
  assert.equal(cardCache({ id: null, found: false, asked: null, current: null }), "home");
  assert.equal(cardCache({ id: "k7q2x9ab", found: true, asked: "abc", current: "abc" }), "versioned");
  assert.equal(cardCache({ id: "k7q2x9ab", found: true, asked: null, current: "abc" }), "fallback", "no ?v=: an old link");
  assert.equal(cardCache({ id: "k7q2x9ab", found: true, asked: "old", current: "abc" }), "fallback", "a stale ?v=");
  assert.equal(cardCache({ id: "nosuchmap", found: false, asked: "abc", current: null }), "fallback", "a deleted or unknown map");
  for (const k of ["versioned", "home", "fallback"] as const) {
    assert.match(CARD_CACHE[k], /^public, /);
    assert.match(CARD_CACHE[k], /s-maxage=\d+/);
    assert.match(CARD_CACHE[k], /stale-while-revalidate=\d+/);
  }
  const sMax = (k: keyof typeof CARD_CACHE) => Number(CARD_CACHE[k].match(/s-maxage=(\d+)/)![1]);
  assert.ok(sMax("versioned") <= 3600, "a deleted map's card leaves the CDN within the hour, as before");
  assert.ok(sMax("fallback") <= 60);
  assert.equal(CARD_CACHE.error, "no-store");
  const src = readFileSync("src/app/api/og/route.tsx", "utf8");
  assert.ok(/limited\.headers\.set\("Cache-Control", CARD_CACHE\.error\)/.test(src), "a 429 is never cached");
  assert.ok(/status: 500, headers: noStore/.test(src), "a failed picture is never cached");
});

test("PRIVACY: the card model is cities, numbers and the owner's first name only", () => {
  const m = cardModel(toPublicMap(row(["Kochi", "Mysuru", "Chennai", "Hyderabad", "Bengaluru"])), "link");
  const json = JSON.stringify(m);
  for (const banned of ["questionIndex", "Meera", "token", "entryIndex", "gold"]) assert.ok(!json.includes(banned), banned);
  assert.equal(m.title, "Ananya's Warm Map");
  assert.deepEqual(m.nums.map((n: { label: string }) => n.label), ["people", "cities", "km of thread"]);
  assert.ok(m.globe.labels.every((l: { text: string }) => ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Bengaluru"].includes(l.text)));
});

test("v21a on: the card says lanterns (the server never sees names, so it cannot count people); off: unchanged", () => {
  const pm = toPublicMap(row(["Kochi", "Mysuru", "Chennai", "Hyderabad", "Bengaluru"]));
  assert.equal(cardModel(pm, "link", true).nums[0].label, "lanterns");
  assert.equal(cardModel(pm, "link", true).nums[0].value, "5");
  assert.equal(cardModel(pm, "link", false).nums[0].label, "people");
  assert.equal(cardModel(pm, "link").nums[0].label, "people", "default follows the flag, off here");
  for (const f of ["link", "story"] as const) {
    assert.ok(cardModel(pm, f, true).nums.every((n: { label: string }) => !/people|person/.test(n.label)), `no people count on the flagged ${f} card`);
  }
});

test("kind short lines (shown on the cards)", () => {
  assert.equal(computeKind({ homeCity: "Bengaluru", lanterns: ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Pune"].map((city) => ({ city })) }).short, "5 cities, one light in each.");
  const twelve = ["Kochi", "Bengaluru", "Pune", "Bengaluru", "Delhi", "Delhi", "Hyderabad", "Kolkata", "Bengaluru", "Delhi", "London", "Singapore"];
  assert.equal(computeKind({ homeCity: "Bengaluru", lanterns: twelve.map((city) => ({ city })) }).short, "Two places held together, Bengaluru and Delhi.");
  assert.equal(computeKind({ homeCity: "Pune", lanterns: ["Pune", "Pune", "Pune", "Mumbai", "Nashik"].map((city) => ({ city })) }).short, "3 of 5 lanterns in Pune.");
});

test("long owner names shrink to fit; no owner name falls back to 'A Warm Map'", () => {
  const long = cardModel(toPublicMap(row(["Kochi", "Pune", "Delhi", "Mumbai", "Chennai"], "Venkataramanan Subrahmanya")), "link");
  assert.ok(long.titleSize < 60 && long.titleSize >= 34);
  const none = cardModel(toPublicMap(row(["Kochi", "Pune", "Delhi", "Mumbai", "Chennai"], "")), "link");
  assert.equal(none.title, "A Warm Map");
});

test("the full-map card unlocks at five lanterns (smaller legacy maps get the home card)", () => {
  const four = cardModel(toPublicMap(row(["Kochi", "Pune", "Delhi", "Mumbai"])), "link");
  assert.equal(four.title, "Who's in your corner?");
  assert.deepEqual(four.nums, []);
  const five = cardModel(toPublicMap(row(["Kochi", "Pune", "Delhi", "Mumbai", "Chennai"])), "story");
  assert.equal(five.title, "Ananya's Warm Map");
});

test("PRIVACY: the share card draws no gold (threads are the one shared amber)", () => {
  const GOLD = /f2c230/i;
  assert.ok(!GOLD.test(CARD_THREAD));
  assert.ok(!GOLD.test(readFileSync("src/app/api/og/route.tsx", "utf8")), "og route must not use the gold colour");
  assert.ok(!GOLD.test(readFileSync("src/lib/card.ts", "utf8").replace(/\/\/.*$/gm, "")), "card model must not use the gold colour");
});
