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

test("India clusters: no two lanterns closer than the minimum, all inside the rim, none on the home light", async () => {
  const { MIN_SEPARATION } = await import("@/lib/globe-layout");
  const maps: [string, string[]][] = [
    ["Bengaluru", ["Kochi", "Bengaluru", "Pune", "Bengaluru", "Delhi", "Delhi", "Hyderabad", "Kolkata", "Bengaluru", "Delhi", "London", "Singapore"]],
    ["Mumbai", ["Pune", "Pune", "Nashik", "Surat", "Mumbai", "Mumbai", "Ahmedabad", "Pune"]],
    ["Delhi", ["Delhi", "Gurugram", "Noida", "Delhi", "Delhi", "Jaipur", "Chandigarh", "Agra", "Lucknow"]],
  ];
  for (const [home, cities] of maps) {
    const { points } = layoutGlobe(home, cities);
    for (let i = 0; i < points.length; i++) {
      assert.ok(dist(points[i]) <= GLOBE_R + 0.2 && dist(points[i]) >= 21.5, `${home}: ${points[i].city} at ${dist(points[i])}`);
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        assert.ok(d >= MIN_SEPARATION - 1, `${home}: ${points[i].city}/${points[j].city} only ${d.toFixed(1)} apart`);
      }
    }
  }
});

test("globe labels: inside the picture, off each other, off the lanterns, even in the Kerala / Karnataka cluster", async () => {
  const { placeLabels, labelBox, labelWidth } = await import("@/lib/globe-layout");
  const cluster = ["Kochi", "Kozhikode", "Mysuru", "Mangaluru", "Thiruvananthapuram", "Coimbatore", "Kannur", "Thrissur", "Delhi", "London"];
  for (const home of ["Bengaluru", "Kochi", "Kasaragod"]) {
    for (const scale of [1, 1.4]) {
      const { points } = layoutGlobe(home, cluster);
      const { labels, fontSize } = placeLabels({ points, want: () => true, scale, homeLabel: home });
      assert.ok(labels.length >= 4, `${home}/${scale}: only ${labels.length} labels placed`);
      const boxes = labels.map((l) => ({ t: l.text, ...labelBox(l, fontSize) }));
      for (const b of boxes) {
        assert.ok(b.x >= 0 && b.x + b.w <= 600 && b.y >= 0 && b.y + b.h <= 600, `${home}/${scale}: ${b.t} outside ${JSON.stringify(b)}`);
      }
      const hw = labelWidth(home, fontSize);
      const homeBox = { t: home, x: CENTER - hw / 2, y: CENTER + 36 - fontSize * 0.8, w: hw, h: fontSize };
      const all = [...boxes, homeBox];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${home}/${scale}: ${a.t} overlaps ${b.t}`);
        }
    }
  }
});

test("globe labels: a wanted label that fits stays inside the sphere, and a far-east lantern flips its label inward", async () => {
  const { placeLabels, labelBox, SPHERE_R } = await import("@/lib/globe-layout");
  const { points } = layoutGlobe("Bengaluru", ["Kozhikode", "Auckland", "Vancouver"]);
  const { labels, fontSize } = placeLabels({ points, want: () => true, scale: 1.4 });
  for (const l of labels) {
    const b = labelBox(l, fontSize);
    for (const [px, py] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      assert.ok(Math.hypot(px - CENTER, py - CENTER) <= SPHERE_R + 12, `${l.text} pokes out of the globe`);
    }
  }
});
