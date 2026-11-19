// Database side of the phase-1 analytics (math in growth.ts). Each loader is a
// fixed handful of set-based queries, never one query per map (no N+1), and
// only reads indexed paths: Map(invitedByMapId), ThankLink(mapId, createdAt),
// Vouch(mapId, entryIndex), AnalyticsEvent(mapId, event) and (event, createdAt).
// No query selects a device or IP hash, and nothing a friend typed exists to select.
import type { PrismaClient } from "@prisma/client";
import { CHANNELS } from "./dashboard";
import { parseEntries } from "./entries";
import { mapStats } from "./geo";
import { computeKind } from "./kinds";
import {
  buildForest, channelFunnel, cohorts, creatorRows, generationCounts, timeline, topTrees, viralFactor,
  type CreatorRow, type MapFacts, type MapNode, type TimelineItem,
} from "./growth";

const n = (v: unknown) => Number(v ?? 0);

interface FactRow {
  id: string; parent: string | null; createdAt: Date; arrivedVia: string; homeCity: string; ownerName: string | null;
  kind: string | null; km: number | null; entries: unknown; lanterns: bigint; cities: bigint; thank_links: bigint; gold: bigint;
  sh_whatsapp: bigint; sh_linkedin: bigint; sh_copy: bigint; sh_story: bigint; sh_native: bigint; opens: bigint;
}

/** One row per map with every per-map count, in a single statement. */
export async function loadMapFacts(db: PrismaClient): Promise<MapFacts[]> {
  const rows = await db.$queryRaw<FactRow[]>`
    SELECT m."id", m."invitedByMapId" AS parent, m."createdAt", m."arrivedVia", m."homeCity", m."ownerName", m."kind", m."km",
           CASE WHEN m."km" IS NULL OR m."kind" IS NULL THEN m."entries" END AS entries,
           e.lanterns, e.cities,
           coalesce(t.c, 0) AS thank_links, coalesce(v.c, 0) AS gold,
           coalesce(s.whatsapp, 0) AS sh_whatsapp, coalesce(s.linkedin, 0) AS sh_linkedin, coalesce(s.copy, 0) AS sh_copy,
           coalesce(s.story, 0) AS sh_story, coalesce(s.native, 0) AS sh_native, coalesce(o.c, 0) AS opens
    FROM "Map" m
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE x->>'carried' IS DISTINCT FROM 'true') AS lanterns, count(DISTINCT x->>'city') AS cities
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m."entries") = 'array' THEN m."entries" ELSE '[]'::jsonb END) x
    ) e
    LEFT JOIN (SELECT "mapId", count(*) AS c FROM "ThankLink" GROUP BY 1) t ON t."mapId" = m."id"
    LEFT JOIN (SELECT "mapId", count(*) AS c FROM "Vouch" WHERE "tier" = 'tap' AND "thankLinkId" IS NOT NULL GROUP BY 1) v ON v."mapId" = m."id"
    LEFT JOIN (
      SELECT "mapId",
             count(*) FILTER (WHERE "metadata"->>'channel' = 'whatsapp') AS whatsapp,
             count(*) FILTER (WHERE "metadata"->>'channel' = 'linkedin') AS linkedin,
             count(*) FILTER (WHERE "metadata"->>'channel' = 'copy') AS copy,
             count(*) FILTER (WHERE "metadata"->>'channel' = 'story') AS story,
             count(*) FILTER (WHERE "metadata"->>'channel' = 'native') AS native
      FROM "AnalyticsEvent" WHERE "event" = 'share' AND "mapId" IS NOT NULL GROUP BY 1
    ) s ON s."mapId" = m."id"
    LEFT JOIN (SELECT "mapId", count(*) AS c FROM "AnalyticsEvent" WHERE "event" = 'map_view' AND "mapId" IS NOT NULL GROUP BY 1) o ON o."mapId" = m."id"`;
  return rows.map((r) => {
    let km = r.km;
    let kind = r.kind;
    if (km === null || kind === null) {
      // Legacy maps saved before km / kind were stored: computed from the cities, as the connectors API does.
      const entries = parseEntries(r.entries);
      km ??= mapStats(entries.map((e) => ({ city: e.city })), r.homeCity).km;
      kind ??= computeKind({ homeCity: r.homeCity, lanterns: entries }).kind;
    }
    return {
      id: r.id, parent: r.parent, createdAt: r.createdAt, arrivedVia: r.arrivedVia, homeCity: r.homeCity, ownerName: r.ownerName,
      kind, km, lanterns: n(r.lanterns), cities: n(r.cities), gold: n(r.gold), thankLinks: n(r.thank_links), opens: n(r.opens),
      shares: { whatsapp: n(r.sh_whatsapp), linkedin: n(r.sh_linkedin), copy: n(r.sh_copy), story: n(r.sh_story), native: n(r.sh_native) },
    };
  });
}

export async function loadCreators(db: PrismaClient): Promise<CreatorRow[]> {
  const facts = await loadMapFacts(db);
  return creatorRows(facts, buildForest(facts));
}

async function loadNodes(db: PrismaClient): Promise<MapNode[]> {
  return db.map.findMany({ select: { id: true, invitedByMapId: true, createdAt: true, arrivedVia: true } }).then((rows) =>
    rows.map((r) => ({ id: r.id, parent: r.invitedByMapId, createdAt: r.createdAt, arrivedVia: r.arrivedVia }))
  );
}

export const WINDOWS = { all: null, d30: 30, d7: 7 } as const;
export type WindowKey = keyof typeof WINDOWS;
export const parseWindow = (v: string | null): WindowKey => (v === "d30" || v === "d7" ? v : "all");

export async function loadVirality(db: PrismaClient, window: WindowKey = "all", now = new Date()) {
  const days = WINDOWS[window];
  const since = days ? new Date(now.getTime() - days * 86_400_000) : new Date(0);
  const [nodes, shareRows, openRows, myRows] = await Promise.all([
    loadNodes(db),
    db.$queryRaw<{ k: string | null; c: bigint }[]>`
      SELECT "metadata"->>'channel' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'share' AND "createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<{ k: string; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" IN ('map_view', 't_open') AND "createdAt" >= ${since} AND "metadata"->>'s' IS NOT NULL GROUP BY 1`,
    db.$queryRaw<{ k: string | null; via: string | null; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, "metadata"->>'via' AS via, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'make_yours' AND "createdAt" >= ${since} GROUP BY 1, 2`,
  ]);
  const forest = buildForest(nodes);
  const inWindow = nodes.filter((m) => m.createdAt >= since);
  const shares = new Map(shareRows.map((r) => [r.k, n(r.c)]));
  const opens = new Map(openRows.map((r) => [r.k, n(r.c)]));
  const myBy = (k: string) => myRows.filter((r) => r.k === k).reduce((a, r) => a + n(r.c), 0);
  const makeYoursAll = myRows.reduce((a, r) => a + n(r.c), 0);
  const counts = CHANNELS.map((c) => ({
    channel: c.channel, label: c.label,
    shares: c.shareAs.reduce((a, s) => a + (shares.get(s) ?? 0), 0),
    opens: opens.get(c.channel) ?? 0,
    makeYours: myBy(c.channel),
  }));
  const invitedSaved = inWindow.filter((m) => m.arrivedVia === "map" || m.arrivedVia === "thanks").length;
  const funnel = channelFunnel(counts, { makeYoursAll, invitedSaved, mapsTotal: inWindow.length });
  const viral = viralFactor(nodes, forest);
  const byRoute = (via: string) => {
    const c = nodes.filter((m) => forest.depth.get(m.id)! > 0 && m.arrivedVia === via).length;
    return { maps: c, k: nodes.length ? Math.round((c / nodes.length) * 100) / 100 : 0 };
  };
  return {
    generatedAt: now.toISOString(),
    window,
    viral,
    kByRoute: { map: byRoute("map"), thanks: byRoute("thanks") },
    daily: cohorts(nodes, forest, "day", now, 30),
    weekly: cohorts(nodes, forest, "week", now, 12),
    generations: generationCounts(forest),
    topTrees: topTrees(nodes, forest, 15),
    funnel: {
      ...funnel,
      makeYoursAll,
      makeYoursUntagged: myRows.filter((r) => !r.k).reduce((a, r) => a + n(r.c), 0),
      nativeShares: shares.get("native") ?? 0,
      invitedSaved,
    },
  };
}
export type Virality = Awaited<ReturnType<typeof loadVirality>>;

/** One map's timeline, by its internal id, short slug or public id. Null if it does not exist. */
export async function loadTimeline(db: PrismaClient, key: string): Promise<{ id: string; items: TimelineItem[]; truncated: boolean } | null> {
  const map = await db.map.findFirst({
    where: { OR: [{ id: key }, { shortSlug: key }, { publicId: key }] },
    // Never ownerName: the timeline carries no names.
    select: { id: true, createdAt: true, updatedAt: true, arrivedVia: true, entries: true, kind: true, homeCity: true },
  });
  if (!map) return null;
  const EVENT_CAP = 500;
  const [thankLinks, vouches, events, tree] = await Promise.all([
    db.thankLink.findMany({ where: { mapId: map.id }, select: { createdAt: true, usedAt: true } }),
    db.vouch.findMany({ where: { mapId: map.id, tier: "tap", thankLinkId: { not: null } }, select: { createdAt: true, seenByOwnerAt: true } }),
    db.analyticsEvent.findMany({
      where: { mapId: map.id, event: { in: ["share", "map_view", "gold_seen", "link_report"] } },
      orderBy: { createdAt: "desc" },
      take: EVENT_CAP + 1,
      select: { createdAt: true, event: true, metadata: true },
    }),
    // Ancestors (for the generation) and descendants (for each spawned map's own reach), both via the invitedByMapId index.
    db.$queryRaw<{ up: number }[]>`
      WITH RECURSIVE up AS (
        SELECT "invitedByMapId" AS id, 0 AS d FROM "Map" WHERE "id" = ${map.id}
        UNION ALL SELECT m."invitedByMapId", up.d + 1 FROM "Map" m JOIN up ON m."id" = up.id WHERE up.id IS NOT NULL AND up.d < 50
      ) SELECT count(*)::int AS up FROM up WHERE id IS NOT NULL`,
  ]);
  const children = await db.$queryRaw<{ createdAt: Date; arrivedVia: string; descendants: number }[]>`
    WITH RECURSIVE sub AS (
      SELECT "id", "id" AS child, 1 AS d FROM "Map" WHERE "invitedByMapId" = ${map.id}
      UNION ALL SELECT m."id", sub.child, sub.d + 1 FROM "Map" m JOIN sub ON m."invitedByMapId" = sub."id" WHERE sub.d < 50
    )
    SELECT c."createdAt", c."arrivedVia", (count(*) - 1)::int AS descendants
    FROM sub JOIN "Map" c ON c."id" = sub.child GROUP BY c."id", c."createdAt", c."arrivedVia"`;
  const entries = parseEntries(map.entries);
  const lanterns = entries.filter((e) => !("carried" in e && e.carried)).length;
  const items = timeline({
    map: {
      createdAt: map.createdAt, updatedAt: map.updatedAt, arrivedVia: map.arrivedVia, kind: map.kind, homeCity: map.homeCity,
      lanterns, cities: new Set(entries.map((e) => e.city)).size, generation: n(tree[0]?.up),
    },
    thankLinks,
    vouches,
    events: events.slice(0, EVENT_CAP),
    spawned: children,
  });
  return { id: map.id, items, truncated: events.length > EVENT_CAP };
}
