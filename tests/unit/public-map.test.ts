import test from "node:test";
import assert from "node:assert/strict";
import { toPublicMap } from "@/lib/public-map";

const row = {
  id: "ckxyzinternalid",
  shortSlug: "k7q2x9ab",
  publicId: "pubinternal",
  homeCity: "Bengaluru",
  ownerName: "Ananya",
  ownerKeyHash: "deadbeef",
  invitedByMapId: "inviter",
  arrivedVia: "thanks",
  questionSet: 2,
  km: 123,
  kind: "constellation",
  entries: [
    { city: "Pune", questionIndex: 0 },
    { city: "Kochi", questionIndex: 1 },
    { city: "Bengaluru", carried: true },
    { city: "Delhi", questionIndex: 2 },
    { city: "Mumbai", questionIndex: 3 },
    { city: "Chennai", questionIndex: 4 },
  ],
};

test("PRIVACY: cities only; no question, order, carried flag, inviter, key or internal id", () => {
  const p = toPublicMap(row);
  const json = JSON.stringify(p);
  for (const banned of ["questionIndex", "carried", "invitedBy", "inviter", "ownerKeyHash", "deadbeef", "ckxyzinternalid", "pubinternal", "arrivedVia", "thanks", "vouch", "entryIndex"]) {
    assert.ok(!json.includes(banned), `public payload leaks ${banned}: ${json}`);
  }
  assert.deepEqual(p.lanterns, ["Bengaluru", "Chennai", "Delhi", "Kochi", "Mumbai", "Pune"]);
  assert.equal(p.id, "k7q2x9ab");
  assert.equal(p.ownerName, "Ananya");
});

test("PRIVACY: answer order cannot be recovered (same cities, any order, same payload)", () => {
  const shuffled = { ...row, entries: [...row.entries].reverse().map((e, i) => ("questionIndex" in e ? { ...e, questionIndex: 11 - i } : e)) };
  assert.deepEqual(toPublicMap(shuffled), toPublicMap(row));
});

test("stats: lanterns, cities, countries, km", () => {
  const p = toPublicMap(row);
  assert.equal(p.stats.lanterns, 6);
  assert.equal(p.stats.cities, 6);
  assert.equal(p.stats.countries, 1);
  assert.ok(p.stats.km > 1000);
  assert.ok(["constellation", "hearth", "bridge", "voyager", "lantern-keeper", null].includes(p.kind));
});

test("legacy maps: JSON-string entries parse; unknown cities dropped", () => {
  const legacy = { ...row, questionSet: 1, kind: null, km: null, entries: JSON.stringify([{ city: "Pune", questionIndex: 2 }, { city: "Atlantis", questionIndex: 3 }]) };
  const p = toPublicMap(legacy);
  assert.deepEqual(p.lanterns, ["Pune"]);
});

test("stored Lantern-keeper kind is kept publicly, with a name-free because line", () => {
  const p = toPublicMap({ ...row, kind: "lantern-keeper" });
  assert.equal(p.kind, "lantern-keeper");
  assert.equal(p.because, "Because one person answered three or more of your questions.");
});
