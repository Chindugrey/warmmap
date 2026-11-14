// Validation for "Show me" (POST /api/maps) and owner edits (PATCH).
// Strict on purpose: an unexpected field (for example a friend's name) is a
// 400, so a client bug can never put names on the server.
import { citiesByName } from "./cities";
import { QUESTION_COUNT, UNLOCK_AT } from "./questions";
import type { StoredEntry } from "./entries";

export const VIAS = ["cold", "map", "thanks", "seed"] as const;
export type Via = (typeof VIAS)[number];

export interface SaveInput {
  homeCity: string;
  ownerName: string;
  entries: StoredEntry[];
  repeatMax: number;
  invitedBy: string | null;
  via: Via;
}

export interface PatchInput {
  ownerName?: string;
  entries?: StoredEntry[];
  repeatMax?: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const only = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const fail = (error: string) => ({ ok: false as const, error });

function ownerName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 1 || t.length > 24) return null;
  if (/[\u0000-\u001f\u007f<>]/.test(t)) return null;
  return t;
}

function entries(v: unknown, allowCarried: boolean): Result<{ list: StoredEntry[]; answered: number }> {
  if (!Array.isArray(v)) return fail("entries must be a list");
  if (v.length > QUESTION_COUNT + 1) return fail("too many lanterns");
  const list: StoredEntry[] = [];
  const seen = new Set<number>();
  let carried = 0;
  for (const e of v) {
    if (!isObj(e) || typeof e.city !== "string" || !citiesByName[e.city]) return fail("unknown city");
    if (e.carried === true) {
      if (!only(e, ["city", "carried"])) return fail("unexpected field in a lantern");
      if (!allowCarried) return fail("a carried lantern needs the map that brought you");
      if (++carried > 1) return fail("only one carried lantern");
      list.push({ city: e.city, carried: true });
      continue;
    }
    if (!only(e, ["city", "questionIndex"])) return fail("unexpected field in a lantern");
    const q = e.questionIndex;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 0 || q >= QUESTION_COUNT) return fail("bad question");
    if (seen.has(q)) return fail("question answered twice");
    seen.add(q);
    list.push({ city: e.city, questionIndex: q });
  }
  if (seen.size < UNLOCK_AT) return fail(`answer at least ${UNLOCK_AT} questions`);
  return { ok: true, value: { list, answered: seen.size } };
}

function repeatMax(v: unknown, answered: number): number | null {
  if (v === undefined) return 1;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > answered) return null;
  return v;
}

export function parseSaveInput(body: unknown): Result<SaveInput> {
  if (!isObj(body)) return fail("invalid body");
  if (!only(body, ["homeCity", "ownerName", "entries", "repeatMax", "invitedBy", "via"])) return fail("unexpected field");
  if (typeof body.homeCity !== "string" || !citiesByName[body.homeCity]) return fail("unknown home city");
  const name = ownerName(body.ownerName);
  if (!name) return fail("your first name, 1 to 24 characters");
  let invitedBy: string | null = null;
  if (body.invitedBy !== undefined) {
    if (typeof body.invitedBy !== "string" || !/^[a-z0-9]{6,32}$/i.test(body.invitedBy)) return fail("bad invitedBy");
    invitedBy = body.invitedBy;
  }
  const via = body.via === undefined ? "cold" : body.via;
  if (!VIAS.includes(via as Via)) return fail("bad via");
  const es = entries(body.entries, invitedBy !== null);
  if (!es.ok) return es;
  const r = repeatMax(body.repeatMax, es.value.answered);
  if (r === null) return fail("bad repeatMax");
  return {
    ok: true,
    value: { homeCity: body.homeCity, ownerName: name, entries: es.value.list, repeatMax: r, invitedBy, via: via as Via },
  };
}

export function parsePatchInput(body: unknown, ctx: { hasInviter: boolean }): Result<PatchInput> {
  if (!isObj(body)) return fail("invalid body");
  if (!only(body, ["ownerName", "entries", "repeatMax"])) return fail("unexpected field");
  const out: PatchInput = {};
  if (body.ownerName !== undefined) {
    const n = ownerName(body.ownerName);
    if (!n) return fail("your first name, 1 to 24 characters");
    out.ownerName = n;
  }
  if (body.entries !== undefined) {
    const es = entries(body.entries, ctx.hasInviter);
    if (!es.ok) return es;
    out.entries = es.value.list;
    const r = repeatMax(body.repeatMax, es.value.answered);
    if (r === null) return fail("bad repeatMax");
    out.repeatMax = r;
  } else if (body.repeatMax !== undefined) {
    return fail("repeatMax comes with entries");
  }
  return { ok: true, value: out };
}
