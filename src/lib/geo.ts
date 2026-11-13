import { citiesByName, type City } from "./cities";

const CX = 300;
const CY = 300;
const RMAX = 246;

export interface Point {
  x: number;
  y: number;
}

export function placeOnGlobe(home: City, city: City): Point {
  const d = haversineKm(home.lat, home.lon, city.lat, city.lon);
  if (d < 1) return { x: CX + 22, y: CY - 20 };
  const y =
    Math.sin(rad(city.lon - home.lon)) * Math.cos(rad(city.lat));
  const x =
    Math.cos(rad(home.lat)) * Math.sin(rad(city.lat)) -
    Math.sin(rad(home.lat)) *
      Math.cos(rad(city.lat)) *
      Math.cos(rad(city.lon - home.lon));
  const bearing = Math.atan2(y, x);
  const r = Math.max(28, RMAX * Math.sqrt(d / 20015));
  return {
    x: CX + r * Math.sin(bearing),
    y: CY - r * Math.cos(bearing),
  };
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(aLat)) *
      Math.cos(rad(bLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function rad(d: number) {
  return (d * Math.PI) / 180;
}

export function mapStats(entries: { city: string }[], homeCity: string) {
  const home = citiesByName[homeCity];
  const cities = new Set<string>();
  const countries = new Set<string>();
  let km = 0;
  entries.forEach((e) => {
    const c = citiesByName[e.city];
    if (!c) return;
    cities.add(c.name);
    countries.add(c.country);
    if (home) km += haversineKm(home.lat, home.lon, c.lat, c.lon);
  });
  return {
    people: entries.length,
    cities: cities.size,
    countries: countries.size,
    km: Math.round(km),
  };
}

export { CX, CY };
