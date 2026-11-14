import { mapStats } from "./geo";
import { computeKind } from "./kinds";
import type { StoredEntry } from "./entries";

export function mapShape(homeCity: string, entries: StoredEntry[], repeatMax: number) {
  const lanterns = entries.map((e) => ({ city: e.city }));
  const { kind, because } = computeKind({ homeCity, lanterns, repeatMax });
  return { kind, because, km: mapStats(lanterns, homeCity).km };
}

/** The carried lantern always points at the inviter's home, whatever the client sent. */
export function pinCarried(entries: StoredEntry[], inviterHome: string | null): StoredEntry[] {
  if (!inviterHome) return entries.filter((e) => !("carried" in e));
  return entries.map((e) => ("carried" in e ? { city: inviterHome, carried: true as const } : e));
}
