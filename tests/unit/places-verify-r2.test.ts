// Verifier round 2: pins for guards no other test kills (each fails under the named mutant).
import test from "node:test";
import assert from "node:assert/strict";
import { searchCities } from "@/lib/cities-full";

const top = (q: string, n = 6) => searchCities(q, n).results.map((r) => r.name);

test("two slips may be two swaps in a long name (Bnegaluur): the Damerau step of twoEdits", () => {
  assert.equal(top("Bnegaluur")[0], "Bengaluru");
});

test("one slip may be the first letter (Xhennai, Numbai): the first-two-letters prefilter is not too strict", () => {
  assert.equal(top("Xhennai")[0], "Chennai");
  assert.equal(top("Numbai")[0], "Mumbai");
});

test("after a comma, a half-typed name is suggested but never picked", () => {
  const r = searchCities("Frankl, Ohio", 4);
  assert.equal(r.results[0]?.name, "Franklin County, Ohio");
  assert.equal(r.match, null);
  const s = searchCities("Springf, Illinois", 4);
  assert.equal(s.results[0]?.name, "Springfield, IL");
  assert.equal(s.match, null, "a half-typed town is not picked either");
  assert.equal(searchCities("Springfield, Illinois", 4).match, "Springfield, IL");
});
