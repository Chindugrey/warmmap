// Share cards (Storybook dusk): link preview / LinkedIn 1200x627 and
// WhatsApp Status / Instagram Story 1080x1920. Built only from the public,
// cities-only payload: the owner's first name, cities and numbers. Never a
// friend's name, never which question a city answered, never gold.
import type { PublicMap } from "./public-map";
import { computeKind, KIND_LINES } from "./kinds";
import { layoutGlobe, placeLabels, type GlobePoint, type PlacedLabel } from "./globe-layout";
import { SITE_URL } from "./site";
import { UNLOCK_AT } from "./questions";

export type CardFormat = "link" | "story";
export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  link: { width: 1200, height: 627 },
  story: { width: 1080, height: 1920 },
};

/** Only these query parameters are ever read; anything else (a name) is ignored. */
export function parseCardParams(sp: URLSearchParams): { id: string | null; format: CardFormat; download: boolean } {
  const id = sp.get("id");
  return {
    id: id && /^[A-Za-z0-9_-]{4,40}$/.test(id) ? id : null,
    format: sp.get("f") === "story" ? "story" : "link",
    download: sp.get("dl") === "1",
  };
}

export function cardUrl(id: string | null, format: CardFormat = "link", download = false): string {
  if (!id) return `${SITE_URL}/api/og`;
  return `${SITE_URL}/api/og?id=${encodeURIComponent(id)}${format === "story" ? "&f=story" : ""}${download ? "&dl=1" : ""}`;
}

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

export function cardModel(input: PublicMap | null, format: CardFormat): CardModel {
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
          { value: pub.stats.lanterns.toLocaleString("en-IN"), label: pub.stats.lanterns === 1 ? "person" : "people" },
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
