// One-off generator for src/lib/cities-data.ts from GeoNames dumps (CC BY 4.0, geonames.org).
// The dumps are NOT in the repo. Download them to a scratch directory and unzip:
//   mkdir -p ~/work/warmmap/build/geonames/{dl,x}
//   cd ~/work/warmmap/build/geonames/dl && for f in cities15000.zip cities5000.zip admin1CodesASCII.txt countryInfo.txt; do
//     curl -sSfLO https://download.geonames.org/export/dump/$f; done
//   cd ../x && unzip -o ../dl/cities15000.zip && unzip -o ../dl/cities5000.zip
// Then:  node --import ./tests/register.mjs scripts/build-cities.ts ~/work/warmmap/build/geonames
//
// Picks: every city of 100,000+ anywhere (the EU and UK majors are inside that), every
// national capital, US / Canada state and province capitals, and India at 50,000+ plus its
// state capitals. The curated list in src/lib/cities.ts is kept as is (its names are what
// saved maps store), and GeoNames duplicates of it are dropped by name + country + distance.
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
    // Alternate spellings are only worth keeping for India (Bangalore, Trivandrum); elsewhere GeoNames' name is the one people type.
    const alts = cc !== "IN" ? [] : [...new Set(f[3].split(","))]
      .filter((a) => /^[\x20-\x7e]+$/.test(a) && a.length >= 4 && a.length <= 26 && !/\d/.test(a) && norm(a) !== norm(base) && norm(a) !== norm(ascii))
      .slice(0, 3);
    picked.push({ names: new Set([f[1], ascii, ...f[3].split(",")].map(norm)), key: base, base, alts, cc, country: countries[cc] ?? cc, region: admin1[`${cc}.${f[10]}`] ?? "", lat: Math.round(Number(f[4]) * 100) / 100, lon: Math.round(Number(f[5]) * 100) / 100, pop });
  }
}
picked.sort((a, b) => b.pop - a.pop);

// Drop what the curated list already has: same country, within 30 km, and the name (or an alternate
// name) matches; or simply within 5 km (Kitchener inside Kitchener-Waterloo).
const curatedNames = new Set(curated.map((c) => c.name));
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
// Columns (tab separated): key, base name if it differs from the key, alternate names (|), country code,
// region (admin1), lat, lon, population in thousands. Rows are largest first.
export const COUNTRY_NAMES: Record<string, string> = ${JSON.stringify(used)};
export const CITIES_TSV = \`${esc(lines.join("\n"))}\`;
`;
writeFileSync("src/lib/cities-data.ts", file);
console.log(`picked ${picked.length}, dropped ${dropped} as curated twins, wrote ${out.length} rows, ${file.length} bytes`);
console.log("learned regions:", [...learned]);
