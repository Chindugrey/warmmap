// The full city list (curated + GeoNames, see scripts/build-cities.ts) and its search. SERVER ONLY:
// (Districts: src/lib/districts-data.ts.) importing this registers every city in `citiesByName`, which is how the API validates and lays out
// maps that name a city outside the 290 curated ones. The client never imports it (it would add
// ~280 KB to the bundle); it asks GET /api/cities instead.
import { CITIES_TSV, COUNTRY_NAMES, CURATED_ALTS_TSV } from "./cities-data";
import { DISTRICTS_TSV } from "./districts-data";
import { REGION_CODES } from "./cities-regions";
import { buildIndex, cities as curated, citiesByName, countryOf, findCity, norm, rank, registerCities, type City } from "./cities";

const DISTRICT_COUNTRY: Record<string, string> = { IN: "India", US: "USA", CA: "Canada" };

interface Loaded { city: City; base: string; alts: string[] }

const data: Loaded[] = [];
for (const line of CITIES_TSV.split("\n")) {
  const f = line.split("\t");
  if (f.length < 8 || citiesByName[f[0]]) continue;
  data.push({
    city: { name: f[0], country: COUNTRY_NAMES[f[3]] ?? f[3], lat: Number(f[5]), lon: Number(f[6]), ...(f[4] ? { region: f[4] } : {}) },
    base: f[1] || f[0],
    alts: f[2] ? f[2].split("|") : [],
  });
}
// Districts (India), counties (US) and census divisions (Canada): places of their own, named
// "Kasaragod district, Kerala" so they never collide with a town. They match on their short name
// ("Kasaragod district") and come after every city of the same rank.
const districts: Loaded[] = [];
for (const line of DISTRICTS_TSV.split("\n")) {
  const f = line.split("\t");
  if (f.length < 6 || citiesByName[f[0]]) continue;
  districts.push({ city: { name: f[0], country: DISTRICT_COUNTRY[f[2]] ?? f[2], lat: Number(f[4]), lon: Number(f[5]), region: f[3] }, base: f[1], alts: [] });
}
registerCities([...data, ...districts].map((d) => d.city));

// Alternate names of the curated cities (Bombay for Mumbai) come from GeoNames too.
const curatedAlts = new Map(CURATED_ALTS_TSV.split("\n").map((l) => l.split("\t") as [string, string]));
const cityEntries: Loaded[] = [...curated.map((city) => ({ city, base: city.name, alts: curatedAlts.get(city.name)?.split("|") ?? [] })), ...data];
const entries: Loaded[] = [...cityEntries, ...districts];
const index = buildIndex([...cityEntries, ...districts.map((d) => ({ ...d, weak: true }))]);

// "Springfield, IL" / "Hyderabad, India": a name shared by several cities is shown with where it is.
// Within one country the state tells them apart; across countries, the country.
const baseGroup = new Map<string, City[]>();
// Cities only: a district never makes a town share its name (every district name carries its own suffix anyway).
for (const e of cityEntries) baseGroup.set(norm(e.base), [...(baseGroup.get(norm(e.base)) ?? []), e.city]);
const qualifier = (c: City, group: City[]) => {
  const oneCountry = group.every((g) => g.country === c.country);
  if (!oneCountry) return c.country;
  return (c.country === "USA" || c.country === "Canada" ? REGION_CODES[c.region ?? ""] ?? c.region : c.region) || c.country;
};
const districtNames = new Set(districts.map((d) => d.city.name));
const baseOf = new Map(entries.map((e) => [e.city.name, e.base]));
/** A qualified key already carries its place; a bare name gets one only when another city shares it. */
const labelOf = (c: City) => {
  const base = baseOf.get(c.name) ?? c.name;
  const group = baseGroup.get(norm(base)) ?? [];
  return c.name !== base || group.length < 2 ? c.name : `${c.name}, ${qualifier(c, group)}`;
};

const labels: Record<string, string> = {};
for (const { city, base } of entries) {
  labels[city.name] = city.name;
  labels[`${base}, ${city.country}`] ??= city.name;
  if (city.region) labels[`${base}, ${city.region}`] ??= city.name;
}

export interface CityHit { name: string; label: string; country: string; region?: string; lat: number; lon: number }

export interface CitySearch {
  results: CityHit[];
  /** The city the text names for certain (exact, or a 4+ letter prefix): what findCity would pick. Null when the user must choose. */
  match: string | null;
  /** The country the text names, when it names one ("US", "India"). */
  country: string | null;
}

/** The text after a comma ("Ohio", "OH", "India") names the region or country the place is in. */
const inRegion = (c: City, tail: string) => {
  const code = REGION_CODES[c.region ?? ""];
  return norm(c.region ?? "") === tail || (!!code && code.toLowerCase() === tail) || norm(c.country) === tail;
};

export function searchCities(text: string, limit = 6, home?: string): CitySearch {
  let all = rank(text, home, index).names;
  // "Franklin County, Ohio": the part after the comma narrows to that state / province / country.
  const tail = text.includes(",") ? norm(text.slice(text.indexOf(",") + 1)) : "";
  let narrowed = false;
  if (tail) {
    const here = all.filter((n) => inRegion(citiesByName[n], tail));
    if (here.length) [all, narrowed] = [here, true];
  }
  // "Springfield" names several cities: never pick one for the user.
  const q = norm(text.split(",")[0]);
  const exact = all.slice(0, limit).filter((n) => norm(baseOf.get(n) ?? n) === q);
  let match = exact.length > 1 && !text.includes(",") ? null : findCity(text, index, labels)?.name ?? null;
  if (narrowed) {
    // The region the user typed decides among same-named places; a half-typed name is not guessed.
    const same = all.filter((n) => norm(baseOf.get(n) ?? n) === q);
    match = same.length === 1 ? same[0] : labels[text.trim()] ?? null;
  }
  // A district, county or division is only ever picked by typing its own name, never as the guess for a town's prefix.
  if (match && districtNames.has(match) && q !== norm(baseOf.get(match) ?? match) && norm(text) !== norm(match)) match = null;
  // The pick is always among the suggestions, and first: the client finds it there.
  const names = (match ? [match, ...all.filter((n) => n !== match)] : all).slice(0, limit);
  const results = names.map((n) => {
    const c = citiesByName[n];
    return { name: c.name, label: labelOf(c), country: c.country, ...(c.region ? { region: c.region } : {}), lat: c.lat, lon: c.lon };
  });
  return { results, match, country: countryOf(text, index) };
}

export const fullCityCount = entries.length;
