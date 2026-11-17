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
    return { city: r.city, x, y, km: Math.round(r.km) };
  });
  separate(points);
  return { points: points.map((p) => ({ ...p, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })), kmMax };
}

export const MIN_SEPARATION = 26;

/**
 * Nudges lanterns apart until no two sit closer than MIN_SEPARATION, keeping
 * them inside the rim and off the home light. India-only maps cluster
 * (three in Delhi, two in Pune), so this is what keeps each lantern readable.
 */
function separate(points: { x: number; y: number }[]) {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= MIN_SEPARATION) continue;
        if (d < 0.01) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          d = 1;
        }
        const push = (MIN_SEPARATION - d) / 2 + 0.01;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    for (const p of points) {
      const r = Math.hypot(p.x - CENTER, p.y - CENTER);
      if (r > GLOBE_R) {
        p.x = CENTER + ((p.x - CENTER) * GLOBE_R) / r;
        p.y = CENTER + ((p.y - CENTER) * GLOBE_R) / r;
      } else if (r < 22) {
        const k = r < 0.01 ? 0 : 22 / r;
        p.x = r < 0.01 ? CENTER + 22 : CENTER + (p.x - CENTER) * k;
        p.y = r < 0.01 ? CENTER : CENTER + (p.y - CENTER) * k;
      }
    }
    if (!moved) break;
  }
}

/** Curved thread from home to a point, like a pen line. */
export function threadPath(p: { x: number; y: number }): string {
  const dx = p.x - CENTER, dy = p.y - CENTER;
  const mx = (CENTER + p.x) / 2 - dy * 0.22, my = (CENTER + p.y) / 2 + dx * 0.22;
  return `M${CENTER} ${CENTER}Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x} ${p.y}`;
}

interface Box { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

export interface PlacedLabel {
  text: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
}

/** Width of a label in globe units. Deliberately generous: the real font varies between phones. */
export const labelWidth = (text: string, fs: number) => text.length * fs * 0.58 + 6;

/** The box a placed label covers (the inverse of how placeLabels positions the text). */
export function labelBox(l: PlacedLabel, fs: number): Box {
  const w = labelWidth(l.text, fs);
  const x = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
  return { x, y: l.y - fs * 0.8, w, h: fs };
}

const inSphere = (b: Box, r: number) =>
  [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].every(([px, py]) => Math.hypot(px - CENTER, py - CENTER) <= r);

/**
 * City labels with collision handling (from the v2 deck): try the outer side,
 * then the inner, above, below, then the corners; skip a label that fits
 * nowhere. A spot inside the sphere wins over one outside it; nothing ever
 * leaves the 600-unit picture. Coordinates are in globe space; `y` is the
 * text baseline. Lanterns are placed in order, so the newest should come last
 * only if it matters less: callers pass the ones they want.
 */
export function placeLabels(opts: {
  points: GlobePoint[];
  gold?: boolean[];
  want: (city: string) => boolean;
  scale?: number;
  homeLabel?: string;
  fontSize?: number;
}): { labels: PlacedLabel[]; fontSize: number } {
  const scale = opts.scale ?? 1;
  const fs = opts.fontSize ?? 19 * Math.max(1, scale * 0.95);
  const boxes: Box[] = [{ x: 282, y: 282, w: 36, h: 36 }];
  if (opts.homeLabel) {
    const w = labelWidth(opts.homeLabel, fs);
    boxes.push({ x: CENTER - w / 2, y: CENTER + 36 - fs * 0.8, w, h: fs });
  }
  opts.points.forEach((p, i) => {
    const g = (opts.gold?.[i] ? 1.5 : 1) * scale;
    boxes.push({ x: p.x - 9 * g, y: p.y - 15 * g, w: 18 * g, h: 23 * g });
  });
  const placed = new Map<string, { b: Box; k: string }>();
  const wanted = opts.points.map((p, i) => ({ p, i })).filter(({ p }) => opts.want(p.city));
  for (const strict of [true, false]) {
    for (const { p, i } of wanted) {
      if (placed.has(p.city)) continue;
      const g = (opts.gold?.[i] ? 1.5 : 1) * scale;
      const w = labelWidth(p.city, fs), h = fs, left = p.x < CENTER, gx = 13 * g;
      const at = {
        r: { x: p.x + gx, y: p.y - h * 0.62, w, h },
        l: { x: p.x - gx - w, y: p.y - h * 0.62, w, h },
        t: { x: p.x - w / 2, y: p.y - 17 * g - h, w, h },
        b: { x: p.x - w / 2, y: p.y + 12 * g, w, h },
        tr: { x: p.x + gx * 0.6, y: p.y - 17 * g - h, w, h },
        tl: { x: p.x - gx * 0.6 - w, y: p.y - 17 * g - h, w, h },
        br: { x: p.x + gx * 0.6, y: p.y + 12 * g, w, h },
        bl: { x: p.x - gx * 0.6 - w, y: p.y + 12 * g, w, h },
      };
      const order = left ? (["l", "r", "t", "b", "tl", "bl", "tr", "br"] as const) : (["r", "l", "t", "b", "tr", "br", "tl", "bl"] as const);
      for (const k of order) {
        const b = at[k];
        if (b.x < 0 || b.x + b.w > 600 || b.y < 0 || b.y + b.h > 600) continue;
        if (strict && !inSphere(b, SPHERE_R - 2)) continue;
        if (boxes.some((o) => overlaps(o, b))) continue;
        boxes.push(b);
        placed.set(p.city, { b, k });
        break;
      }
    }
  }
  const out: PlacedLabel[] = [];
  for (const { p } of wanted) {
    const hit = placed.get(p.city);
    if (!hit || out.some((l) => l.text === p.city)) continue;
    const { b, k } = hit;
    const anchor = k === "r" || k === "tr" || k === "br" ? "start" : k === "l" || k === "tl" || k === "bl" ? "end" : "middle";
    out.push({ text: p.city, x: anchor === "start" ? b.x : anchor === "end" ? b.x + b.w : b.x + b.w / 2, y: b.y + b.h * 0.8, anchor });
  }
  return { labels: out, fontSize: fs };
}
