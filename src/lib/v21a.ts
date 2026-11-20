// Warm Map v2.1a (docs: warmmap-v21-PLAN.md): sub-lines under the questions, the LinkedIn kit and the optional 2027 card.
// ALL of it sits behind one flag, default OFF: with the flag off none of this renders and the launch UI is unchanged.
// Turn it on by building with NEXT_PUBLIC_WM_V21A=1 (the value is inlined at build time). Nothing here touches the server:
// friends' names and the 2027 list stay on the phone, and the post is only ever copied or shared by the owner.
// Every string below is PROPOSED copy from the plan (§3.1, §3.3) until Aadarsh locks it.

export const V21A = process.env.NEXT_PUBLIC_WM_V21A === "1";

/** Sub-lines for the 8 locked questions, in QUESTIONS order (c1..c8). Owner's question card only. */
export const SUBLINES: readonly string[] = [
  "The one who'd pick up, and not ask why until you're okay.",
  "Before the title, the city, the plans. They were already there.",
  "A loss, a layoff, a bad month. The one who came without being asked.",
  "The first job, client, stage or yes that made the rest possible.",
  "An intro, a referral, a good word in a room you weren't in.",
  "The honest one. You were annoyed, then grateful.",
  "A company, a side project, a trip. You'd say yes before hearing the plan.",
  "The thank-you you keep meaning to send.",
];

/** One post line per question; {n} is the names, written without "@". */
export const POST_LINES: readonly string[] = [
  "{n} would get my 2am call.",
  "{n} knew me before I was anyone.",
  "{n} showed up when things went wrong.",
  "{n} gave me my first real break.",
  "{n} opened a door I couldn't open myself.",
  "{n} told me the truth when it was hard to hear.",
  "I'd start something with {n} tomorrow.",
  "{n}: I haven't thanked you properly yet. Thank you.",
];

export const KIT_COPY = {
  title: "Thank them in public",
  assure: "Nothing is posted until you press Post on LinkedIn.",
  keepOut: "Keep names out",
  byName: "Thank them by name",
  consent: "Named people will be tagged publicly; tag only people who'd be happy to be thanked in public.",
  tickFirst: "Tick the line above to copy your post.",
  share: "Share to LinkedIn",
  justCopy: "Just copy the post",
  copyPost: "Copy post",
  openLinkedIn: "Open LinkedIn",
  howTag: "On LinkedIn, type @ before each name and pick the person from the list. Pasted names don't tag.",
  find: "find profile",
  wishKicker: "Optional",
  wishTitle: "Who do you want a warm intro to in 2027?",
  wishSub: "A role or a company. Your corner might know the way in.",
  wishHint: "Not a person's name: this can go in a public post. It stays on this phone. We don't match or contact anyone.",
  wishInPost: "Add it to my LinkedIn post",
} as const;

export const WISH_MAX = 3;
export const WISH_LEN = 60;

export interface Friend {
  q: number;
  name: string;
  city: string;
}

/** "A", "A and B", "A, B and C". */
export const joinNames = (a: readonly string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** Distinct friends (the same name, any case, counts once). */
export const distinctPeople = (friends: readonly Friend[]) => new Set(friends.map((f) => f.name.trim().toLowerCase())).size;

/** The reveal's "people" number. Flag on: distinct names, counted on the phone (never sent). Flag off: lanterns, as at launch. */
export function revealPeople(names: readonly string[], lanterns: number, on = V21A) {
  const n = on ? distinctPeople(names.map((name) => ({ q: 0, name, city: "" }))) : lanterns;
  return { n, label: n === 1 ? "person" : "people" };
}

export interface PostInput {
  friends: readonly Friend[];
  cities: number;
  /** Only true after the owner ticked the consent line. Without it no name can reach the text. */
  names: boolean;
  wish: readonly string[];
  url: string;
}

export function linkedInPost({ friends, cities, names, wish, url }: PostInput): string {
  const c = `${cities} ${cities === 1 ? "city" : "cities"}`;
  const out: string[] = [];
  if (names) {
    out.push(`I made my Warm Map: the people who've had my back, across ${c}.`);
    const lines: string[] = [];
    POST_LINES.forEach((line, q) => {
      const ns = friends.filter((f) => f.q === q).map((f) => f.name);
      if (ns.length) lines.push(line.replace("{n}", joinNames(ns)));
    });
    out.push(lines.join("\n"), "Thank you. I don't say it enough.");
  } else {
    const n = distinctPeople(friends);
    out.push(`I made my Warm Map: ${n} ${n === 1 ? "person who's" : "people who've"} had my back, across ${c}. You know who you are. Thank you.`);
  }
  if (wish.length) out.push(`In 2027 I'd love a warm intro to ${joinNames(wish)}. If you know the way in, I'd be grateful.`);
  out.push(`Who's in your corner? ${url}`);
  return out.join("\n\n");
}

export interface TagRow {
  key: string;
  name: string;
  city: string;
}

/** One row per distinct friend, for the tag checklist. */
export function tagRows(friends: readonly Friend[]): TagRow[] {
  const rows = new Map<string, TagRow>();
  for (const f of friends) {
    const key = f.name.trim().toLowerCase();
    if (!rows.has(key)) rows.set(key, { key, name: f.name, city: f.city });
  }
  return [...rows.values()];
}

export const findProfileUrl = (name: string, city: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${city}`)}`;

export const LINKEDIN_COMPOSE_URL = "https://www.linkedin.com/feed/?shareActive=true";

/** A wish-list entry: trimmed, 3 to 60 characters; null when too short. */
export function cleanWish(v: string): string | null {
  const t = v.trim().replace(/\s+/g, " ").slice(0, WISH_LEN);
  return t.length >= 3 ? t : null;
}
