import test from "node:test";
import assert from "node:assert/strict";
import { computeKind } from "@/lib/kinds";

const L = (...cities: string[]) => cities.map((city) => ({ city }));

test("Hearth: 60% or more of lanterns in the home city", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Bengaluru", "Bengaluru", "Bengaluru", "Mysuru", "Chennai"), repeatMax: 1 });
  assert.equal(r.kind, "hearth");
  assert.equal(r.because, "Because 3 of your 5 lanterns are in Bengaluru.");
});

test("Bridge: two groups of 3+ at least 1,000 km apart", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Bengaluru", "Mysuru", "Chennai", "Delhi", "Gurugram", "Noida"), repeatMax: 1 });
  assert.equal(r.kind, "bridge");
  assert.match(r.because!, /^Because 3 lanterns sit around .+ and 3 around .+, [\d,]+ km apart\.$/);
});

test("Voyager: three or more countries", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Dubai", "Singapore", "Pune", "Kochi", "Delhi"), repeatMax: 1 });
  assert.equal(r.kind, "voyager");
  assert.equal(r.because, "Because your lanterns reach 3 countries.");
});

test("Voyager: one lantern over 5,000 km away", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Toronto", "Pune", "Kochi", "Delhi", "Chennai"), repeatMax: 1 });
  assert.equal(r.kind, "voyager");
  assert.match(r.because!, /^Because your furthest lantern is in Toronto, [\d,]+ km away\.$/);
});

test("Constellation: five or more cities, none dominant", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Pune", "Kochi", "Delhi", "Chennai", "Mumbai"), repeatMax: 1 });
  assert.equal(r.kind, "constellation");
  assert.equal(r.because, "Because your lanterns are spread across 5 cities.");
});

test("Lantern-keeper: one person answers three or more questions", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Pune", "Pune", "Kochi", "Kochi", "Mumbai"), repeatMax: 3 });
  assert.equal(r.kind, "lantern-keeper");
  assert.equal(r.because, "Because one person answered 3 of your questions.");
});

test("no rule fires: default to Constellation, never no label (Aadarsh, 14 Nov)", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Pune", "Pune", "Kochi", "Kochi", "Mumbai"), repeatMax: 1 });
  assert.equal(r.kind, "constellation");
  assert.equal(r.because, "Because your lanterns are spread across 3 cities.");
  assert.equal(r.short, "3 cities, scattered like stars.");
});

test("default Constellation reads right with one city, and with no known city", () => {
  const one = computeKind({ homeCity: "Bengaluru", lanterns: L("Kochi", "Kochi", "Kochi", "Kochi", "Kochi"), repeatMax: 1 });
  assert.equal(one.kind, "constellation");
  assert.equal(one.because, "Because all your lanterns glow in Kochi.");
  assert.equal(one.short, "Every light in Kochi.");
  const none = computeKind({ homeCity: "Bengaluru", lanterns: L("Atlantis"), repeatMax: 1 });
  assert.equal(none.kind, "constellation");
  assert.equal(none.because, null);
});

test("kind is never based on how many people (a 12-lantern Hearth is still a Hearth)", () => {
  const r = computeKind({ homeCity: "Pune", lanterns: L(...Array(9).fill("Pune"), "Mumbai", "Nashik", "Kochi"), repeatMax: 1 });
  assert.equal(r.kind, "hearth");
});

test("unknown (legacy) cities are ignored, not fatal", () => {
  const r = computeKind({ homeCity: "Bengaluru", lanterns: L("Atlantis", "Bengaluru", "Bengaluru", "Bengaluru"), repeatMax: 1 });
  assert.equal(r.kind, "hearth");
});
