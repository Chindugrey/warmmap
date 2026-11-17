// The full city list (curated + GeoNames, see scripts/build-cities.ts) and its search. SERVER ONLY:
// importing this registers every city in `citiesByName`, which is how the API validates and lays out
// maps that name a city outside the 290 curated ones. The client never imports it (it would add
// ~280 KB to the bundle); it asks GET /api/cities instead.
import { CITIES_TSV, COUNTRY_NAMES } from "./cities-data";
import { REGION_CODES } from "./cities-regions";
import { buildIndex, cities as curated, citiesByName, countryOf, findCity, norm, rank, registerCities, type City } from "./cities";

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
registerCities(data.map((d) => d.city));

const entries: Loaded[] = [...curated.map((city) => ({ city, base: city.name, alts: [] })), ...data];
const index = buildIndex(entries);

// "Springfield, IL" / "Hyderabad, India": a name shared by several cities is shown with where it is.
// Within one country the state tells them apart; across countries, the country.
const baseGroup = new Map<string, City[]>();
for (const e of entries) baseGroup.set(norm(e.base), [...(baseGroup.get(norm(e.base)) ?? []), e.city]);
const qualifier = (c: City, group: City[]) => {
  const oneCountry = group.every((g) => g.country === c.country);
  if (!oneCountry) return c.country;
  return (c.country === "USA" || c.country === "Canada" ? REGION_CODES[c.region ?? ""] ?? c.region : c.region) || c.country;
};
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

export function searchCities(text: string, limit = 6, home?: string): CitySearch {
  const names = rank(text, home, index).names.slice(0, limit);
  const results = names.map((n) => {
    const c = citiesByName[n];
    return { name: c.name, label: labelOf(c), country: c.country, ...(c.region ? { region: c.region } : {}), lat: c.lat, lon: c.lon };
  });
  // "Springfield" names several cities: never pick one for the user.
  const q = norm(text.split(",")[0]);
  const exact = results.filter((r) => norm(baseOf.get(r.name) ?? r.name) === q);
  const match = exact.length > 1 && !text.includes(",") ? null : findCity(text, index, labels)?.name ?? null;
  return { results, match, country: countryOf(text, index) };
}

export const fullCityCount = entries.length;
