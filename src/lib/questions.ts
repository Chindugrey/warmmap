// Question set 3 (launch, 17 Nov 2026): 8 questions in 3 chapters, confirmed by Aadarsh.
// A lantern's index (ThankLink.entryIndex, Vouch.entryIndex) is its question index, 0..7.
// Set 2 (12 questions) stays below for maps saved on the preview, so their indices keep meaning.
export interface Question {
  chapter: 1 | 2 | 3;
  text: string;
}

export const CHAPTERS = {
  1: "The ones who were there",
  2: "The ones who opened doors",
  3: "The ones you'd build with",
} as const;

export const QUESTIONS: Question[] = [
  { chapter: 1, text: "Who would you call at 2am?" },
  { chapter: 1, text: "Who knew you before you were anyone?" },
  { chapter: 1, text: "Who showed up when things went wrong?" },
  { chapter: 2, text: "Who gave you your first real break?" },
  { chapter: 2, text: "Who opened a door you couldn't open yourself?" },
  { chapter: 2, text: "Who told you the truth when it was hard to hear?" },
  { chapter: 3, text: "Who would you start something with tomorrow?" },
  { chapter: 3, text: "Who haven't you thanked properly yet?" },
];

/** The set new maps are saved with. */
export const CURRENT_SET = 3;

export const QUESTIONS_V2: Question[] = [
  { chapter: 1, text: "Who would you call at 2am?" },
  { chapter: 1, text: "Who knew you before you were anyone?" },
  { chapter: 1, text: "Who showed up when things went wrong?" },
  { chapter: 1, text: "Who still makes you laugh at the worst times?" },
  { chapter: 2, text: "Who gave you your first real break?" },
  { chapter: 2, text: "Who opened a door you couldn't open yourself?" },
  { chapter: 2, text: "Who told you the truth when it was hard to hear?" },
  { chapter: 2, text: "Who taught you something you still use every week?" },
  { chapter: 3, text: "Who would you start something with tomorrow?" },
  { chapter: 3, text: "Whose advice do you take without asking twice?" },
  { chapter: 3, text: "Who do you wish everyone could meet?" },
  { chapter: 3, text: "Who haven't you thanked properly yet?" },
];

export const QUESTION_COUNT = QUESTIONS.length;
export const UNLOCK_AT = 5;

// Question set 1: maps saved before the v2 migration keep their own wording.
export const LEGACY_QUESTIONS = [
  "Who'd pick up your call at 2 a.m.?",
  "Who believed in you before it made sense?",
  "Which customer became a friend?",
  "Who's your customer champion?",
  "The boss you'd work for again?",
  "The colleague who covered for you?",
  "Who always says “let me introduce you”?",
  "The mentor who actually texts back?",
  "Who do you call first when you win?",
  "The friend in another city you miss most?",
  "Who made this year better?",
  "Who do you want to meet this year?",
];

/** Questions a map of this set was asked (8 for set 3, 12 for sets 2 and 1). */
export function questionCountFor(questionSet: number): number {
  return questionSet === 1 ? LEGACY_QUESTIONS.length : questionSet === 2 ? QUESTIONS_V2.length : QUESTION_COUNT;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** "twelve", "eight": small counts in words, so copy never hard-codes the number. */
export const numberWord = (n: number) => WORDS[n] ?? String(n);

export function questionFor(questionSet: number, index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (questionSet === 1) return LEGACY_QUESTIONS[index] ?? null;
  if (questionSet === 2) return QUESTIONS_V2[index]?.text ?? null;
  return QUESTIONS[index]?.text ?? null;
}

// Kept for the current creation form until the phase-2 one-card flow replaces it.
export const questions = QUESTIONS.map((q) => q.text);
