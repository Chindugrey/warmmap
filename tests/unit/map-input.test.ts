import test from "node:test";
import assert from "node:assert/strict";
import { parseSaveInput, parsePatchInput } from "@/lib/map-input";

const five = [
  { city: "Kochi", questionIndex: 0 },
  { city: "Pune", questionIndex: 1 },
  { city: "Delhi", questionIndex: 2 },
  { city: "Mumbai", questionIndex: 3 },
  { city: "Chennai", questionIndex: 4 },
];
const base = { homeCity: "Bengaluru", ownerName: "  Ananya ", entries: five };

test("accepts five answered questions and trims the owner name", () => {
  const r = parseSaveInput(base);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.ownerName, "Ananya");
    assert.equal(r.value.via, "cold");
    assert.equal(r.value.entries.length, 5);
  }
});

test("needs five answered questions to save (Show me comes after the fifth)", () => {
  assert.equal(parseSaveInput({ ...base, entries: five.slice(0, 4) }).ok, false);
});

test("new maps have eight questions; index 0..7; no repeats", () => {
  assert.equal(parseSaveInput({ ...base, entries: [...five, { city: "Pune", questionIndex: 7 }] }).ok, true);
  assert.equal(parseSaveInput({ ...base, entries: [...five, { city: "Pune", questionIndex: 8 }] }).ok, false);
  assert.equal(parseSaveInput({ ...base, entries: [...five, { city: "Pune", questionIndex: 12 }] }).ok, false);
  assert.equal(parseSaveInput({ ...base, entries: [...five, { city: "Pune", questionIndex: 4 }] }).ok, false);
});

test("cities must come from the built-in list", () => {
  assert.equal(parseSaveInput({ ...base, entries: [...five.slice(0, 4), { city: "<script>", questionIndex: 4 }] }).ok, false);
  assert.equal(parseSaveInput({ ...base, homeCity: "Atlantis" }).ok, false);
});

test("PRIVACY: an entry carrying a friend's name is rejected, not stored", () => {
  const withName = five.map((e, i) => (i === 0 ? { ...e, name: "Meera" } : e));
  assert.equal(parseSaveInput({ ...base, entries: withName }).ok, false);
  assert.equal(parseSaveInput({ ...base, friendNames: ["Meera"] }).ok, false);
});

test("owner name is required, 1..24 characters, no control characters", () => {
  assert.equal(parseSaveInput({ ...base, ownerName: "" }).ok, false);
  assert.equal(parseSaveInput({ ...base, ownerName: "x".repeat(25) }).ok, false);
  const r = parseSaveInput({ ...base, ownerName: "An\u0000anya" });
  assert.equal(r.ok, false);
});

test("carried lantern: needs invitedBy, at most one, does not count toward the five", () => {
  const carried = { city: "Bengaluru", carried: true };
  assert.equal(parseSaveInput({ ...base, entries: [carried, ...five] }).ok, false);
  const ok = parseSaveInput({ ...base, entries: [carried, ...five], invitedBy: "abcd1234", via: "thanks" });
  assert.equal(ok.ok, true);
  assert.equal(parseSaveInput({ ...base, entries: [carried, ...five.slice(0, 4)], invitedBy: "abcd1234" }).ok, false);
  assert.equal(parseSaveInput({ ...base, entries: [carried, carried, ...five], invitedBy: "abcd1234" }).ok, false);
});

test("repeatMax is a bare number (no names) and cannot exceed the answers", () => {
  assert.equal(parseSaveInput({ ...base, repeatMax: 3 }).ok, true);
  assert.equal(parseSaveInput({ ...base, repeatMax: 6 }).ok, false);
});

test("via is one of cold, map, thanks, seed", () => {
  assert.equal(parseSaveInput({ ...base, via: "linkedin" }).ok, false);
});

test("patch: same entry rules; carried only when the map was brought in", () => {
  const carried = { city: "Bengaluru", carried: true };
  assert.equal(parsePatchInput({ entries: [carried, ...five] }, { hasInviter: false }).ok, false);
  assert.equal(parsePatchInput({ entries: [carried, ...five] }, { hasInviter: true }).ok, true);
  assert.equal(parsePatchInput({ ownerName: "Ana" }, { hasInviter: false }).ok, true);
});

test("editing a preview map (set 2) still accepts its question indices up to 11", () => {
  const es = [...five, { city: "Pune", questionIndex: 11 }];
  assert.equal(parsePatchInput({ entries: es }, { hasInviter: false, questionCount: 12 }).ok, true);
  assert.equal(parsePatchInput({ entries: es }, { hasInviter: false, questionCount: 8 }).ok, false);
  assert.equal(parsePatchInput({ entries: five }, { hasInviter: false }).ok, true, "default is the current set");
});
