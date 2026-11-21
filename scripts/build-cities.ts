// One-off generator for src/lib/cities-data.ts from GeoNames dumps (CC BY 4.0, geonames.org).
// The dumps are NOT in the repo. Download them to a scratch directory and unzip:
//   mkdir -p ~/work/warmmap/build/geonames/{dl,x}
//   cd ~/work/warmmap/build/geonames/dl && for f in cities15000.zip cities5000.zip admin1CodesASCII.txt countryInfo.txt; do
//     curl -sSfLO https://download.geonames.org/export/dump/$f; done
//   cd ../x && unzip -o ../dl/cities15000.zip && unzip -o ../dl/cities5000.zip
// Districts (India, US counties, Canadian divisions) and the US / Canada / India alternate names also need the three
// country files (~400 MB unzipped, scratch only):
//   mkdir -p ~/work/warmmap/build/geonames/{dl2,x2}
//   cd ~/work/warmmap/build/geonames/dl2 && for c in IN US CA; do curl -sSfLO https://download.geonames.org/export/dump/$c.zip; done
//   cd ../x2 && for c in IN US CA; do unzip -oq ../dl2/$c.zip $c.txt; done
// Then:  node --max-old-space-size=4096 --import ./tests/register.mjs scripts/build-cities.ts ~/work/warmmap/build/geonames
//
// Picks: every city of 100,000+ anywhere (the EU and UK majors are inside that), every
// national capital, US / Canada state and province capitals, and India at 50,000+ plus its
// state capitals. The curated list in src/lib/cities.ts is kept as is (its names are what
// saved maps store), and GeoNames duplicates of it are dropped by name + country + distance.
// Alternate names (Latin script only, de-duplicated) are kept for India, the US and Canada; districts are written to
// src/lib/districts-data.ts (see the end of this file).
// Same-named cities get a qualified key ("Springfield, IL", "Hyderabad, Pakistan"); a curated
// city keeps its bare name.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cities as curated } from "@/lib/cities";
import { REGION_CODES } from "@/lib/cities-regions";

const dir = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: build-cities.ts <geonames dir with dl/ and x/>");
const read = (p: string) => readFileSync(path.join(dir, p), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const OVERRIDE: Record<string, string> = { US: "USA", GB: "UK", AE: "UAE", TR: "Türkiye", CZ: "Czechia", CD: "DR Congo", CG: "Congo", CI: "Ivory Coast", MM: "Myanmar", MK: "North Macedonia" };
const countries: Record<string, string> = {};
for (const l of read("dl/countryInfo.txt")) {
  const f = l.split("\t");
  countries[f[0]] = OVERRIDE[f[0]] ?? f[4];
}
const admin1: Record<string, string> = {};
for (const l of read("dl/admin1CodesASCII.txt")) {
  const f = l.split("\t");
  admin1[f[0]] = f[1];
}

// Latin-script variants only, 4-26 letters, no digits, de-duplicated, not the name itself. In the US and Canada
// GeoNames' alternates are mostly abbreviations and neighbourhoods, so only near spellings of the name stay.
const ALT_CODES = new Set(["IN", "US", "CA"]);
function altsOf(cc: string, raw: string, names: string[]): string[] {
  if (!ALT_CODES.has(cc)) return [];
  const known = new Set(names.map(norm));
  const out: string[] = [];
  for (const a of raw.split(",")) {
    const n = norm(a);
    if (!/^[\x20-\x7e]+$/.test(a) || n.length < 4 || n.length > 26 || /\d/.test(n) || known.has(n)) continue;
    if (cc !== "IN" && !names.some((b) => near(n, norm(b)))) continue;
    known.add(n);
    out.push(a.trim());
    if (out.length === (cc === "IN" ? 6 : 3)) break;
  }
  return out;
}
// Within 3 edits (a spelling variant, not a different word).
function near(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 3) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 3;
}

const rad = (d: number) => (d * Math.PI) / 180;
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};

interface Row { names: Set<string>; key: string; base: string; alts: string[]; cc: string; country: string; region: string; lat: number; lon: number; pop: number }

// 15000 holds everything above 15k; 5000 adds the small capitals. Merge by GeoNames id.
const seen = new Set<string>();
const picked: Row[] = [];
const CITY_CODES = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLG"]);
for (const file of ["x/cities15000.txt", "x/cities5000.txt"]) {
  for (const l of read(file)) {
    const f = l.split("\t");
    if (seen.has(f[0])) continue;
    const [cc, code, pop] = [f[8], f[7], Number(f[14])];
    if (!CITY_CODES.has(code)) continue;
    const capital = code === "PPLC" || (code === "PPLA" && (cc === "US" || cc === "CA" || cc === "IN"));
    if (!(pop >= 100000 || capital || (cc === "IN" && pop >= 50000))) continue;
    seen.add(f[0]);
    const ascii = f[2];
    // Keep accents where they are the usual spelling (Zürich, São Paulo); India reads better without macrons.
    const base = cc !== "IN" && norm(f[1]) === norm(ascii) ? f[1] : ascii;
    // Alternate spellings are only worth keeping for India, the US and Canada (Bangalore, Trivandrum); elsewhere GeoNames' name is the one people type.
    const alts = altsOf(cc, f[3], [base, ascii]);
    picked.push({ names: new Set([f[1], ascii, ...f[3].split(",")].map(norm)), key: base, base, alts, cc, country: countries[cc] ?? cc, region: admin1[`${cc}.${f[10]}`] ?? "", lat: Math.round(Number(f[4]) * 100) / 100, lon: Math.round(Number(f[5]) * 100) / 100, pop });
  }
}
picked.sort((a, b) => b.pop - a.pop);

// Drop what the curated list already has: same country, within 30 km, and the name (or an alternate
// name) matches; or simply within 5 km (Kitchener inside Kitchener-Waterloo).
const curatedNames = new Set(curated.map((c) => c.name));
const curatedAlts = new Map<string, string[]>(); // curated city -> GeoNames alternate names for it
const learned = new Map<string, string>(); // GeoNames admin1 name -> curated region, from the pairs found
const kept: Row[] = [];
let dropped = 0;
for (const r of picked) {
  const names = r.names;
  let dup = false;
  for (const c of curated) {
    if (c.country !== r.country) continue;
    const d = km(c, r);
    if (d <= 5 || (d <= 30 && names.has(norm(c.name)))) {
      dup = true;
      const more = r.alts.filter((a) => norm(a) !== norm(c.name));
      if (more.length) curatedAlts.set(c.name, [...new Set([...(curatedAlts.get(c.name) ?? []), ...more])].slice(0, 6));
      if (c.region && r.region && !learned.has(r.region)) learned.set(r.region, c.region);
      break;
    }
  }
  if (dup) dropped++;
  else kept.push(r);
}
// Region names as the curated list spells them (GeoNames "Delhi" is curated "Delhi"; this catches the odd one out).
for (const r of kept) r.region = learned.get(r.region) ?? r.region;

// Same-named groups: a curated city keeps its bare name, the others are qualified; with no curated
// one, every member is qualified. US / Canada use the state code, India the state, the rest the country.
const qualifier = (r: Row) => (r.cc === "US" || r.cc === "CA" ? REGION_CODES[r.region] ?? r.region : r.cc === "IN" ? r.region : r.country) || r.country;
const groups = new Map<string, Row[]>();
for (const r of kept) groups.set(norm(r.base), [...(groups.get(norm(r.base)) ?? []), r]);
const curatedBases = new Set(curated.map((c) => norm(c.name)));
const out: Row[] = [];
const keys = new Set(curatedNames);
const citiesByNameKeys = keys; // district names must not reuse a city key
for (const [b, rows] of groups) {
  const clash = rows.length > 1 || curatedBases.has(b);
  for (const r of rows) {
    r.key = clash ? `${r.base}, ${qualifier(r)}` : r.base;
    if (keys.has(r.key)) continue; // an exact twin (same state): the larger one was kept first
    keys.add(r.key);
    out.push(r);
  }
}
out.sort((a, b) => b.pop - a.pop);

const esc = (s: string) => s.replace(/[\\`$]/g, "\\$&");
const lines = out.map((r) => [r.key, r.key === r.base ? "" : r.base, r.alts.join("|"), r.cc, r.region, r.lat, r.lon, Math.round(r.pop / 1000)].join("\t"));
const used = Object.fromEntries([...new Set(out.map((r) => r.cc))].sort().map((cc) => [cc, countries[cc]]));
const file = `// GENERATED by scripts/build-cities.ts from GeoNames (https://www.geonames.org, CC BY 4.0). Do not edit.
// Server-side only: read by src/lib/cities-full.ts, never imported by client code.
// Columns of CITIES_TSV (tab separated): key, base name if it differs from the key, alternate names (|), country code,
// region (admin1), lat, lon, population in thousands. Rows are largest first.
export const COUNTRY_NAMES: Record<string, string> = ${JSON.stringify(used)};
// CURATED_ALTS_TSV: alternate names of the curated cities (tab separated: curated name, alternates |).
export const CURATED_ALTS_TSV = \`${esc([...curatedAlts].map(([n, a]) => `${n}\t${a.join("|")}`).join("\n"))}\`;
export const CITIES_TSV = \`${esc(lines.join("\n"))}\`;
`;
writeFileSync("src/lib/cities-data.ts", file);
console.log(`picked ${picked.length}, dropped ${dropped} as curated twins, wrote ${out.length} rows, ${file.length} bytes`);
console.log("learned regions:", [...learned]);

// Districts: India (admin2), US counties and Canadian census divisions (admin2 where GeoNames has them as such).
// Each is a place of its own, "Kasaragod district, Kerala" / "Travis County, Texas" / "Bruce County, Ontario", so it
// never collides with a town. India sits at its district HQ: the PPLA2 seat in the same district, else a populated
// place named like the district, else the admin2 point. US and Canada sit at the admin2 point GeoNames holds.
// Alberta, Manitoba, Saskatchewan and Newfoundland are left out: GeoNames' admin2 there is municipalities (hundreds), not divisions.
// Every row carries a type suffix of its own ("X district" / "X County" / "X division"), so a bare town name never
// matches a district, and none shares a base name with a city (checked at the end).
const SKIP_CA = new Set(["01", "03", "05", "11"]);
const TYPED = /\b(county|district|municipality|region|regional|parish|borough|division|city)$/i;
const cityBases = new Set([...curated.map((c) => norm(c.name)), ...out.map((r) => norm(r.base))]);
const cityByRegionBase = new Set([...curated.map((c) => `${norm(c.name)}|${c.country}`), ...out.map((r) => `${norm(r.base)}|${r.country}`)]);
const dRows: string[] = [];
const dKeys = new Set<string>();
const how = { seat: 0, named: 0, altname: 0, capital: 0, centroid: 0 };
const r2 = (n: string) => Math.round(Number(n) * 100) / 100;
for (const cc of ["IN", "US", "CA"]) {
  const lines = read(`x2/${cc}.txt`).map((l) => l.split("\t"));
  const placesIn = new Map<string, string[][]>();
  if (cc === "IN") for (const f of lines) if (f[6] === "P" && f[11]) placesIn.set(`${f[10]}.${f[11]}`, [...(placesIn.get(`${f[10]}.${f[11]}`) ?? []), f]);
  for (const f of lines) {
    if (f[7] !== "ADM2") continue;
    if (cc === "CA" && SKIP_CA.has(f[10])) continue;
    const region0 = admin1[`${cc}.${f[10]}`];
    if (!region0) continue;
    const region = learned.get(region0) ?? region0;
    let base = f[2].replace(/\s*\(.*\)\s*$/, "").trim();
    let [lat, lon] = [r2(f[4]), r2(f[5])];
    if (cc === "IN") {
      base = base.replace(/\s+district$/i, "").replace(/^district\s+/i, "");
      const here = placesIn.get(`${f[10]}.${f[11]}`) ?? [];
      if (/\bdivision$/i.test(base)) continue; // Maharashtra's divisions group districts; the districts are rows of their own
      const byPop = (a: string[], b: string[]) => Number(b[14]) - Number(a[14]);
      const dAlts = new Set(f[3].split(",").map(norm));
      const named = here.filter((p) => norm(p[2]) === norm(base)).sort(byPop)[0];
      const seat = here.filter((p) => p[7] === "PPLA2").sort(byPop)[0] ?? named;
      const alt = here.filter((p) => dAlts.has(norm(p[2])) || p[3].split(",").some((a) => norm(a) === norm(base))).sort(byPop)[0];
      const cap = here.filter((p) => p[7] === "PPLA" || p[7] === "PPLC").sort(byPop)[0];
      const hq = seat ?? alt ?? cap;
      if (hq) {
        [lat, lon] = [r2(hq[4]), r2(hq[5])];
        how[hq[7] === "PPLA2" ? "seat" : hq === named ? "named" : hq === alt ? "altname" : "capital"]++;
      } else how.centroid++;
    }
    if (!base || norm(base) === norm(region)) continue;
    const label = TYPED.test(base) || (cc === "CA" && /\b(county|district|municipality|regional)\b/i.test(base)) ? base : cc === "IN" ? `${base} district` : cc === "CA" ? `${base} division` : base;
    // A census division that is just the city of the same name (Toronto, Hamilton, Ottawa) adds nothing.
    if (cc === "CA" && cityByRegionBase.has(`${norm(base.replace(TYPED, ""))}|Canada`)) continue;
    if (cityBases.has(norm(label))) continue; // Carson City, the independent city, is the city itself
    const key = `${label}, ${region}`;
    if (dKeys.has(key.toLowerCase()) || citiesByNameKeys.has(key)) continue;
    dKeys.add(key.toLowerCase());
    dRows.push([key, label, cc, region, lat, lon].join("\t"));
  }
}
for (const row of dRows) {
  const label = row.split("\t")[1];
  if (cityBases.has(norm(label))) throw new Error(`district name ${label} is also a city's base name`);
}
const dfile = `// GENERATED by scripts/build-cities.ts from GeoNames (https://www.geonames.org, CC BY 4.0). Do not edit.
// Server-side only: read by src/lib/cities-full.ts, never imported by client code.
// Columns (tab separated): key (what a map stores), name to match on, country code, region, lat, lon.
export const DISTRICTS_TSV = \`${esc(dRows.join("\n"))}\`;
`;
writeFileSync("src/lib/districts-data.ts", dfile);
console.log(`districts ${dRows.length}, ${dfile.length} bytes; India HQ: ${JSON.stringify(how)}`);
