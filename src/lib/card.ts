// Share cards (Storybook dusk): link preview / LinkedIn 1200x627 and
// WhatsApp Status / Instagram Story 1080x1920. Built only from the public,
// cities-only payload: the owner's first name, cities and numbers. Never a
// friend's name, never which question a city answered, never gold.
import type { PublicMap } from "./public-map";
import { computeKind, KIND_LINES } from "./kinds";
import { layoutGlobe, placeLabels, type GlobePoint, type PlacedLabel } from "./globe-layout";
import { SITE_URL } from "./site";
import { UNLOCK_AT } from "./questions";
import { V21A } from "./v21a";

export type CardFormat = "link" | "story";
export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  link: { width: 1200, height: 627 },
  story: { width: 1080, height: 1920 },
};

/** Only these query parameters are ever read; anything else (a name) is ignored. */
export function parseCardParams(sp: URLSearchParams): { id: string | null; format: CardFormat; download: boolean; version: string | null } {
  const id = sp.get("id");
  const v = sp.get("v");
  return {
    id: id && /^[A-Za-z0-9_-]{4,40}$/.test(id) ? id : null,
    format: sp.get("f") === "story" ? "story" : "link",
    download: sp.get("dl") === "1",
    version: v && /^[a-z0-9]{1,16}$/.test(v) ? v : null,
  };
}

/**
 * The map's picture version: its last change (a new lantern, a new key), in base 36. It goes in the card URL, so a
 * changed map gets a new address and a fresh picture while an unchanged one is drawn once per CDN edge.
 */
export const cardVersion = (updatedAt: Date) => updatedAt.getTime().toString(36);

export function cardUrl(id: string | null, format: CardFormat = "link", download = false, version: string | null = null): string {
  if (!id) return `${SITE_URL}/api/og`;
  return `${SITE_URL}/api/og?id=${encodeURIComponent(id)}${version ? `&v=${version}` : ""}${format === "story" ? "&f=story" : ""}${download ? "&dl=1" : ""}`;
}

/**
 * Cache-Control for a card. The CDN keeps each URL; the URL carries the map's version, so:
 *   versioned: the ?v= matches the map, the picture cannot change under that URL. Kept an hour on the CDN (a deleted
 *              map's card is gone within about that, as before), then served stale while one request redraws it.
 *   home:      the home card (no id). Only changes with a deploy, which starts a fresh CDN cache anyway.
 *   fallback:  no ?v=, an old ?v=, or no such map: short, so an update or a delete shows within a minute, yet a burst
 *              on an old link is still drawn about once a minute per edge.
 *   error:     never cached.
 */
export type CardCache = "versioned" | "home" | "fallback" | "error";
export const CARD_CACHE: Record<CardCache, string> = {
  versioned: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  home: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  fallback: "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
  error: "no-store",
};

export function cardCache(opts: { id: string | null; found: boolean; asked: string | null; current: string | null }): CardCache {
  if (!opts.id) return "home";
  if (!opts.found || !opts.asked || opts.asked !== opts.current) return "fallback";
  return "versioned";
}

/** Thread colour on the card: the same amber for every lantern. Gold is the owner's alone, so it never appears here. */
export const CARD_THREAD = "#F3B75E";

const SAMPLE = ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Pune", "Delhi", "London", "Singapore"];

export interface CardModel {
  format: CardFormat;
  title: string;
  titleSize: number;
  sub: string;
  nums: { value: string; label: string }[];
  kindTitle: string | null;
  kindShort: string | null;
  ask: string;
  site: string;
  globe: { points: GlobePoint[]; labels: PlacedLabel[]; labelSize: number; glyphScale: number };
}

// v21a on: the server only ever holds lanterns, never names, so the card says "lanterns" rather than a people count it cannot know.
export function cardModel(input: PublicMap | null, format: CardFormat, v21a = V21A): CardModel {
  // The full-map card unlocks at five lanterns; smaller (legacy) maps share the home card.
  const pub = input && input.stats.lanterns >= UNLOCK_AT ? input : null;
  const cities = pub ? pub.lanterns : SAMPLE;
  const home = pub ? pub.homeCity : "Bengaluru";
  const { points } = layoutGlobe(home, cities);
  const glyphScale = format === "link" ? 1.25 : 1.35;
  const { labels, fontSize } = placeLabels({ points, want: () => true, scale: glyphScale });

  const owner = pub?.ownerName?.trim();
  const title = pub ? (owner ? `${owner}'s Warm Map` : "A Warm Map") : "Who's in your corner?";
  const [maxSize, width] = format === "link" ? [60, 524] : [96, 936];
  const titleSize = Math.max(Math.round(maxSize * 0.56), Math.min(maxSize, Math.floor(width / (title.length * 0.46))));

  let kindTitle: string | null = null;
  let kindShort: string | null = null;
  if (pub?.kind) {
    kindTitle = KIND_LINES[pub.kind].title;
    const fromCities = computeKind({ homeCity: home, lanterns: cities.map((city) => ({ city })) });
    kindShort =
      pub.kind === "lantern-keeper" ? "One person holds a lot of this sky." : fromCities.kind === pub.kind ? fromCities.short : KIND_LINES[pub.kind].line;
  }

  return {
    format,
    title,
    titleSize,
    sub: pub ? "The people who've had my back." : "A small map of the people who have your back.",
    nums: pub
      ? [
          { value: pub.stats.lanterns.toLocaleString("en-IN"), label: v21a ? (pub.stats.lanterns === 1 ? "lantern" : "lanterns") : pub.stats.lanterns === 1 ? "person" : "people" },
          { value: pub.stats.cities.toLocaleString("en-IN"), label: pub.stats.cities === 1 ? "city" : "cities" },
          { value: pub.stats.km.toLocaleString("en-IN"), label: "km of thread" },
        ]
      : [],
    kindTitle,
    kindShort,
    ask: pub ? "Who's in your corner?" : "Light a lantern for everyone who has your back.",
    site: "warmmap.world",
    globe: { points, labels, labelSize: fontSize, glyphScale },
  };
}
