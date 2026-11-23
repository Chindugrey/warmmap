// Founder dashboard numbers. Everything here is an aggregate: counts, cities,
// timestamps. No query selects ownerName, entries' content beyond a count,
// or anything a friend typed. "Today" is the Indian day (IST, UTC+05:30).
import type { PrismaClient } from "@prisma/client";
import { findCity } from "./cities";
import { DISPLAYABLE_VOUCH } from "./vouches";

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** 00:00 IST of the day containing `now`, as an instant. */
export function istDayStart(now: Date): Date {
  const shifted = now.getTime() + IST_MS;
  return new Date(Math.floor(shifted / DAY) * DAY - IST_MS);
}

export interface Windowed { total: number; today: number; d7: number; d30: number }
export interface FunnelStep { key: string; label: string; all: number; d7: number }
export interface ChannelRow { channel: string; label: string; shares: number; opens: number; makeYours: number }

export interface Dashboard {
  generatedAt: string;
  todayStartsAt: string; // 00:00 IST today, ISO
  maps: Windowed;
  lanterns: { total: number; avgPerMap: number };
  thanks: { links: Windowed; vouches: Windowed; vouchPerLink: number };
  funnel: FunnelStep[];
  viral: { mapsFromMaps: number; mapsFromThanks: number; invitedMaps: number; inviterMaps: number; newMapsPerMap: number; makeYoursFromMaps: number; makeYoursFromThanks: number };
  channels: ChannelRow[];
  generations: { generation: number; maps: number }[];
  topCities: { city: string; maps: number }[];
  topCountries: { country: string; maps: number }[];
  arrivedVia: { via: string; maps: number }[];
  recent: { at: string; event: string; detail: string }[];
}

const n = (v: unknown) => Number(v ?? 0);

export const CHANNELS: { channel: string; label: string; shareAs: string[] }[] = [
  { channel: "wa", label: "WhatsApp", shareAs: ["whatsapp"] },
  { channel: "li", label: "LinkedIn", shareAs: ["linkedin"] },
  { channel: "cp", label: "Copied link", shareAs: ["copy"] },
  { channel: "st", label: "Story picture", shareAs: ["story"] },
];

export async function loadDashboard(db: PrismaClient, now = new Date()): Promise<Dashboard> {
  const today = istDayStart(now);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);

  const windowed = async (count: (gte?: Date) => Promise<number>): Promise<Windowed> => {
    const [total, t, w, m] = await Promise.all([count(), count(today), count(d7), count(d30)]);
    return { total, today: t, d7: w, d30: m };
  };
  const created = (gte?: Date) => (gte ? { createdAt: { gte } } : {});

  const [maps, links, vouches, lanternRow, evCounts, lanternFive, viralRow, shareRows, openRows, myRows, myVia, gens, cities, via, recent] =
    await Promise.all([
      windowed((g) => db.map.count({ where: created(g) })),
      windowed((g) => db.thankLink.count({ where: created(g) })),
      windowed((g) => db.vouch.count({ where: { ...DISPLAYABLE_VOUCH, ...created(g) } })),
      // Lanterns the owner lit: question lanterns only (the carried one points back to whoever brought them).
      db.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM "Map" m, jsonb_array_elements(m."entries") e
        WHERE e->>'carried' IS DISTINCT FROM 'true'`,
      db.$queryRaw<{ event: string; all: bigint; d7: bigint }[]>`
        SELECT "event", count(*) AS "all", count(*) FILTER (WHERE "createdAt" >= ${d7}) AS d7
        FROM "AnalyticsEvent" WHERE "event" IN ('start', 'map_saved', 'vouch_tap')
        GROUP BY "event"`,
      db.$queryRaw<{ all: bigint; d7: bigint }[]>`
        SELECT count(*) AS "all", count(*) FILTER (WHERE "createdAt" >= ${d7}) AS d7
        FROM "AnalyticsEvent" WHERE "event" = 'lantern' AND ("metadata"->>'n')::int = 5`,
      db.$queryRaw<{ from_maps: bigint; from_thanks: bigint; invited: bigint; inviters: bigint }[]>`
        SELECT count(*) FILTER (WHERE "arrivedVia" = 'map') AS from_maps,
               count(*) FILTER (WHERE "arrivedVia" = 'thanks') AS from_thanks,
               count(*) FILTER (WHERE "invitedByMapId" IS NOT NULL) AS invited,
               count(DISTINCT "invitedByMapId") AS inviters
        FROM "Map"`,
      db.$queryRaw<{ k: string; c: bigint }[]>`
        SELECT "metadata"->>'channel' AS k, count(*) AS c FROM "AnalyticsEvent"
        WHERE "event" = 'share' GROUP BY 1`,
      db.$queryRaw<{ k: string; c: bigint }[]>`
        SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
        WHERE "event" IN ('map_view', 't_open') AND "metadata"->>'s' IS NOT NULL GROUP BY 1`,
      db.$queryRaw<{ k: string; c: bigint }[]>`
        SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
        WHERE "event" = 'make_yours' AND "metadata"->>'s' IS NOT NULL GROUP BY 1`,
      db.$queryRaw<{ k: string; c: bigint }[]>`
        SELECT "metadata"->>'via' AS k, count(*) AS c FROM "AnalyticsEvent"
        WHERE "event" = 'make_yours' GROUP BY 1`,
      db.$queryRaw<{ g: number; c: bigint }[]>`
        WITH RECURSIVE tree AS (
          SELECT "id", 0 AS g FROM "Map" WHERE "invitedByMapId" IS NULL
          UNION ALL
          SELECT m."id", t.g + 1 FROM "Map" m JOIN tree t ON m."invitedByMapId" = t."id" WHERE t.g < 12
        ) SELECT g, count(*) AS c FROM tree GROUP BY g ORDER BY g`,
      db.map.groupBy({ by: ["homeCity"], _count: { _all: true }, orderBy: { _count: { homeCity: "desc" } } }),
      db.map.groupBy({ by: ["arrivedVia"], _count: { _all: true }, orderBy: { _count: { arrivedVia: "desc" } } }),
      db.analyticsEvent.findMany({
        // Share taps are kept as per-day counts (stamped 00:00 IST), so they have no place in a "latest events" list.
        where: { event: { notIn: ["page_view", "share"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { createdAt: true, event: true, metadata: true },
      }),
    ]);

  const ev = (k: string) => evCounts.find((r) => r.event === k);
  const mapsTotal = maps.total;
  const lanternTotal = n(lanternRow[0]?.total);
  const funnel: FunnelStep[] = [
    { key: "start", label: "Start", all: n(ev("start")?.all), d7: n(ev("start")?.d7) },
    { key: "five", label: "5+ lanterns", all: n(lanternFive[0]?.all), d7: n(lanternFive[0]?.d7) },
    { key: "saved", label: "Saved (Show me)", all: n(ev("map_saved")?.all), d7: n(ev("map_saved")?.d7) },
    { key: "vouch", label: "Vouch (tied back)", all: n(ev("vouch_tap")?.all), d7: n(ev("vouch_tap")?.d7) },
  ];

  const shares = new Map(shareRows.map((r) => [r.k, n(r.c)]));
  const opens = new Map(openRows.map((r) => [r.k, n(r.c)]));
  const mine = new Map(myRows.map((r) => [r.k, n(r.c)]));
  const channels = CHANNELS.map((c) => ({
    channel: c.channel,
    label: c.label,
    shares: c.shareAs.reduce((a, s) => a + (shares.get(s) ?? 0), 0),
    opens: opens.get(c.channel) ?? 0,
    makeYours: mine.get(c.channel) ?? 0,
  }));

  const countries = new Map<string, number>();
  for (const c of cities) {
    const k = findCity(c.homeCity)?.country ?? "Unknown";
    countries.set(k, (countries.get(k) ?? 0) + c._count._all);
  }

  const v = viralRow[0];
  const invited = n(v?.invited);
  return {
    generatedAt: now.toISOString(),
    todayStartsAt: today.toISOString(),
    maps,
    lanterns: { total: lanternTotal, avgPerMap: mapsTotal ? Math.round((lanternTotal / mapsTotal) * 10) / 10 : 0 },
    thanks: { links, vouches, vouchPerLink: links.total ? Math.round((vouches.total / links.total) * 100) / 100 : 0 },
    funnel,
    viral: {
      mapsFromMaps: n(v?.from_maps),
      mapsFromThanks: n(v?.from_thanks),
      invitedMaps: invited,
      inviterMaps: n(v?.inviters),
      makeYoursFromMaps: n(myVia.find((r) => r.k === "map")?.c),
      makeYoursFromThanks: n(myVia.find((r) => r.k === "thanks")?.c),
      newMapsPerMap: mapsTotal ? Math.round((invited / mapsTotal) * 100) / 100 : 0,
    },
    channels,
    generations: gens.map((g) => ({ generation: Number(g.g), maps: n(g.c) })),
    topCities: cities.slice(0, 10).map((c) => ({ city: c.homeCity, maps: c._count._all })),
    topCountries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, maps]) => ({ country, maps })),
    arrivedVia: via.map((r) => ({ via: r.arrivedVia, maps: r._count._all })),
    recent: recent.map((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      const detail = ["via", "channel", "s", "n"].filter((k) => m[k] !== undefined).map((k) => `${k}=${m[k]}`).join(" ");
      return { at: r.createdAt.toISOString(), event: r.event, detail };
    }),
  };
}
