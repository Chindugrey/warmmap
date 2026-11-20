// Verifier tests for the places / districts lane. The first test pins a guard the lane's own tests leave
// open; the rest fail on 66f02fa and say what a user sees.
import test from "node:test";
import assert from "node:assert/strict";
import { searchCities } from "@/lib/cities-full";
import { DISTRICTS_TSV } from "@/lib/districts-data";

const top = (q: string, n = 6) => searchCities(q, n).results.map((r) => r.name);

test("a town comes before its district on a shared prefix (districts load after every city)", () => {
  // Towns from the full list (the curated ones come first anyway).
  assert.deepEqual(top("Rayag", 2), ["Rayagada", "Rayagada district, Odisha"]);
  assert.deepEqual(top("Bhagal", 2), ["Bhagalpur", "Bhagalpur district, Bihar"]);
  assert.equal(searchCities("Tumku", 4).match, "Tumkur");
});

test("two slips in a long name are still found, as on main (Kasargode, Bengalooru, Hydrebad)", () => {
  for (const [q, want] of [["Kasargode", "Kasaragod"], ["Bengalooru", "Bengaluru"], ["Hydrebad", "Hyderabad"], ["Vishakhapatanam", "Visakhapatnam"], ["Thiruvanthapuram", "Thiruvananthapuram"], ["Guruvayoor", "Guruvayur"]]) {
    assert.equal(top(q)[0], want, q);
  }
});

test("typing Kasargod and tapping Light it lights Kasaragod (the reported case)", () => {
  assert.equal(searchCities("Kasargod", 4).match, "Kasaragod");
});

test("a census division never takes the auto-pick away from the town of the same name", () => {
  for (const q of ["Yellowknife", "Whitehorse", "Carson City", "Laval", "Greater Sudbury", "Montreal", "Ottawa"]) {
    assert.equal(searchCities(q, 4).match, q, q);
  }
});

test("the city the API picks is always one of the suggestions it returns (else the client cannot use it)", () => {
  const lost: string[] = [];
  for (const line of DISTRICTS_TSV.split("\n")) {
    const key = line.split("\t")[0];
    const r = searchCities(key, 4);
    if (r.match && !r.results.some((x) => x.name === r.match)) lost.push(key);
  }
  assert.deepEqual(lost.slice(0, 5), [], `${lost.length} places cannot be picked by typing their full name`);
});

test("Prayagraj finds the city, not only its district", () => {
  assert.equal(top("Prayagraj")[0], "Allahabad");
});
