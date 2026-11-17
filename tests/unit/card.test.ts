import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCardParams, cardModel, CARD_SIZES, cardUrl, CARD_THREAD } from "@/lib/card";
import { toPublicMap } from "@/lib/public-map";
import { computeKind } from "@/lib/kinds";

const row = (cities: string[], ownerName = "Ananya", home = "Bengaluru") => ({
  shortSlug: "k7q2x9ab", publicId: "p", homeCity: home, ownerName, kind: null,
  entries: cities.map((city, questionIndex) => ({ city, questionIndex })),
});

test("card params: only id, f, dl are read; everything else (a name) is ignored", () => {
  const p = parseCardParams(new URLSearchParams("id=k7q2x9ab&f=story&dl=1&name=Meera&n=Meera%20Nair&t=abc"));
  assert.deepEqual(p, { id: "k7q2x9ab", format: "story", download: true });
  assert.deepEqual(parseCardParams(new URLSearchParams("id=../../etc&f=huge")), { id: null, format: "link", download: false });
});

test("card sizes: link preview / LinkedIn 1200x627, Status / Story 1080x1920", () => {
  assert.deepEqual(CARD_SIZES.link, { width: 1200, height: 627 });
  assert.deepEqual(CARD_SIZES.story, { width: 1080, height: 1920 });
});

test("card URLs carry the map id only, on the fixed site address", () => {
  assert.equal(cardUrl("k7q2x9ab"), "https://warmmap.world/api/og?id=k7q2x9ab");
  assert.equal(cardUrl("k7q2x9ab", "story"), "https://warmmap.world/api/og?id=k7q2x9ab&f=story");
  assert.equal(cardUrl(null), "https://warmmap.world/api/og");
});

test("PRIVACY: the card model is cities, numbers and the owner's first name only", () => {
  const m = cardModel(toPublicMap(row(["Kochi", "Mysuru", "Chennai", "Hyderabad", "Bengaluru"])), "link");
  const json = JSON.stringify(m);
  for (const banned of ["questionIndex", "Meera", "token", "entryIndex", "gold"]) assert.ok(!json.includes(banned), banned);
  assert.equal(m.title, "Ananya's Warm Map");
  assert.deepEqual(m.nums.map((n: { label: string }) => n.label), ["people", "cities", "km of thread"]);
  assert.ok(m.globe.labels.every((l: { text: string }) => ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Bengaluru"].includes(l.text)));
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
