// Question set 2 (launch): the 12 questions from design-doc.md, in 3 chapters.
// A lantern's index (ThankLink.entryIndex, Vouch.entryIndex) is its question index, 0..11.
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

export function questionFor(questionSet: number, index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (questionSet === 1) return LEGACY_QUESTIONS[index] ?? null;
  return QUESTIONS[index]?.text ?? null;
}

// Kept for the current creation form until the phase-2 one-card flow replaces it.
export const questions = QUESTIONS.map((q) => q.text);
