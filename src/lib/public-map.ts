// The ONLY shape a map leaves the server in for visitors: owner first name,
// home city, lantern cities sorted by name, stats and kind. No question
// numbers, no answer order, no carried flag, no inviter, no gold, no ids
// other than the public slug.
import { citiesByName } from "./cities";
import { mapStats } from "./geo";
import { parseEntries } from "./entries";
import { computeKind, KIND_LINES, type MapKind } from "./kinds";

const isKind = (k: string): k is MapKind => k in KIND_LINES;

export interface PublicMap {
  id: string;
  ownerName: string | null;
  homeCity: string;
  lanterns: string[];
  stats: { lanterns: number; cities: number; countries: number; km: number };
  kind: MapKind | null;
  because: string | null;
}

export interface MapRowLike {
  shortSlug: string | null;
  publicId: string;
  homeCity: string;
  ownerName: string | null;
  entries: unknown;
  kind?: string | null;
}

export function toPublicMap(row: MapRowLike): PublicMap {
  const lanterns = parseEntries(row.entries)
    .map((e) => e.city)
    .filter((c) => !!citiesByName[c])
    .sort((a, b) => a.localeCompare(b));
  const s = mapStats(lanterns.map((city) => ({ city })), row.homeCity);
  // The kind stored at "Show me" wins (Lantern-keeper needs the repeat count,
  // which only the phone knows). Legacy rows without one get it from cities.
  const fromCities = computeKind({ homeCity: row.homeCity, lanterns: lanterns.map((city) => ({ city })) });
  let kind: MapKind | null = fromCities.kind;
  let because = fromCities.because;
  if (row.kind === "lantern-keeper") {
    kind = "lantern-keeper";
    because = "Because one person answered three or more of your questions.";
  } else if (row.kind && row.kind !== fromCities.kind && isKind(row.kind)) {
    kind = row.kind;
    because = null;
  }
  return {
    id: row.shortSlug ?? row.publicId,
    ownerName: row.ownerName,
    homeCity: row.homeCity,
    lanterns,
    stats: { lanterns: lanterns.length, cities: s.cities, countries: s.countries, km: s.km },
    kind,
    because,
  };
}
