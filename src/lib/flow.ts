// Creation-flow helpers shared by the client screens.
import { QUESTION_COUNT } from "./questions";

/** Next question after `current` that is neither answered nor skipped; then the skipped ones; null when all are lit. */
export function nextQuestion(answered: Set<number>, skipped: Set<number>, current: number): number | null {
  for (let k = 1; k <= QUESTION_COUNT; k++) {
    const i = (current + k) % QUESTION_COUNT;
    if (!answered.has(i) && !skipped.has(i)) return i;
  }
  for (let k = 1; k <= QUESTION_COUNT; k++) {
    const i = (current + k) % QUESTION_COUNT;
    if (!answered.has(i)) return i;
  }
  return null;
}

/** Indices of the lanterns that end a chapter but not the whole list: where the progress row leaves a gap. */
export function chapterGaps(chapters: readonly number[]): number[] {
  return chapters.flatMap((c, i) => (i < chapters.length - 1 && chapters[i + 1] !== c ? [i] : []));
}

/** Who to thank first: "who haven't you thanked", then 2am, the first break, who showed up, then the rest. */
export function thankOrderFor(questionSet: number): number[] {
  // Set 2 (preview maps): question 12, then 1, 5, 3, 2, then the rest.
  if (questionSet === 2) return [11, 0, 4, 2, 1, 3, 5, 6, 7, 8, 9, 10];
  return [7, 0, 3, 2, 1, 4, 5, 6];
}

/** Default thank-you: says thanks without quoting the question, so the link is worth opening. */
export function thankMessage(name: string, url: string): string {
  return `${name}, one of the questions on my little map: it was you. Thank you. ${url}`;
}

export function mapShareText(cities: number, url: string): string {
  return `Made my Warm Map: the people who've had my back, across ${cities} ${cities === 1 ? "city" : "cities"}. Who's in your corner? ${url}`;
}

export const linkedInShareUrl = (url: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

export const whatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** How a share link reached a visitor (?s=): WhatsApp, LinkedIn, copied link, Story. The only values ever passed on. */
export const CHANNEL_TAGS = ["wa", "li", "cp", "st"] as const;

/** "Make yours" from a map: carries the inviter and, when the visitor arrived with an allowed ?s=, that tag. Anything else is dropped. */
export function makeYoursHref(mapId: string, s: string | null | undefined): string {
  const tag = (CHANNEL_TAGS as readonly string[]).includes(s ?? "") ? `&s=${s}` : "";
  return `/?invitedBy=${mapId}&via=map${tag}`;
}
