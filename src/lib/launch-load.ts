// Database side of the launch scoreboard (math in launch.ts). A fixed handful of
// queries over existing tables; no name, device or IP hash is ever selected.
import { Prisma, type PrismaClient } from "@prisma/client";
import "./cities-full"; // registers the full city list in citiesByName (server only)
import { citiesByName, findCity } from "./cities";
import { CHANNELS, istDayStart } from "./dashboard";
import { parseEntries } from "./entries";
import { DISPLAYABLE_VOUCH } from "./vouches";
import { istDay } from "./share-taps";
import { scoreboard, utcDayStart, type LaunchWindow } from "./launch";

const n = (v: unknown) => Number(v ?? 0);
// "createdAt" is a timestamp WITHOUT time zone holding UTC: compare against the same UTC clock reading.
const utc = (d: Date) => Prisma.sql`(${d} AT TIME ZONE 'UTC')`;

const countryOf = (city: string) => (citiesByName[city] ?? findCity(city))?.country ?? null;

/** LinkedIn posts logged in EngagementLog over the window's IST days, or null when this deployment has no such table. */
async function linkedinPosts(db: PrismaClient, w: LaunchWindow): Promise<number | null> {
  try {
    const t = await db.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('public."EngagementLog"') IS NOT NULL AS ok`;
    if (!t[0]?.ok) return null;
    const r = await db.$queryRaw<{ c: bigint }[]>`
      SELECT count(*) AS c FROM "EngagementLog"
      WHERE "platform" = 'linkedin' AND "occurredOn" >= ${istDay(w.from)}::date AND "occurredOn" <= ${istDay(w.to)}::date`;
    return n(r[0]?.c);
  } catch {
    return null;
  }
}

export async function loadLaunch(db: PrismaClient, w: LaunchWindow, now = new Date()) {
  const [maps, links, vouches, shareRows, openRows, myRows, posts] = await Promise.all([
    // Never ownerName: only ids, routes, times and the lanterns' cities.
    db.map.findMany({
      where: { createdAt: { gte: utcDayStart(w.from), lte: w.to } },
      select: { id: true, invitedByMapId: true, createdAt: true, arrivedVia: true, entries: true },
    }),
    db.thankLink.findMany({
      where: { createdAt: { gte: w.from, lte: w.to }, map: { arrivedVia: { not: "seed" } } },
      select: { createdAt: true, usedAt: true },
    }),
    db.vouch.findMany({
      where: { ...DISPLAYABLE_VOUCH, createdAt: { gte: w.from, lte: w.to }, map: { arrivedVia: { not: "seed" } } },
      select: { createdAt: true },
    }),
    // Share taps are stamped 00:00 IST of their day, so their window starts at the IST midnight of the first day.
    db.$queryRaw<{ k: string | null; c: bigint }[]>`
      SELECT "metadata"->>'channel' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'share' AND "createdAt" >= ${utc(istDayStart(w.from))} AND "createdAt" <= ${utc(w.to)} GROUP BY 1`,
    db.$queryRaw<{ k: string; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" IN ('map_view', 't_open') AND "metadata"->>'s' IS NOT NULL
        AND "createdAt" >= ${utc(w.from)} AND "createdAt" <= ${utc(w.to)} GROUP BY 1`,
    db.$queryRaw<{ k: string; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'make_yours' AND "metadata"->>'s' IS NOT NULL
        AND "createdAt" >= ${utc(w.from)} AND "createdAt" <= ${utc(w.to)} GROUP BY 1`,
    linkedinPosts(db, w),
  ]);
  const shares = new Map(shareRows.map((r) => [r.k, n(r.c)]));
  const opens = new Map(openRows.map((r) => [r.k, n(r.c)]));
  const mine = new Map(myRows.map((r) => [r.k, n(r.c)]));
  const channels = [
    ...CHANNELS.map((c) => ({
      channel: c.channel, label: c.label,
      shares: c.shareAs.reduce((a, s) => a + (shares.get(s) ?? 0), 0),
      opens: opens.get(c.channel) ?? 0,
      makeYours: mine.get(c.channel) ?? 0,
    })),
    { channel: "native", label: "Share sheet", shares: shares.get("native") ?? 0, opens: 0, makeYours: 0 },
  ];
  return scoreboard({
    window: w,
    now,
    maps: maps.map((m) => ({ ...m, entries: parseEntries(m.entries) })),
    links,
    vouches,
    channels,
    linkedinPosts: posts,
    countryOf,
  });
}
