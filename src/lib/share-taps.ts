// Share taps per map, per IST day, per channel: counts only. Read from the existing
// AnalyticsEvent rows (event 'share', mapId, metadata.channel); no table of its own and
// nothing about who tapped (the rows carry no name, device or connection mark).
// A tap with a missing or unknown channel is counted under "other", so the total still
// equals the number of taps (dropping it would make the total quietly too low).
import { Prisma, type PrismaClient } from "@prisma/client";
import { istDayStart } from "./dashboard";
import { SHARE_CHANNELS } from "./growth";

export const SHARE_TAP_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
export const TAP_COLUMNS = [...SHARE_CHANNELS, "other"] as const;
export type TapColumn = (typeof TAP_COLUMNS)[number];
export type TapCounts = Record<TapColumn, number> & { total: number };
export interface ShareTapDay extends TapCounts { day: string } // IST day, YYYY-MM-DD

const zero = (): TapCounts => ({ whatsapp: 0, linkedin: 0, copy: 0, story: 0, native: 0, other: 0, total: 0 });

/** 00:00 IST of the oldest day in the window (today and the 29 days before it). */
export function shareTapsSince(now: Date): Date {
  return new Date(istDayStart(now).getTime() - (SHARE_TAP_DAYS - 1) * DAY);
}

/** IST calendar day (YYYY-MM-DD) of an instant. */
export const istDay = (t: Date) => new Date(t.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Folds (day, channel, count) rows into one row per day of the window, newest first, plus totals. */
export function foldShareTaps(rows: { day: string; channel: string | null; count: number }[], now: Date) {
  const start = shareTapsSince(now).getTime();
  const days: ShareTapDay[] = [];
  for (let i = SHARE_TAP_DAYS - 1; i >= 0; i--) days.push({ day: istDay(new Date(start + i * DAY)), ...zero() });
  const byDay = new Map(days.map((d) => [d.day, d]));
  const totals = zero();
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (!d) continue;
    const col: TapColumn = (SHARE_CHANNELS as readonly string[]).includes(r.channel ?? "") ? (r.channel as TapColumn) : "other";
    d[col] += r.count; d.total += r.count; totals[col] += r.count; totals.total += r.count;
  }
  return { days, totals };
}

/** Last 30 IST days of share taps for one map (internal id). */
export async function loadShareTaps(db: PrismaClient, mapId: string, now = new Date()) {
  const since = shareTapsSince(now);
  const rows = await db.$queryRaw<{ day: string; channel: string | null; count: number }[]>`
    SELECT to_char("createdAt" + interval '5 hours 30 minutes', 'YYYY-MM-DD') AS day,
           "metadata"->>'channel' AS channel, count(*)::int AS count
    FROM "AnalyticsEvent"
    WHERE "event" = 'share' AND "mapId" = ${mapId} AND "createdAt" >= ${since}
    GROUP BY 1, 2`;
  return { windowDays: SHARE_TAP_DAYS, ...foldShareTaps(rows, now) };
}
export type ShareTaps = Awaited<ReturnType<typeof loadShareTaps>>;

/** SQL for the creators list: this window's tap count (all channels) per map. */
export const shareTaps30dSql = (now: Date) => Prisma.sql`count(*) FILTER (WHERE "createdAt" >= ${shareTapsSince(now)})`;
