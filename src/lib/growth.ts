// Warm Map analytics, phase 1: the pure math behind the admin's creators list,
// virality, channel funnel, warmth ranking and per-map timeline. No database
// here (see growth-load.ts), so every number can be unit-tested on fixtures.
//
// Privacy: the only name anywhere in this file is a map owner's own FIRST name
// (already public on their map). Friends' names never reach the server, and no
// device or IP hash is ever read for analytics.
import { istDayStart } from "./dashboard";

const DAY = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;

export const round2 = (v: number) => Math.round(v * 100) / 100;
/** a / b as a whole percentage, or null when b is 0. */
export const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null);

/** The owner's first name only: the first word of what they typed. */
export function firstName(ownerName: string | null | undefined): string {
  return (ownerName ?? "").trim().split(/\s+/)[0] ?? "";
}

// ---------------------------------------------------------------------------
// Invite forest: each map points at the map that invited it (invitedByMapId).
// A pointer to a deleted map is cleared by the database (SET NULL), so such a
// map is a root. Cycles cannot happen through the app; we still guard.

export interface MapNode {
  id: string;
  parent: string | null;
  createdAt: Date;
  arrivedVia: string;
}

export interface Forest {
  depth: Map<string, number>; // 0 = no inviter
  root: Map<string, string>;
  children: Map<string, string[]>;
  descendants: Map<string, number>; // all generations below, not counting itself
}

export function buildForest(nodes: MapNode[]): Forest {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = (id: string) => {
    const p = byId.get(id)?.parent ?? null;
    return p && byId.has(p) && p !== id ? p : null;
  };
  const depth = new Map<string, number>();
  const root = new Map<string, string>();
  for (const n of nodes) {
    if (depth.has(n.id)) continue;
    // Walk up until a known node or a root, then unwind.
    const path: string[] = [];
    const onPath = new Set<string>();
    let cur: string | null = n.id;
    while (cur && !depth.has(cur) && !onPath.has(cur)) {
      path.push(cur);
      onPath.add(cur);
      cur = parentOf(cur);
    }
    let d: number;
    let r: string;
    if (cur && depth.has(cur)) {
      d = depth.get(cur)!;
      r = root.get(cur)!;
    } else {
      // Reached a root (cur null) or a cycle (cur on path): the last path node is treated as the root.
      const top = path.pop()!;
      depth.set(top, 0);
      root.set(top, top);
      d = 0;
      r = top;
    }
    for (let i = path.length - 1; i >= 0; i--) {
      d += 1;
      depth.set(path[i], d);
      root.set(path[i], r);
    }
  }
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    const p = parentOf(n.id);
    if (p && depth.get(n.id)! > 0) {
      const list = children.get(p);
      if (list) list.push(n.id);
      else children.set(p, [n.id]);
    }
  }
  const descendants = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const deepestFirst = [...nodes].sort((a, b) => depth.get(b.id)! - depth.get(a.id)!);
  for (const n of deepestFirst) {
    const p = parentOf(n.id);
    if (p && depth.get(n.id)! > 0) descendants.set(p, descendants.get(p)! + 1 + descendants.get(n.id)!);
  }
  return { depth, root, children, descendants };
}

export function generationCounts(f: Forest): { generation: number; maps: number }[] {
  const c = new Map<number, number>();
  for (const d of f.depth.values()) c.set(d, (c.get(d) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([generation, maps]) => ({ generation, maps }));
}

export interface TreeRow {
  rootId: string;
  rootCreatedAt: string;
  size: number; // maps in the tree, including the root
  generations: number; // deepest generation below the root (0 = the root alone)
  fromMap: number; // maps in the tree that arrived from a shared map
  fromThanks: number; // ... from a thank-you
}

/** The biggest invite trees (only trees with at least one invited map). */
export function topTrees(nodes: MapNode[], f: Forest, limit = 10): TreeRow[] {
  const agg = new Map<string, TreeRow>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    const r = f.root.get(n.id)!;
    let row = agg.get(r);
    if (!row) {
      row = { rootId: r, rootCreatedAt: byId.get(r)!.createdAt.toISOString(), size: 0, generations: 0, fromMap: 0, fromThanks: 0 };
      agg.set(r, row);
    }
    row.size += 1;
    const d = f.depth.get(n.id)!;
    if (d > row.generations) row.generations = d;
    if (d > 0 && n.arrivedVia === "map") row.fromMap += 1;
    if (d > 0 && n.arrivedVia === "thanks") row.fromThanks += 1;
  }
  return [...agg.values()]
    .filter((t) => t.size > 1)
    .sort((a, b) => b.size - a.size || b.generations - a.generations || a.rootCreatedAt.localeCompare(b.rootCreatedAt))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Viral factor = new maps per map: maps that carry another map's id / all maps.

export function viralFactor(nodes: MapNode[], f: Forest): { maps: number; invited: number; inviters: number; k: number } {
  let invited = 0;
  for (const n of nodes) if (f.depth.get(n.id)! > 0) invited += 1;
  return { maps: nodes.length, invited, inviters: f.children.size, k: nodes.length ? round2(invited / nodes.length) : 0 };
}

/** Monday 00:00 IST of the IST week containing `t`. */
export function istWeekStart(t: Date): Date {
  const day = istDayStart(t);
  const weekday = new Date(day.getTime() + IST_MS).getUTCDay(); // 0 = Sunday
  return new Date(day.getTime() - ((weekday + 6) % 7) * DAY);
}

export interface CohortRow {
  start: string; // ISO instant of 00:00 IST
  maps: number; // maps created in the period
  invitedMaps: number; // ... of which carried another map's id
  children: number; // maps (any time) invited directly by this cohort's maps
  descendants: number; // all generations below this cohort's maps
  k: number; // children / maps: new maps per map for this cohort
}

/**
 * Viral factor by cohort: maps grouped by the IST day or week they were made.
 * k = direct children / cohort size. Recent cohorts have had less time to
 * spread, so their k is still rising.
 */
export function cohorts(nodes: MapNode[], f: Forest, unit: "day" | "week", now: Date, periods: number): CohortRow[] {
  const startOf = unit === "day" ? istDayStart : istWeekStart;
  const step = unit === "day" ? DAY : 7 * DAY;
  const first = startOf(now).getTime() - (periods - 1) * step;
  const rows: CohortRow[] = Array.from({ length: periods }, (_, i) => ({
    start: new Date(first + i * step).toISOString(), maps: 0, invitedMaps: 0, children: 0, descendants: 0, k: 0,
  }));
  for (const n of nodes) {
    // Days and weeks are a fixed length from `first` (IST has no daylight saving).
    const i = Math.floor((n.createdAt.getTime() - first) / step);
    if (i < 0 || i >= periods) continue;
    const r = rows[i];
    r.maps += 1;
    if (f.depth.get(n.id)! > 0) r.invitedMaps += 1;
    r.children += f.children.get(n.id)?.length ?? 0;
    r.descendants += f.descendants.get(n.id) ?? 0;
  }
  for (const r of rows) r.k = r.maps ? round2(r.children / r.maps) : 0;
  return rows;
}

// ---------------------------------------------------------------------------
// Channel funnel per ?s= tag: share -> open -> "Make yours" -> saved map.

export interface ChannelCounts { channel: string; label: string; shares: number; opens: number; makeYours: number }
export interface ChannelFunnelRow extends ChannelCounts {
  openPerShare: number | null; // %
  makeYoursPerOpen: number | null; // %
  savedEst: number; // ESTIMATED saved maps (see channelFunnel)
  savedEstPerShare: number | null; // %, from the estimate
  kEst: number; // ESTIMATED new maps per map through this channel
}

/**
 * A saved map does not record the ?s= tag it arrived with (no schema change in
 * phase 1), so "saved" per channel is an ESTIMATE: the channel's "Make yours"
 * taps x the overall rate at which "Make yours" became a saved invited map
 * (maps with a live inviter / all "Make yours" taps, capped at 100%). The rate
 * is the same for every channel, so it is reported once (saveRate), not per row.
 * kEst = savedEst / all maps.
 */
export function channelFunnel(rows: ChannelCounts[], t: { makeYoursAll: number; invitedSaved: number; mapsTotal: number }): {
  saveRate: number; // 0..1
  rows: ChannelFunnelRow[];
} {
  const saveRate = t.makeYoursAll > 0 ? Math.min(1, t.invitedSaved / t.makeYoursAll) : 0;
  return {
    saveRate: round2(saveRate),
    rows: rows.map((r) => {
      const savedEst = Math.round(r.makeYours * saveRate);
      return {
        ...r,
        openPerShare: pct(r.opens, r.shares),
        makeYoursPerOpen: pct(r.makeYours, r.opens),
        savedEst,
        savedEstPerShare: pct(savedEst, r.shares),
        kEst: t.mapsTotal ? Math.round((savedEst / t.mapsTotal) * 1000) / 1000 : 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Warmth: a simple, documented score for ranking CREATORS (never connectors).

export const WARMTH_WEIGHTS = { thankLinks: 1, tiesBack: 2, shares: 1, spawnedDirect: 3, spawnedDeeper: 1 } as const;
export const WARMTH_FORMULA =
  "warmth = 1 x thank-links sent + 2 x ties-back received + 1 x shares (WhatsApp taps left out: a thank-you send is already a thank-link) + 3 x maps spawned directly + 1 x maps spawned in later generations";

export interface WarmthParts { thankLinks: number; tiesBack: number; shares: number; spawnedDirect: number; spawnedAll: number }

export function warmth(p: WarmthParts): number {
  const W = WARMTH_WEIGHTS;
  return (
    W.thankLinks * p.thankLinks +
    W.tiesBack * p.tiesBack +
    W.shares * p.shares +
    W.spawnedDirect * p.spawnedDirect +
    W.spawnedDeeper * Math.max(0, p.spawnedAll - p.spawnedDirect)
  );
}

// ---------------------------------------------------------------------------
// Creators list: one row per map. First name, city, dates, counts. Nothing else.
// The rows are aggregated, filtered, sorted and paged in SQL (growth-load.ts).

/** Invite trees are walked in SQL to this depth at most; deeper counts are shown as "N+". */
export const TREE_DEPTH_CAP = 50;
/** The CSV export stops at this many rows (and says so). */
export const CSV_ROW_CAP = 50_000;

export const SHARE_CHANNELS = ["whatsapp", "linkedin", "copy", "story", "native"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export interface CreatorRow {
  id: string; // internal map id (not a public address): links to the admin timeline only
  firstName: string;
  homeCity: string;
  createdAt: string;
  kind: string;
  lanterns: number;
  cities: number;
  km: number;
  gold: number;
  thankLinks: number;
  shares: Record<ShareChannel, number>;
  sharesTotal: number;
  shares30d: number; // share taps, every channel, in the last 30 IST calendar days
  opens: number;
  spawnedDirect: number;
  spawnedAll: number;
  spawnedAllCapped: boolean; // the tree goes deeper than TREE_DEPTH_CAP: spawnedAll is a lower bound
  arrivedVia: string;
  warmth: number;
}

export const CREATOR_SORTS = [
  "createdAt", "firstName", "homeCity", "kind", "lanterns", "cities", "km", "gold", "thankLinks",
  "sharesTotal", "opens", "spawnedDirect", "spawnedAll", "arrivedVia", "warmth",
] as const;
export type CreatorSort = (typeof CREATOR_SORTS)[number];

export interface CreatorQuery { q: string; sort: CreatorSort; dir: "asc" | "desc"; page: number; perPage: number }

export function parseCreatorQuery(sp: URLSearchParams): CreatorQuery {
  const sort = (CREATOR_SORTS as readonly string[]).includes(sp.get("sort") ?? "") ? (sp.get("sort") as CreatorSort) : "createdAt";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.min(100_000, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  const q = (sp.get("q") ?? "").trim().slice(0, 60);
  return { q, sort, dir, page, perPage: 50 };
}

/** An ILIKE pattern that matches `q` as a plain substring (%, _ and \ in q are literal). */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
}

/** "12" or "12+" when the count stopped at the depth cap. */
export const capped = (n: number, isCapped: boolean) => `${n}${isCapped ? "+" : ""}`;

/** IST "19 Nov 2026, 14:05" (or the date alone). */
export function istStamp(iso: string | Date, dateOnly = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const opts: Intl.DateTimeFormatOptions = dateOnly
    ? { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }
    : { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat("en-IN", opts).format(d);
}

// CSV of the creators list: first name, city, dates, counts. No ids, no hashes.
export const CREATOR_CSV_COLUMNS: [string, (r: CreatorRow) => string | number][] = [
  ["first_name", (r) => r.firstName],
  ["home_city", (r) => r.homeCity],
  ["created_ist", (r) => istStamp(r.createdAt, r.arrivedVia === "thanks")],
  ["kind", (r) => r.kind],
  ["arrived_via", (r) => r.arrivedVia],
  ["lanterns", (r) => r.lanterns],
  ["cities", (r) => r.cities],
  ["km", (r) => r.km],
  ["gold", (r) => r.gold],
  ["thank_links", (r) => r.thankLinks],
  ["shares_whatsapp", (r) => r.shares.whatsapp],
  ["shares_linkedin", (r) => r.shares.linkedin],
  ["shares_copy", (r) => r.shares.copy],
  ["shares_story", (r) => r.shares.story],
  ["shares_native", (r) => r.shares.native],
  ["opens", (r) => r.opens],
  ["maps_spawned_direct", (r) => r.spawnedDirect],
  ["maps_spawned_all", (r) => capped(r.spawnedAll, r.spawnedAllCapped)],
  ["warmth", (r) => r.warmth],
  ["share_taps_last_30_days_ist", (r) => r.shares30d],
];

// ---------------------------------------------------------------------------
// Per-map timeline: what happened to one map, in order. Timestamps and counts.
//
// Privacy: only the map's own thank-links and ties keep their exact time. Opens,
// shares, "owner saw gold", reports and spawned maps are DAILY COUNTS (IST day),
// never exact times: an exact open or child timestamp could be lined up with a
// tie-back, or matched against the creators list, to name who thanked whom.

export interface TimelineItem { at: string; dateOnly?: boolean; what: string; detail: string }

/** One IST day's count of one kind of thing. `day` is YYYY-MM-DD in IST. */
export interface DayCount { day: string; key: string | null; count: number }

export interface TimelineInput {
  map: {
    createdAt: Date; updatedAt: Date; arrivedVia: string; lanterns: number; cities: number; kind: string | null; homeCity: string;
    generation: number; generationCapped: boolean; descendants: number; descendantsCapped: boolean;
  };
  thankLinks: { createdAt: Date; usedAt: Date | null }[];
  vouches: { createdAt: Date; seenByOwnerAt: Date | null }[];
  daily: { event: string; days: DayCount[] }[]; // share (key = channel), map_view (key = s tag), gold_seen, link_report
  spawned: DayCount[]; // key = arrivedVia of the spawned maps
}

/** 00:00 IST of an IST calendar day, as an ISO instant. */
export const istDayIso = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString();

const SHARE_LABEL: Record<string, string> = { whatsapp: "WhatsApp", linkedin: "LinkedIn", copy: "copied link", story: "Story picture", native: "share sheet" };
const TAG_LABEL: Record<string, string> = { wa: "WhatsApp", li: "LinkedIn", cp: "copied link", st: "Story picture" };
const VIA_LABEL: Record<string, string> = { map: "via shared map", thanks: "via thank-you", cold: "with no route", seed: "seeded" };
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function byDay(days: DayCount[]): Map<string, DayCount[]> {
  const m = new Map<string, DayCount[]>();
  for (const d of days) {
    const list = m.get(d.day);
    if (list) list.push(d);
    else m.set(d.day, [d]);
  }
  return m;
}

// Largest first; untagged (null key) last on a tie.
const breakdown = (rows: DayCount[], label: (k: string | null) => string) =>
  [...rows].sort((a, b) => b.count - a.count || (a.key ?? "\uffff").localeCompare(b.key ?? "\uffff")).map((r) => `${r.count} ${label(r.key)}`).join(", ");

export function timeline(t: TimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];
  const m = t.map;
  // A map started from a thank-you keeps a date-only stamp (by design).
  const created = { at: m.createdAt.toISOString(), dateOnly: m.arrivedVia === "thanks" };
  items.push({
    ...created,
    what: "Created",
    detail:
      `arrived via ${m.arrivedVia}, generation ${capped(m.generation, m.generationCapped)}, home ${m.homeCity}${m.kind ? `, ${m.kind}` : ""}; ` +
      `${capped(m.descendants, m.descendantsCapped)} map${m.descendants === 1 && !m.descendantsCapped ? "" : "s"} below it in all generations` +
      (m.generationCapped || m.descendantsCapped ? ` (depth capped at ${TREE_DEPTH_CAP})` : ""),
  });
  items.push({ ...created, what: "Lanterns", detail: `${plural(m.lanterns, "lantern")} across ${plural(m.cities, "city", "cities")} at save` });
  if (m.updatedAt.getTime() - m.createdAt.getTime() > 60_000) {
    items.push({ at: m.updatedAt.toISOString(), what: "Last changed", detail: "edited by its owner (lanterns, name or key)" });
  }
  for (const l of t.thankLinks) items.push({ at: l.createdAt.toISOString(), what: "Thank-link sent", detail: l.usedAt ? "tied back" : "" });
  for (const v of t.vouches) {
    items.push({ at: v.createdAt.toISOString(), what: "Tied back (gold)", detail: v.seenByOwnerAt ? `owner saw it on ${istStamp(v.seenByOwnerAt, true)}` : "not seen by the owner yet" });
  }
  const sum = (rows: DayCount[]) => rows.reduce((a, r) => a + r.count, 0);
  for (const { event, days } of t.daily) {
    for (const [day, rows] of byDay(days)) {
      const at = istDayIso(day);
      const n = sum(rows);
      if (event === "share") items.push({ at, dateOnly: true, what: `Shared ${plural(n, "time")}`, detail: breakdown(rows, (k) => SHARE_LABEL[k ?? ""] ?? "untagged") });
      else if (event === "map_view") items.push({ at, dateOnly: true, what: `Opened ${plural(n, "time")}`, detail: breakdown(rows, (k) => (k ? TAG_LABEL[k] ?? "other" : "untagged")) });
      else if (event === "gold_seen") items.push({ at, dateOnly: true, what: "Owner saw new gold", detail: `on ${plural(n, "visit")}` });
      else if (event === "link_report") items.push({ at, dateOnly: true, what: `Link reported ${plural(n, "time")}`, detail: "" });
    }
  }
  for (const [day, rows] of byDay(t.spawned)) {
    items.push({ at: istDayIso(day), dateOnly: true, what: `Spawned ${plural(sum(rows), "map")}`, detail: breakdown(rows, (k) => VIA_LABEL[k ?? ""] ?? String(k)) });
  }
  // A daily count belongs to the whole IST day, so it sorts after that day's exact events.
  const counted = new Set(items.filter((i) => i.dateOnly && i.what !== "Created" && i.what !== "Lanterns"));
  const key = (i: TimelineItem) => (counted.has(i) ? new Date(new Date(i.at).getTime() + DAY - 1).toISOString() : i.at);
  return items.sort((a, b) => key(a).localeCompare(key(b)));
}
