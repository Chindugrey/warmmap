import test from "node:test";
import assert from "node:assert/strict";
import { cities as curated, citiesByName } from "@/lib/cities";
import { fullCityCount, searchCities } from "@/lib/cities-full";
import { CITIES_TSV } from "@/lib/cities-data";
import { parseSaveInput } from "@/lib/map-input";
import { toPublicMap } from "@/lib/public-map";
import { mapStats } from "@/lib/geo";

const labels = (q: string, n = 8, home?: string) => searchCities(q, n, home).results.map((r) => r.label);

test("the full list is big, and every curated city (incl. the Kerala towns) keeps its name and coordinates", () => {
  assert.ok(fullCityCount > 5000, `${fullCityCount}`);
  for (const c of curated) assert.deepEqual(citiesByName[c.name], c, c.name);
  for (const n of ["Kannur", "Cheruvathur", "Kasaragod", "Payyannur", "Thalassery"]) assert.equal(citiesByName[n]?.region, "Kerala", n);
});

test("same name, different places: the suggestion says where (state in the US, country elsewhere)", () => {
  const s = labels("Springfield");
  for (const want of ["Springfield, IL", "Springfield, MO", "Springfield, MA"]) assert.ok(s.includes(want), `${want} in ${s}`);
  assert.equal(searchCities("Springfield").match, null, "an ambiguous name is never picked for the user");
  assert.equal(searchCities("Springfield, IL").match, "Springfield, IL");
  const h = labels("Hyderabad");
  assert.deepEqual(h.slice(0, 2), ["Hyderabad, India", "Hyderabad, Pakistan"]);
  assert.equal(citiesByName["Hyderabad"].country, "India", "the stored name of the curated city is unchanged");
  assert.equal(citiesByName["Hyderabad, Pakistan"].country, "Pakistan");
});

test("a Canadian city, an Indian town of 50k+, UK and EU cities, a small state capital", () => {
  assert.equal(searchCities("Kitchener").match, "Kitchener–Waterloo");
  assert.equal(searchCities("Winnipeg").results[0].country, "Canada");
  const t = searchCities("Tirunelveli");
  assert.equal(t.match, "Tirunelveli");
  assert.equal(citiesByName["Tirunelveli"].region, "Tamil Nadu");
  assert.equal(searchCities("Leeds").results[0].country, "UK");
  assert.equal(searchCities("Cologne").results[0].country, "Germany");
  assert.equal(searchCities("Olympia").results[0].region, "Washington");
});

test("India has 50k+ towns (~1000), US and Canada have their 100k+ cities and capitals", () => {
  const count = (cc: string) => CITIES_TSV.split("\n").filter((l) => l.split("\t")[3] === cc).length;
  assert.ok(count("IN") >= 900, `IN ${count("IN")}`);
  assert.ok(count("US") >= 280, `US ${count("US")}`);
  assert.ok(count("CA") >= 50, `CA ${count("CA")}`);
});

test("ranking is as before: exact/alias, prefix, country, home boost, no guesses", () => {
  assert.equal(searchCities("Cheruvathur").results[0].name, "Cheruvathur");
  assert.equal(searchCities("Kannur").results[0].name, "Kannur");
  assert.ok(!searchCities("Kannur").results.some((r) => r.name === "Kanpur"));
  assert.equal(searchCities("Bangalore").results[0].name, "Bengaluru");
  assert.equal(searchCities("US", 6).country, "USA");
  assert.ok(searchCities("US", 6).results.every((r) => r.country === "USA"));
  assert.ok(searchCities("India", 5, "Kochi").results.every((r) => r.region === "Kerala"));
  assert.deepEqual(searchCities("Zzyzxville").results, []);
  assert.deepEqual(searchCities("").results, []);
});

test("maps with a GeoNames city save, count and draw", () => {
  const entries = ["Tirunelveli", "Springfield, IL", "Winnipeg", "Leeds", "Hyderabad, Pakistan"].map((city, questionIndex) => ({ city, questionIndex }));
  const r = parseSaveInput({ homeCity: "Bengaluru", ownerName: "Ananya", entries });
  assert.equal(r.ok, true);
  assert.equal(parseSaveInput({ homeCity: "Atlantis", ownerName: "A", entries }).ok, false);
  const p = toPublicMap({ shortSlug: "k7q2x9ab", publicId: "p", homeCity: "Bengaluru", ownerName: "Ananya", kind: null, entries });
  assert.equal(p.stats.cities, 5);
  assert.equal(p.stats.countries, 5);
  assert.deepEqual(p.places.map((c) => c.name).sort(), ["Bengaluru", "Hyderabad, Pakistan", "Leeds", "Springfield, IL", "Tirunelveli", "Winnipeg"]);
  assert.ok(mapStats(entries, "Bengaluru").km > 10000);
});

test("search is fast and the answer is small", () => {
  const t = performance.now();
  for (const q of ["spring", "hyder", "new", "kitch", "zzzzzz", "US", "india"]) searchCities(q, 6, "Kochi");
  const per = (performance.now() - t) / 7;
  assert.ok(per < 250, `${per.toFixed(1)} ms per search`);
  assert.ok(JSON.stringify(searchCities("spring", 6)).length < 1500);
});
