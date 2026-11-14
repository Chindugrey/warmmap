import test from "node:test";
import assert from "node:assert/strict";
import { layoutGlobe, GLOBE_R, CENTER } from "@/lib/globe-layout";
import { rewardLine } from "@/lib/reward";
import { compareKm, ROUTES } from "@/lib/compare";
import { nextQuestion, THANK_ORDER, thankMessage, mapShareText } from "@/lib/flow";
import { haversineKm } from "@/lib/geo";
import { citiesByName } from "@/lib/cities";

const dist = (p: { x: number; y: number }) => Math.hypot(p.x - CENTER, p.y - CENTER);

test("globe auto-scales: the furthest lantern sits on the rim, nearer ones inside", () => {
  const india = layoutGlobe("Bengaluru", ["Mysuru", "Chennai", "Kochi", "Hyderabad"]);
  const far = Math.max(...india.points.map(dist));
  assert.ok(Math.abs(far - GLOBE_R) < 0.6, `furthest at ${far}, want ${GLOBE_R}`);
  const mysuru = india.points.find((p) => p.city === "Mysuru")!;
  assert.ok(dist(mysuru) < GLOBE_R * 0.8 && dist(mysuru) >= GLOBE_R * 0.2 - 0.01);
  // A five-lantern India map is not squeezed into the middle: Hyderabad (the furthest) is on the rim.
  assert.equal(india.points.find((p) => Math.abs(dist(p) - GLOBE_R) < 0.6)!.city, "Hyderabad");
});

test("globe: home-city lanterns and repeats get their own spot", () => {
  const l = layoutGlobe("Pune", ["Pune", "Pune", "Mumbai", "Mumbai"]);
  const keys = new Set(l.points.map((p) => `${p.x},${p.y}`));
  assert.equal(keys.size, 4);
  for (const p of l.points.filter((p) => p.city === "Pune")) assert.ok(dist(p) > 15 && dist(p) < 50);
});

test("reward lines follow the design doc", () => {
  const base = { homeCity: "Bengaluru", prevCities: [] as string[], prevNames: [] as string[] };
  assert.equal(rewardLine({ ...base, count: 1, questionIndex: 0, city: "Kochi", name: "Meera" }), "There. That's your first light.");
  assert.equal(rewardLine({ ...base, count: 2, questionIndex: 0, city: "Kochi", name: "Meera" }), "Some people are worth waking up.");
  assert.equal(rewardLine({ ...base, count: 2, questionIndex: 3, city: "Kochi", name: "Meera", prevNames: ["meera"] }), "Meera again. Some people hold a lot of your sky.");
  assert.equal(rewardLine({ ...base, count: 3, questionIndex: 4, city: "Kochi", name: "Ravi" }), "Every story has someone who said yes first.");
  assert.equal(rewardLine({ ...base, count: 5, questionIndex: 7, city: "Kochi", name: "Ravi" }), "Five lanterns. Your map is ready when you are.");
  assert.equal(rewardLine({ ...base, count: 6, questionIndex: 7, city: "Kochi", name: "Ravi" }), "Six people. Most people never write this down.");
  assert.equal(rewardLine({ ...base, count: 3, questionIndex: 7, city: "London", name: "Sam" }), "Your map just crossed a border.");
  assert.equal(rewardLine({ ...base, count: 3, questionIndex: 7, city: "Bengaluru", name: "Sam" }), "Close enough to show up in twenty minutes.");
  assert.match(rewardLine({ ...base, count: 3, questionIndex: 7, city: "Delhi", name: "Sam" }), /^[\d,]+ km of thread\. Worth every kilometre\.$/);
  assert.equal(rewardLine({ ...base, count: 3, questionIndex: 7, city: "Delhi", name: "Sam", skipped: true }), "That's fine. Not every lantern is ready yet.");
});

test("distance comparisons are computed from the city list, never typed in", () => {
  for (const r of ROUTES) {
    const a = citiesByName[r.from]!, b = citiesByName[r.to]!;
    assert.equal(r.km, Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon) * (r.roundTrip ? 2 : 1)));
  }
  assert.equal(compareKm(100), null);
  const mid = compareKm(1200)!;
  assert.match(mid.short, /^further than /);
  const big = compareKm(50000)!;
  assert.ok(big.long.length > 0);
});

test("question order: next unanswered, then skipped ones, then done", () => {
  assert.equal(nextQuestion(new Set([0]), new Set(), 0), 1);
  assert.equal(nextQuestion(new Set([0, 1]), new Set([2]), 1), 3);
  const all = new Set(Array.from({ length: 11 }, (_, i) => i));
  assert.equal(nextQuestion(all, new Set(), 10), 11);
  assert.equal(nextQuestion(new Set([...all, 11].filter((i) => i !== 2)), new Set([2]), 11), 2, "skipped comes back at the end");
  assert.equal(nextQuestion(new Set(Array.from({ length: 12 }, (_, i) => i)), new Set(), 11), null);
});

test("thank-yous: question 12 first, then 1, 5, 3, 2; message does not spoil the question", () => {
  assert.deepEqual(THANK_ORDER.slice(0, 5), [11, 0, 4, 2, 1]);
  assert.equal(THANK_ORDER.length, 12);
  const m = thankMessage("Meera", "https://warmmap.world/t/abc#Meera");
  assert.ok(m.startsWith("Meera, "));
  assert.ok(!/2am|call/i.test(m));
  assert.ok(m.endsWith("https://warmmap.world/t/abc#Meera"));
  assert.equal(
    mapShareText(5, "https://warmmap.world/m/k7q2x9ab"),
    "Made my Warm Map: the people who've had my back, across 5 cities. Who's in your corner? https://warmmap.world/m/k7q2x9ab"
  );
});
