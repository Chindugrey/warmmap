// Launch scoreboard (/admin/dashboard/launch): the co-founder's launch targets over one
// window of time. Pure math on fixtures (the database side is launch-load.ts).
//
// Privacy: no name of any kind is read or returned here. Maps arrive as ids, routes,
// times and their lanterns' cities; links and ties as times; channels as counts.
import { pct, round2, type ChannelCounts } from "./growth";
import { isCarried, type StoredEntry } from "./entries";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const IST_MS = 5.5 * HOUR;

/** 18:30 IST, Wednesday 25 Nov 2026: launch. */
export const LAUNCH_START = "2026-11-25T13:00:00.000Z";
export const TIE_WINDOW_MS = 48 * HOUR;
export const TIE_MIN_LINKS = 20; // fewer links old enough to judge: "too early"
export const HOURLY_ROW_CAP = 24 * 14;

export const TARGETS = {
  maps: 250,
  k: 0.5,
  tieBackPct: 20,
  openPerSharePct: 30,
  startPerOpenPct: 25,
  fridayMaps: 200,
  fridayLanterns: 1000,
} as const;

export interface LaunchWindow { from: Date; to: Date; note: string | null }

/** ?from= / ?to= ISO overrides; a missing or unreadable value falls back to launch .. now. */
export function parseLaunchWindow(sp: URLSearchParams, now: Date): LaunchWindow {
  const read = (k: string) => {
    const v = sp.get(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const f = read("from");
  const t = read("to");
  const notes: string[] = [];
  if (f === undefined) notes.push("?from= was not a date, so the launch start is used");
  if (t === undefined) notes.push("?to= was not a date, so now is used");
  let from = f ?? new Date(LAUNCH_START);
  let to = t ?? now;
  if (from > to) {
    [from, to] = [to, from];
    notes.push("from was after to, so the two were swapped");
  }
  return { from, to, note: notes.length ? notes.join("; ") + "." : null };
}

/** 00:00 UTC of the UTC day of `t`: where a thank-you map's date-only stamp would land. */
export const utcDayStart = (t: Date) => new Date(Math.floor(t.getTime() / DAY) * DAY);

export interface LaunchMap {
  id: string;
  invitedByMapId: string | null; // the database clears it when the inviting map is deleted
  createdAt: Date;
  arrivedVia: string;
  entries: StoredEntry[];
}

/**
 * In the window, seed maps left out. A map made from a thank-you keeps a date-only stamp
 * (00:00 UTC of its day), so it counts when that stamp is on or after 00:00 UTC of the
 * window's first day: such a map made earlier that same UTC day is counted too.
 */
export function mapInWindow(m: Pick<LaunchMap, "createdAt" | "arrivedVia">, w: Pick<LaunchWindow, "from" | "to">): boolean {
  if (m.arrivedVia === "seed") return false;
  const from = m.arrivedVia === "thanks" ? utcDayStart(w.from) : w.from;
  return m.createdAt >= from && m.createdAt <= w.to;
}

export type Status = "ok" | "below" | "early" | "none";
export interface Metric { value: number | null; target: number; status: Status }

const judge = (value: number | null, target: number): Metric => ({ value, target, status: value === null ? "none" : value >= target ? "ok" : "below" });

export const lanternsOf = (entries: StoredEntry[]) => entries.filter((e) => !isCarried(e));

export interface LaunchLink { createdAt: Date; usedAt: Date | null }
export interface LaunchVouch { createdAt: Date }

export interface LaunchInput {
  window: LaunchWindow;
  now: Date;
  maps: LaunchMap[]; // may include maps outside the window: filtered here
  links: LaunchLink[]; // thank-links on non-seed maps made in the window
  vouches: LaunchVouch[]; // ties (a "Tie it back" tap on a thank-link) on non-seed maps in the window
  channels: ChannelCounts[]; // wa / li / cp / st, then native (shares only; a native share carries no tag)
  linkedinPosts: number | null; // null: no EngagementLog table on this deployment
  countryOf: (city: string) => string | null;
}

export interface ChannelLine extends ChannelCounts {
  openPerShare: number | null;
  startPerOpen: number | null;
  openStatus: Status;
  startStatus: Status;
}

export interface HourRow { hour: string; maps: number; lanterns: number; tieBacks: number } // hour = ISO instant of its start

export interface Scoreboard {
  generatedAt: string;
  from: string;
  to: string;
  windowNote: string | null;
  maps: Metric & { seedLeftOut: number; fromThanks: number };
  k: Metric & { maps: number; invited: number; inviters: number; perInviter: number | null };
  tieBack: Metric & { links: number; eligible: number; tiedIn48h: number; tiedAnyTime: number; asOf: string };
  funnel: { overall: ChannelLine; rows: ChannelLine[] };
  lanterns: number;
  countries: number;
  citiesUnplaced: number; // lantern cities with no country in the city data
  friday: { maps: number; lanterns: number; post: "numbers" | "learned"; line: string };
  linkedinPosts: number | null;
  hourly: { rows: HourRow[]; truncated: boolean; dateOnlyMaps: number; dateOnlyLanterns: number };
}

function line(c: ChannelCounts, opensKnown: boolean): ChannelLine {
  const openPerShare = opensKnown ? pct(c.opens, c.shares) : null;
  const startPerOpen = opensKnown ? pct(c.makeYours, c.opens) : null;
  return {
    ...c,
    openPerShare,
    startPerOpen,
    openStatus: judge(openPerShare, TARGETS.openPerSharePct).status,
    startStatus: judge(startPerOpen, TARGETS.startPerOpenPct).status,
  };
}

/** Floor to the start of the IST hour (IST is a whole number of hours plus 30 min from UTC). */
const istHourStart = (t: number) => Math.floor((t + IST_MS) / HOUR) * HOUR - IST_MS;

export function scoreboard(x: LaunchInput): Scoreboard {
  const w = x.window;
  const inWin = x.maps.filter((m) => mapInWindow(m, w));
  const seedLeftOut = x.maps.filter((m) => m.arrivedVia === "seed" && m.createdAt >= w.from && m.createdAt <= w.to).length;

  // 1. Maps.
  const maps = { ...judge(inWin.length, TARGETS.maps), seedLeftOut, fromThanks: inWin.filter((m) => m.arrivedVia === "thanks").length };

  // 2. K: the viral factor's "new maps per map" (growth.ts viralFactor), on the window's maps.
  const invitedMaps = inWin.filter((m) => m.invitedByMapId);
  const inviters = new Set(invitedMaps.map((m) => m.invitedByMapId)).size;
  const kVal = inWin.length ? round2(invitedMaps.length / inWin.length) : null;
  const k = {
    ...judge(kVal, TARGETS.k), maps: inWin.length, invited: invitedMaps.length, inviters,
    perInviter: inviters ? round2(invitedMaps.length / inviters) : null,
  };

  // 3. Tie-back rate within 48 h, over links at least 48 h old at the end of the window (or now, if sooner).
  const asOf = new Date(Math.min(w.to.getTime(), x.now.getTime()));
  const links = x.links.filter((l) => l.createdAt >= w.from && l.createdAt <= w.to);
  const eligible = links.filter((l) => asOf.getTime() - l.createdAt.getTime() >= TIE_WINDOW_MS);
  const tiedIn48h = eligible.filter((l) => l.usedAt && l.usedAt.getTime() - l.createdAt.getTime() <= TIE_WINDOW_MS).length;
  const ratePct = pct(tiedIn48h, eligible.length);
  const tieMetric = judge(ratePct, TARGETS.tieBackPct);
  const tieBack = {
    ...tieMetric,
    status: (eligible.length < TIE_MIN_LINKS ? "early" : tieMetric.status) as Status,
    links: links.length, eligible: eligible.length, tiedIn48h,
    tiedAnyTime: links.filter((l) => l.usedAt && l.usedAt <= asOf).length,
    asOf: asOf.toISOString(),
  };

  // 4. Funnel. Opens and "Make yours" are attributed by the link's ?s= tag; a share-sheet
  // (native) share carries no tag, so its opens cannot be told apart.
  const rows = x.channels.map((c) => line(c, c.channel !== "native"));
  const tagged = rows.filter((r) => r.channel !== "native");
  const sum = (k: "shares" | "opens" | "makeYours", rs: ChannelCounts[]) => rs.reduce((a, r) => a + r[k], 0);
  const overall = line({ channel: "all", label: "All channels", shares: sum("shares", rows), opens: sum("opens", tagged), makeYours: sum("makeYours", tagged) }, true);

  // 5. Lanterns, countries, the Friday gate.
  let lanterns = 0;
  const countries = new Set<string>();
  const unplaced = new Set<string>();
  for (const m of inWin) {
    for (const e of lanternsOf(m.entries)) {
      lanterns += 1;
      const c = x.countryOf(e.city);
      if (c) countries.add(c);
      else unplaced.add(e.city);
    }
  }
  const post = inWin.length >= TARGETS.fridayMaps && lanterns >= TARGETS.fridayLanterns ? "numbers" : "learned";
  const friday = {
    maps: inWin.length, lanterns, post: post as "numbers" | "learned",
    line: `${lanterns.toLocaleString("en-IN")} lantern${lanterns === 1 ? "" : "s"} lit across ${countries.size} countr${countries.size === 1 ? "y" : "ies"}`,
  };

  // Hourly (IST): maps with an exact time, their lanterns, and ties. Thank-you maps are date-only.
  const start = istHourStart(w.from.getTime());
  const end = istHourStart(Math.min(w.to.getTime(), x.now.getTime()));
  const total = Math.max(0, Math.floor((end - start) / HOUR) + 1);
  const first = total > HOURLY_ROW_CAP ? start + (total - HOURLY_ROW_CAP) * HOUR : start; // keep the latest hours
  const hours: HourRow[] = [];
  for (let t = first; t <= end; t += HOUR) hours.push({ hour: new Date(t).toISOString(), maps: 0, lanterns: 0, tieBacks: 0 });
  const slot = (t: Date) => {
    const i = Math.floor((istHourStart(t.getTime()) - first) / HOUR);
    return i >= 0 && i < hours.length ? hours[i] : null;
  };
  let dateOnlyMaps = 0;
  let dateOnlyLanterns = 0;
  for (const m of inWin) {
    const n = lanternsOf(m.entries).length;
    if (m.arrivedVia === "thanks") {
      dateOnlyMaps += 1;
      dateOnlyLanterns += n;
      continue;
    }
    const h = slot(m.createdAt);
    if (h) {
      h.maps += 1;
      h.lanterns += n;
    }
  }
  for (const v of x.vouches) {
    if (v.createdAt < w.from || v.createdAt > w.to) continue;
    const h = slot(v.createdAt);
    if (h) h.tieBacks += 1;
  }

  return {
    generatedAt: x.now.toISOString(),
    from: w.from.toISOString(),
    to: w.to.toISOString(),
    windowNote: w.note,
    maps,
    k,
    tieBack,
    funnel: { overall, rows },
    lanterns,
    countries: countries.size,
    citiesUnplaced: unplaced.size,
    friday,
    linkedinPosts: x.linkedinPosts,
    hourly: { rows: hours, truncated: total > HOURLY_ROW_CAP, dateOnlyMaps, dateOnlyLanterns },
  };
}
