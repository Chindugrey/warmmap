import test from "node:test";
import assert from "node:assert/strict";
import { citiesByName, countryOf, findCity, matchCities } from "@/lib/cities";

const country = (names: string[]) => names.map((n) => citiesByName[n]?.country);

test("Cheruvathur is a Kerala town in the dataset and comes first", () => {
  assert.equal(matchCities("Cheruvathur")[0], "Cheruvathur");
  assert.equal(findCity("Cheruvathur")?.name, "Cheruvathur");
  for (const m of matchCities("Cheruvathur")) assert.ok(!["Chennai", "Chengdu", "Puducherry"].includes(m), `${m} is not a Cheruvathur`);
});

test("a typo of Cheruvathur still finds it, never the first three letters", () => {
  assert.equal(matchCities("Cheruvatur")[0], "Cheruvathur");
  assert.ok(!matchCities("Cheruvatur").includes("Chennai"));
});

test("Kannur is Kannur, not Kanpur", () => {
  assert.equal(matchCities("Kannur")[0], "Kannur");
  assert.equal(findCity("Kannur")?.name, "Kannur");
  assert.ok(!matchCities("Kannur").includes("Kanpur"));
  assert.equal(matchCities("Kanpur")[0], "Kanpur");
});

test("country US / USA / United States answer with US cities, never substrings", () => {
  for (const q of ["US", "us", "USA", "United States", "united states of america"]) {
    const m = matchCities(q, 6);
    assert.equal(countryOf(q), "USA", q);
    assert.equal(m.length, 6, q);
    assert.ok(country(m).every((c) => c === "USA"), `${q} -> ${m}`);
    for (const bad of ["Muscat", "Busan", "Brussels"]) assert.ok(!m.includes(bad));
    assert.equal(findCity(q), null, `${q} is a country, not a city`);
  }
});

test("other country names and codes", () => {
  assert.equal(countryOf("UK"), "UK");
  assert.equal(countryOf("United Kingdom"), "UK");
  assert.equal(countryOf("UAE"), "UAE");
  assert.equal(countryOf("India"), "India");
  assert.ok(country(matchCities("india", 8)).every((c) => c === "India"));
  assert.ok(country(matchCities("UK", 5)).every((c) => c === "UK"));
  assert.equal(countryOf("Kochi"), null);
  assert.equal(countryOf("Indore"), null);
});

test("a country query boosts the home state's cities first", () => {
  const m = matchCities("India", 5, "Kochi");
  assert.ok(m.every((c) => citiesByName[c].region === "Kerala"), `${m}`);
  const us = matchCities("US", 3, "Seattle");
  assert.equal(citiesByName[us[0]].region, "Washington");
});

test("short queries (3 letters or fewer) match prefixes only", () => {
  for (const q of ["us", "ch", "bus", "kan"]) {
    for (const m of matchCities(q, 20)) {
      const w = m.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s-]/);
      if (countryOf(q)) continue;
      assert.ok(w.some((x) => x.startsWith(q)), `${q} -> ${m}`);
    }
  }
});

test("controls: Bengaluru, Bangalore, New York, Kochi", () => {
  assert.equal(matchCities("Bengaluru")[0], "Bengaluru");
  assert.equal(matchCities("Bangalore")[0], "Bengaluru");
  assert.equal(findCity("Bangalore")?.name, "Bengaluru");
  assert.equal(matchCities("New York")[0], "New York");
  assert.equal(findCity("new york")?.name, "New York");
  assert.equal(matchCities("Kochi")[0], "Kochi");
  assert.equal(matchCities("Cochin")[0], "Kochi");
  assert.equal(findCity("Kochi, India")?.name, "Kochi");
});

test("prefix beats substring; home region breaks ties", () => {
  assert.equal(matchCities("Kozhi")[0], "Kozhikode");
  assert.equal(matchCities("york")[0], "New York");
  const m = matchCities("Pa", 40, "Kochi");
  assert.ok(m.indexOf("Palakkad") < m.indexOf("Palo Alto"));
});

test("unknown towns get no first-three-letter guesses", () => {
  assert.deepEqual(matchCities("Zzyzxville"), []);
  assert.equal(findCity("Zzyzxville"), null);
});

test("Kerala towns are in the dataset", () => {
  for (const n of ["Kannur", "Cheruvathur", "Kasaragod", "Payyannur", "Thalassery", "Thrissur", "Kottayam", "Kollam", "Alappuzha", "Palakkad", "Malappuram", "Kochi", "Kozhikode", "Thiruvananthapuram"]) {
    assert.equal(citiesByName[n]?.region, "Kerala", n);
  }
});
