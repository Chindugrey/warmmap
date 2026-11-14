// Auto-framed globe (design review must-fix 3): the furthest lantern sits on
// the rim (86% of the sphere), so a Bengaluru–Mysuru–Chennai map is as
// spread out as a Toronto one. Pure; shared by the app globe and share cards.
import { citiesByName } from "./cities";
import { haversineKm } from "./geo";

export const CENTER = 300;
export const SPHERE_R = 262;
export const GLOBE_R = SPHERE_R * 0.86;
const NEAR_KM = 25;

export interface GlobePoint {
  city: string;
  x: number;
  y: number;
  km: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

function bearing(aLat: number, aLon: number, bLat: number, bLon: number) {
  const y = Math.sin(rad(bLon - aLon)) * Math.cos(rad(bLat));
  const x = Math.cos(rad(aLat)) * Math.sin(rad(bLat)) - Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(rad(bLon - aLon));
  return Math.atan2(y, x);
}

export function layoutGlobe(homeCity: string, cities: string[]): { points: GlobePoint[]; kmMax: number } {
  const home = citiesByName[homeCity] ?? citiesByName["Bengaluru"]!;
  const raw = cities.map((city) => {
    const c = citiesByName[city];
    if (!c) return { city, km: 0, b: 0 };
    return { city, km: haversineKm(home.lat, home.lon, c.lat, c.lon), b: bearing(home.lat, home.lon, c.lat, c.lon) };
  });
  const kmMax = Math.max(1, ...raw.map((r) => r.km));
  const seen = new Map<string, number>();
  let nearCount = 0;
  const points = raw.map((r) => {
    const dup = seen.get(r.city) ?? 0;
    seen.set(r.city, dup + 1);
    let x: number, y: number;
    if (r.km <= NEAR_KM) {
      // Around the home light, never on top of it.
      const a = -Math.PI / 3 + nearCount++ * 1.15;
      x = CENTER + 30 * Math.cos(a);
      y = CENTER + 30 * Math.sin(a);
    } else {
      const rr = Math.max(GLOBE_R * 0.2, GLOBE_R * Math.sqrt(r.km / kmMax));
      x = CENTER + rr * Math.sin(r.b);
      y = CENTER - rr * Math.cos(r.b);
      if (dup > 0) {
        // Repeats of one city sit in a small ring around it, inside the sphere.
        const a = dup * 2.1;
        x += 22 * Math.cos(a);
        y += 22 * Math.sin(a);
        const d = Math.hypot(x - CENTER, y - CENTER);
        if (d > GLOBE_R) {
          x = CENTER + ((x - CENTER) * GLOBE_R) / d;
          y = CENTER + ((y - CENTER) * GLOBE_R) / d;
        }
      }
    }
    return { city: r.city, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, km: Math.round(r.km) };
  });
  return { points, kmMax };
}

/** Curved thread from home to a point, like a pen line. */
export function threadPath(p: { x: number; y: number }): string {
  const dx = p.x - CENTER, dy = p.y - CENTER;
  const mx = (CENTER + p.x) / 2 - dy * 0.22, my = (CENTER + p.y) / 2 + dx * 0.22;
  return `M${CENTER} ${CENTER}Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x} ${p.y}`;
}
