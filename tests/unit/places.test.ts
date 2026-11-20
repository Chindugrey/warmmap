import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex, citiesByName, matchCities, rank, type City } from "@/lib/cities";
import { searchCities } from "@/lib/cities-full";
import { parseSaveInput } from "@/lib/map-input";
import { toPublicMap } from "@/lib/public-map";
import { mapStats } from "@/lib/geo";

const top = (q: string, n = 6) => searchCities(q, n).results.map((r) => r.name);

test("spelling variants find the town people mean", () => {
  assert.equal(top("Kasargod")[0], "Kasaragod");
  assert.equal(top("Calicut")[0], "Kozhikode");
  assert.equal(top("Trivandrum")[0], "Thiruvananthapuram");
  assert.equal(top("Bangalore")[0], "Bengaluru");
  for (const [q, want] of [["Bombay", "Mumbai"], ["Madras", "Chennai"], ["Poona", "Pune"], ["Cochin", "Kochi"], ["Benares", "Varanasi"], ["Pondicherry", "Puducherry"], ["Vizag", "Visakhapatnam"], ["Simla", "Shimla"], ["Cawnpore", "Kanpur"]]) {
    assert.equal(top(q)[0], want, q);
  }
});

test("one slip (insert, delete, substitute, transpose) still finds it, from 5 letters", () => {
  for (const q of ["Kozhikdoe", "Mumbi", "Chenai", "Kochhi", "Kozhikoda"]) assert.ok(top(q).length > 0, q);
  assert.equal(top("Chenai")[0], "Chennai");
  assert.equal(top("Kozhikdoe")[0], "Kozhikode");
  assert.equal(top("Hydrabad")[0], "Hyderabad");
});

test("short queries (under 5 letters) get no fuzzy matches", () => {
  const ix = buildIndex([{ name: "Kasera", country: "India", lat: 1, lon: 1 }, { name: "Mumbai", country: "India", lat: 1, lon: 1 }].map((city) => ({ city })));
  for (const c of [{ name: "Kasera", country: "India", lat: 1, lon: 1 }, { name: "Mumbai", country: "India", lat: 1, lon: 1 }] as City[]) citiesByName[c.name] ??= c;
  assert.deepEqual(rank("Kasa", undefined, ix).names, []);
  assert.deepEqual(rank("Kase", undefined, ix).names, ["Kasera"], "a plain prefix is still a match");
  assert.deepEqual(rank("Mumb", undefined, ix).names, ["Mumbai"]);
  assert.deepEqual(rank("Muba", undefined, ix).names, [], "a swap in 4 letters is not guessed");
  assert.deepEqual(matchCities("Kasa", 10).filter((n) => !n.toLowerCase().startsWith("kasa")), []);
});

test("an exact or prefix hit ranks above a 1-edit hit, whatever the list order", () => {
  const list: City[] = [
    { name: "Kasera Town", country: "India", lat: 1, lon: 1 },
    { name: "Kasaragod", country: "India", lat: 2, lon: 2 },
  ];
  for (const c of list) citiesByName[c.name] ??= c;
  const ix = buildIndex(list.map((city) => ({ city })));
  assert.deepEqual(rank("Kasara", undefined, ix).names, ["Kasaragod", "Kasera Town"]);
});

test("an alternate-name hit ranks below a primary-name hit", () => {
  const list: City[] = [
    { name: "Alpha", country: "X", lat: 1, lon: 1 },
    { name: "Betaville", country: "X", lat: 2, lon: 2 },
  ];
  for (const c of list) citiesByName[c.name] ??= c;
  const ix = buildIndex([{ city: list[0], alts: ["betafield"] }, { city: list[1] }]);
  assert.deepEqual(rank("beta", undefined, ix).names, ["Betaville", "Alpha"]);
  assert.deepEqual(rank("betafield", undefined, ix).names, ["Alpha"]);
});

test("the town ranks above its fuzzy neighbours", () => {
  assert.equal(top("Kasaragod")[0], "Kasaragod");
  assert.ok(!top("Kannur").includes("Kanpur"));
});

test("a district is a place of its own: Kasaragod district, Kerala", () => {
  const r = searchCities("Kasaragod", 6);
  assert.deepEqual(r.results.slice(0, 2).map((x) => x.label), ["Kasaragod", "Kasaragod district, Kerala"]);
  assert.equal(r.match, "Kasaragod", "the plain name is still the town");
  const d = citiesByName["Kasaragod district, Kerala"];
  assert.ok(d);
  assert.equal(d.country, "India");
  assert.equal(d.region, "Kerala");
  assert.ok(Number.isFinite(d.lat) && Number.isFinite(d.lon));
  assert.equal(searchCities("Kasaragod district, Kerala").match, "Kasaragod district, Kerala");
  assert.equal(searchCities("kasaragod district").results[0].name, "Kasaragod district, Kerala");
});

test("every Indian district is there (incl. a name the town list lacks); the district never replaces the town", () => {
  for (const n of ["Wayanad district, Kerala", "Thiruvananthapuram district, Kerala", "Kozhikode district, Kerala"]) assert.ok(citiesByName[n], n);
  assert.equal(citiesByName["Kozhikode"].region, "Kerala");
  assert.ok(Object.keys(citiesByName).filter((n) => / district, /.test(n) && citiesByName[n].country === "India").length >= 650);
});

test("a US county and a Canadian division are picks too", () => {
  const t = searchCities("Travis County", 4);
  assert.equal(t.results[0].name, "Travis County, Texas");
  assert.equal(t.match, "Travis County, Texas");
  assert.equal(citiesByName["Travis County, Texas"].country, "USA");
  assert.equal(citiesByName["Travis County, Texas"].region, "Texas");
  assert.ok(Object.keys(citiesByName).filter((n) => citiesByName[n].country === "USA" && /(County|Parish|Borough|Census Area), /.test(n)).length >= 3000);
  const ca = Object.keys(citiesByName).filter((n) => citiesByName[n].country === "Canada" && n.endsWith(", Ontario"));
  assert.ok(ca.length >= 40, `${ca.length}`);
  assert.ok(citiesByName["Bruce County, Ontario"]);
});

test("a county never collides with the town of the same name", () => {
  const r = searchCities("Austin", 8).results.map((x) => x.name);
  assert.ok(r.includes("Austin"), String(r));
  const w = searchCities("Hyderabad", 8).results.map((x) => x.name);
  assert.ok(w.includes("Hyderabad"));
  assert.ok(searchCities("Kerala", 3).results.every((x) => x.name !== "Kerala"));
  const names = Object.keys(citiesByName);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, "no two places share a name");
});

test("a district pick round-trips through save, load and the public map", () => {
  const picks = ["Kasaragod district, Kerala", "Travis County, Texas", "Kasaragod", "Bruce County, Ontario", "Kannur"];
  const entries = picks.map((city, questionIndex) => ({ city, questionIndex }));
  const r = parseSaveInput({ homeCity: "Bengaluru", ownerName: "Ananya", entries });
  assert.equal(r.ok, true);
  const p = toPublicMap({ shortSlug: "k7q2x9ab", publicId: "p", homeCity: "Bengaluru", ownerName: "Ananya", kind: null, entries });
  assert.deepEqual(p.places.map((c) => c.name).sort(), [...picks, "Bengaluru"].sort());
  const d = p.places.find((c) => c.name === "Kasaragod district, Kerala")!;
  assert.deepEqual([d.country, d.region], ["India", "Kerala"]);
  assert.ok(mapStats(entries, "Bengaluru").km > 1000);
  assert.equal(parseSaveInput({ homeCity: "Bengaluru", ownerName: "A", entries: [{ city: "Nowhere district, Kerala", questionIndex: 0 }] }).ok, false);
});

test("per keystroke: the full list answers fast", () => {
  const qs = ["k", "ka", "kas", "kasa", "kasar", "kasarg", "kasargo", "kasargod", "calicu", "trivand"];
  searchCities("warm", 6);
  const t = performance.now();
  for (let i = 0; i < 20; i++) for (const q of qs) searchCities(q, 6, "Kochi");
  const per = (performance.now() - t) / (20 * qs.length);
  console.log(`per keystroke: ${per.toFixed(2)} ms`);
  assert.ok(per < 25, `${per.toFixed(1)} ms`);
});
