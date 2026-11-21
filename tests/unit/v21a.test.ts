import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "@/lib/questions";
import { POST_LINES, SUBLINES, V21A, KIT_COPY, cleanWish, distinctPeople, nameKey, revealPeople, joinNames, linkedInPost, tagRows, type Friend } from "@/lib/v21a";

const friends: Friend[] = [
  { q: 0, name: "Meera", city: "Kochi" },
  { q: 2, name: "Meera", city: "Kochi" },
  { q: 3, name: "Kabir", city: "Delhi" },
  { q: 7, name: "Tara", city: "London" },
];
const base = { friends, cities: 3, wish: [] as string[], url: "https://warmmap.world/m/abc?s=li" };

test("flag is OFF unless NEXT_PUBLIC_WM_V21A=1", () => {
  assert.equal(process.env.NEXT_PUBLIC_WM_V21A, undefined);
  assert.equal(V21A, false);
});

test("one sub-line and one post line per locked question; the plan's copy", () => {
  assert.equal(SUBLINES.length, QUESTIONS.length);
  assert.equal(POST_LINES.length, QUESTIONS.length);
  assert.equal(SUBLINES[0], "The one who'd pick up, and not ask why until you're okay.");
  assert.equal(SUBLINES[7], "The thank-you you keep meaning to send.");
  for (const l of POST_LINES) assert.match(l, /\{n\}/);
  assert.equal(KIT_COPY.consent, "Named people will be tagged publicly; tag only people who'd be happy to be thanked in public.");
});

test("names out (the default): the post carries no friend's name", () => {
  const t = linkedInPost({ ...base, names: false });
  assert.match(t, /3 people who've had my back, across 3 cities\. You know who you are\. Thank you\./);
  for (const f of friends) assert.ok(!t.includes(f.name), `${f.name} leaked`);
  assert.ok(t.endsWith("Who's in your corner? https://warmmap.world/m/abc?s=li"));
});

test("by name: names without '@', joined per question", () => {
  const t = linkedInPost({ ...base, names: true });
  assert.match(t, /Meera would get my 2am call\./);
  assert.match(t, /Tara: I haven't thanked you properly yet\. Thank you\./);
  assert.ok(!t.includes("@"));
  const two = linkedInPost({ ...base, names: true, friends: [{ q: 6, name: "A", city: "X" }, { q: 6, name: "B", city: "X" }] });
  assert.match(two, /I'd start something with A and B tomorrow\./);
});

test("the 2027 line appears only when there is a wish", () => {
  assert.ok(!linkedInPost({ ...base, names: false }).includes("2027"));
  const t = linkedInPost({ ...base, names: false, wish: ["a Head of Design at a fintech", "Zomato"] });
  assert.match(t, /In 2027 I'd love a warm intro to a Head of Design at a fintech and Zomato\./);
});

test("counting and joining", () => {
  assert.equal(distinctPeople(friends), 3);
  assert.equal(distinctPeople([{ q: 0, name: "Meera", city: "a" }, { q: 1, name: " meera ", city: "a" }]), 1);
  assert.equal(joinNames(["A", "B", "C"]), "A, B and C");
  assert.equal(tagRows(friends).map((r) => r.name).join(","), "Meera,Kabir,Tara");
  assert.match(linkedInPost({ ...base, names: false, friends: [friends[0]], cities: 1 }), /1 person who's had my back, across 1 city\./);
});

test("wish entries: trimmed, 3 to 60 characters", () => {
  assert.equal(cleanWish("  a   role "), "a role");
  assert.equal(cleanWish("ab"), null);
  assert.equal(cleanWish("x".repeat(80))?.length, 60);
});

test("reveal people: duplicate names in any case or spacing count once (flag on)", () => {
  const names = ["Meera", " meera ", "MEERA", "Kabir", "Tara\t"];
  assert.deepEqual(revealPeople(names, 5, true), { n: 3, label: "people" });
  assert.deepEqual(revealPeople(["Meera", "meera "], 2, true), { n: 1, label: "person" });
  assert.equal(revealPeople(names, 5, true).n, distinctPeople(names.map((name) => ({ q: 0, name, city: "" }))));
});

test("reveal people: flag off is the lantern count, exactly as at launch", () => {
  assert.deepEqual(revealPeople(["Meera", " meera ", "MEERA", "Kabir", "Tara"], 5, false), { n: 5, label: "people" });
  assert.deepEqual(revealPeople(["Meera"], 1, false), { n: 1, label: "person" });
  assert.equal(revealPeople(["Meera", "meera"], 2).n, 2, "default follows the flag, which is off here");
});

test("name key: NFC, zero-width, double space, trim, case; no accent folding", () => {
  assert.equal(nameKey("Ren\u00e9"), nameKey("Rene\u0301"), "composed and decomposed e-acute are one name");
  assert.equal(nameKey("Me\u200Bera"), nameKey("Meera"), "a zero-width space is ignored");
  assert.equal(nameKey("Meera\uFEFF"), "meera");
  assert.equal(nameKey("Meera  Rao"), nameKey(" meera rao "), "a double space collapses");
  assert.notEqual(nameKey("Rene"), nameKey("Ren\u00e9"), "no accent folding");
  const f = (name: string): Friend => ({ q: 0, name, city: "x" });
  assert.equal(distinctPeople([f("Ren\u00e9"), f("Rene\u0301"), f("Rene"), f("Me\u200Bera"), f("meera")]), 3);
  assert.equal(tagRows([f("Ren\u00e9"), f("Rene\u0301")]).length, 1, "the tag checklist uses the same key");
});

test("reveal people: a kept inviter counts once, even when also typed in another case", () => {
  assert.equal(revealPeople(["Inviter", "A", "B", "C", "D", "E"], 6, true).n, 6);
  assert.equal(revealPeople(["Inviter", "  INVITER", "B", "C", "D", "E"], 6, true).n, 5);
});

test("post people: the reveal's number wins, so reveal and post always match", () => {
  const t = linkedInPost({ ...base, names: false, people: 6 });
  assert.match(t, /6 people who've had my back/);
  assert.match(linkedInPost({ ...base, names: false, people: 1 }), /1 person who's had my back/);
  assert.match(linkedInPost({ ...base, names: false }), /3 people who've had my back/, "no number given: the distinct friends");
});
