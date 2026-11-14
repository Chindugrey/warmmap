// The five kinds of map (design-doc.md "The kinds of map"). Every kind comes
// from the visible shape of the map and carries a "because" line. A map that
// fits none gets no kind (a plain line in the UI), never a forced label.
import { citiesByName, type City } from "./cities";
import { haversineKm } from "./geo";

export type MapKind = "hearth" | "bridge" | "voyager" | "constellation" | "lantern-keeper";

export const KIND_LINES: Record<MapKind, { title: string; line: string }> = {
  hearth: { title: "The Hearth", line: "Your warmth lives close. Your people are twenty minutes away." },
  bridge: { title: "The Bridge", line: "You hold two places together, and both hold you." },
  constellation: { title: "The Constellation", line: "Your people are scattered like stars. You're the line between them." },
  voyager: { title: "The Voyager", line: "Your thread crosses oceans." },
  "lantern-keeper": { title: "The Lantern-keeper", line: "One person holds a lot of your sky." },
};

// Precedence when several fit (an open question for Aadarsh): the most
// specific shape first.
const ORDER: MapKind[] = ["hearth", "bridge", "voyager", "constellation", "lantern-keeper"];

const HEARTH_SHARE = 0.6;
const BRIDGE_GROUP_MIN = 3;
const BRIDGE_APART_KM = 1000;
const CLUSTER_KM = 300;
const VOYAGER_COUNTRIES = 3;
const VOYAGER_KM = 5000;
const CONSTELLATION_CITIES = 5;
const CONSTELLATION_MAX_SHARE = 0.4;
const KEEPER_REPEAT = 3;

export interface KindInput {
  homeCity: string;
  lanterns: { city: string }[];
  /** Most questions answered by one name. Counted on the phone; no names are sent. */
  repeatMax?: number;
}

export interface KindResult {
  kind: MapKind | null;
  because: string | null;
  /** A short, name-free line for the share cards. */
  short: string | null;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

export function computeKind(input: KindInput): KindResult {
  const home = citiesByName[input.homeCity];
  const pts = input.lanterns.map((l) => citiesByName[l.city]).filter((c): c is City => !!c);
  const total = pts.length;
  const checks: Record<MapKind, () => [string, string] | null> = {
    hearth: () => {
      const n = pts.filter((c) => c.name === input.homeCity).length;
      return total > 0 && n / total >= HEARTH_SHARE
        ? [`Because ${n} of your ${total} lanterns are in ${input.homeCity}.`, `${n} of ${total} lanterns in ${input.homeCity}.`]
        : null;
    },
    bridge: () => {
      const groups = clusters(pts).filter((g) => g.length >= BRIDGE_GROUP_MIN);
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const a = anchor(groups[i]);
          const b = anchor(groups[j]);
          const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
          if (d >= BRIDGE_APART_KM) {
            return [
              `Because ${groups[i].length} lanterns sit around ${a.name} and ${groups[j].length} around ${b.name}, ${fmt(d)} km apart.`,
              `Two places held together, ${a.name} and ${b.name}.`,
            ];
          }
        }
      }
      return null;
    },
    voyager: () => {
      const countries = new Set(pts.map((c) => c.country));
      if (home) countries.add(home.country);
      if (countries.size >= VOYAGER_COUNTRIES) return [`Because your lanterns reach ${countries.size} countries.`, `A thread across ${countries.size} countries.`];
      if (!home) return null;
      let far: City | null = null;
      let farKm = 0;
      for (const c of pts) {
        const d = haversineKm(home.lat, home.lon, c.lat, c.lon);
        if (d > farKm) {
          farKm = d;
          far = c;
        }
      }
      return far && farKm > VOYAGER_KM
        ? [`Because your furthest lantern is in ${far.name}, ${fmt(farKm)} km away.`, `The furthest light is in ${far.name}.`]
        : null;
    },
    constellation: () => {
      const counts = countBy(pts.map((c) => c.name));
      const max = Math.max(0, ...counts.values());
      return counts.size >= CONSTELLATION_CITIES && max / total <= CONSTELLATION_MAX_SHARE
        ? [`Because your lanterns are spread across ${counts.size} cities.`, max === 1 ? `${counts.size} cities, one light in each.` : `${counts.size} cities, scattered like stars.`]
        : null;
    },
    "lantern-keeper": () => {
      const r = input.repeatMax ?? 1;
      return r >= KEEPER_REPEAT ? [`Because one person answered ${r} of your questions.`, "One person holds a lot of this sky."] : null;
    },
  };
  for (const kind of ORDER) {
    const hit = checks[kind]();
    if (hit) return { kind, because: hit[0], short: hit[1] };
  }
  return { kind: null, because: null, short: null };
}

function countBy(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

// Single-linkage groups: lanterns within CLUSTER_KM of any member join the group.
function clusters(pts: City[]): City[][] {
  const seen = new Array(pts.length).fill(false);
  const out: City[][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (seen[i]) continue;
    seen[i] = true;
    const group = [pts[i]];
    for (let k = 0; k < group.length; k++) {
      for (let j = 0; j < pts.length; j++) {
        if (!seen[j] && haversineKm(group[k].lat, group[k].lon, pts[j].lat, pts[j].lon) <= CLUSTER_KM) {
          seen[j] = true;
          group.push(pts[j]);
        }
      }
    }
    out.push(group);
  }
  return out.sort((a, b) => b.length - a.length);
}

// The group's most common city names it.
function anchor(group: City[]): City {
  const counts = countBy(group.map((c) => c.name));
  const name = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  return group.find((c) => c.name === name)!;
}
