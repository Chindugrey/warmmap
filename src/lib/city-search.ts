// Client side of city search. The 290 curated cities answer instantly from the bundle; everything else comes from
// GET /api/cities (the full list stays on the server). A city the browser learns that way is registered, and kept in
// localStorage, so globes, rewards and a resumed draft can place it later.
import { useEffect, useState } from "react";
import { allCityNames, countryOf, matchCities, registerCities, citiesByName, type City } from "./cities";

export interface CityItem { name: string; label: string; place?: City }
interface Remote { results: (City & { label: string })[]; match: string | null; country: string | null }

const KEY = "wm:places";

export function rememberPlaces(all: City[]) {
  registerCities(all);
  const list = all.filter((c) => !allCityNames.includes(c.name));
  if (!list.length) return;
  try {
    const have: City[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    const next = [...list.filter((c) => !have.some((h) => h.name === c.name)), ...have].slice(0, 80);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function restorePlaces() {
  try {
    registerCities(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {}
}

export async function fetchCities(q: string, home: string | undefined, limit: number, signal?: AbortSignal): Promise<Remote | null> {
  try {
    const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}&limit=${limit}${home ? `&home=${encodeURIComponent(home)}` : ""}`, { signal });
    return res.ok ? ((await res.json()) as Remote) : null;
  } catch {
    return null;
  }
}

const place = (c: City & { label?: string }): City => ({ name: c.name, country: c.country, lat: c.lat, lon: c.lon, ...(c.region ? { region: c.region } : {}) });

/** A suggestion for a city the API sent (it carries its place, so a pick can be remembered). */
export const itemOf = (c: City & { label?: string }): CityItem => ({ name: c.name, label: c.label ?? c.name, place: place(c) });

/** Suggestions for what is typed: the curated ones at once, replaced by the full-list ones when they arrive. */
export function useCitySearch(text: string, home: string | undefined, limit: number) {
  const q = text.trim();
  const [remote, setRemote] = useState<{ q: string; r: Remote } | null>(null);
  useEffect(() => {
    if (!q) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetchCities(q, home, limit, ac.signal).then((r) => r && setRemote({ q, r }));
    }, 120);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, home, limit]);
  const fresh = remote && remote.q === q ? remote.r : null;
  const items: CityItem[] = !q
    ? []
    : fresh
      ? fresh.results.map((c) => ({ name: c.name, label: c.label, place: place(c) }))
      : matchCities(q, limit, home).map((n) => ({ name: n, label: n }));
  const match = fresh?.match ? fresh.results.find((c) => c.name === fresh.match) : undefined;
  return { items, country: fresh ? fresh.country : countryOf(q), matchPlace: match ? place(match) : null, settled: !q || !!fresh };
}

export const placeOf = (name: string): City | undefined => citiesByName[name];
