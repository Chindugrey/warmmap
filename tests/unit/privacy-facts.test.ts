import test from "node:test";
import assert from "node:assert/strict";
import { PRIVACY_FACTS, privacyCopy, type PrivacyFacts } from "@/lib/privacy-facts";

const full: PrivacyFacts = {
  controllerName: "Example Pvt Ltd", controllerAddress: "1 Example Road, Bengaluru, India", contactEmail: "privacy@example.com",
  hostingRegion: "Mumbai, India", databaseRegion: "Frankfurt, Germany", transferMechanism: "standard contractual clauses",
  supervisoryAuthority: "the Data Protection Board of India", minimumAge: 16, analyticsRetention: "25 months",
};
const none: PrivacyFacts = { ...PRIVACY_FACTS, controllerName: null, controllerAddress: null, hostingRegion: null, databaseRegion: null, transferMechanism: null, supervisoryAuthority: null, minimumAge: null, analyticsRetention: null };

test("no bracket in any sentence, whatever is filled in", () => {
  const variants: PrivacyFacts[] = [none, full, { ...none, hostingRegion: "Mumbai, India" }, { ...none, databaseRegion: "Frankfurt" }, { ...none, controllerName: "X" }];
  for (const f of [PRIVACY_FACTS, ...variants]) for (const [k, v] of Object.entries(privacyCopy(f))) assert.doesNotMatch(v, /[[\]]/, k);
});

test("the shipped facts are valid (and null facts do not invent anything)", () => {
  const c = privacyCopy(none);
  assert.match(c.who, /small project from the people at Zeyhi/);
  assert.doesNotMatch(JSON.stringify(c), /undefined|null/);
  assert.doesNotMatch(c.where, /Mumbai|Frankfurt|United States|\bUS\b/);
});

test("filled facts appear in the copy", () => {
  const c = privacyCopy(full);
  assert.match(c.who, /Example Pvt Ltd, 1 Example Road/);
  assert.match(c.where, /Mumbai, India.*Frankfurt, Germany/);
  assert.match(c.safeguards, /standard contractual clauses/);
  assert.match(c.counts, /25 months/);
  assert.match(c.complaint, /Data Protection Board of India/);
  assert.match(c.children, /under 16/);
});
