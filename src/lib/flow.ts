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
