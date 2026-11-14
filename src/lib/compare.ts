// One comparison people can picture for the thread length. Every distance is
// computed from the city list here, never typed in (design-doc.md).
import { citiesByName } from "./cities";
import { haversineKm } from "./geo";

const PAIRS: [string, string, boolean][] = [
  ["Bengaluru", "Mysuru", false],
  ["Bengaluru", "Chennai", false],
  ["Mumbai", "Pune", false],
  ["Bengaluru", "Mumbai", false],
  ["Mumbai", "Delhi", false],
  ["Delhi", "Chennai", false],
  ["Kochi", "Delhi", false],
  ["Mumbai", "Dubai", false],
  ["Delhi", "London", false],
  ["Bengaluru", "London", true],
  ["Bengaluru", "Toronto", true],
];

export const ROUTES = PAIRS.map(([from, to, roundTrip]) => {
  const a = citiesByName[from]!, b = citiesByName[to]!;
  return { from, to, roundTrip, km: Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon) * (roundTrip ? 2 : 1)) };
}).sort((x, y) => x.km - y.km);

export function compareKm(km: number): { long: string; short: string } | null {
  const r = [...ROUTES].reverse().find((x) => x.km < km);
  if (!r) return null;
  return r.roundTrip
    ? { long: `Further than ${r.from} to ${r.to} and back.`, short: `further than ${r.to} and back` }
    : { long: `Further than ${r.from} to ${r.to}.`, short: `further than ${r.from} to ${r.to}` };
}
