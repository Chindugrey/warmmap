// Database side of the phase-1 analytics (math in growth.ts). Each loader is a
// fixed handful of set-based queries, never one query per map (no N+1), and
// only reads indexed paths: Map(invitedByMapId), ThankLink(mapId, createdAt),
// Vouch(mapId, entryIndex), AnalyticsEvent(mapId, event) and (event, createdAt).
// No query selects a device or IP hash, and nothing a friend typed exists to select.
import { Prisma, type PrismaClient } from "@prisma/client";
import { CHANNELS } from "./dashboard";
import { parseEntries } from "./entries";
import { mapStats } from "./geo";
import { istDayStart } from "./dashboard";
import { shareTaps30dSql } from "./share-taps";
import { computeKind } from "./kinds";
import {
  CSV_ROW_CAP, TREE_DEPTH_CAP, WARMTH_WEIGHTS, buildForest, channelFunnel, cohorts, generationCounts, likePattern, timeline, topTrees,
  viralFactor, type CreatorQuery, type CreatorRow, type CreatorSort, type DayCount, type MapNode, type TimelineItem,
} from "./growth";

const n = (v: unknown) => Number(v ?? 0);

// Allow-listed ORDER BY targets (never user text in SQL).
const SORT_SQL: Record<CreatorSort, string> = {
  createdAt: `"createdAt"`, firstName: `lower(first_name)`, homeCity: `lower("homeCity")`, kind: `coalesce(kind, '')`,
  lanterns: `lanterns`, cities: `cities`, km: `coalesce(km, 0)`, gold: `gold`, thankLinks: `thank_links`, sharesTotal: `shares_total`,
  opens: `opens`, spawnedDirect: `spawned_direct`, spawnedAll: `spawned_all`, arrivedVia: `"arrivedVia"`, warmth: `warmth`,
};

interface CreatorSqlRow {
  id: string; first_name: string; homeCity: string; createdAt: Date; arrivedVia: string; kind: string | null; km: number | null;
  entries: unknown; lanterns: bigint; cities: bigint; thank_links: bigint; gold: bigint;
  sh_whatsapp: bigint; sh_linkedin: bigint; sh_copy: bigint; sh_story: bigint; sh_native: bigint; shares_total: bigint; shares_warm: bigint; shares_30d: bigint; opens: bigint;
  spawned_direct: bigint; spawned_all: bigint; spawned_capped: boolean; warmth: bigint; total: bigint;
}

/**
 * The creators list, aggregated, searched, sorted and paged in ONE SQL statement:
 * only the requested page leaves the database. Descendants come from a recursive
 * ancestor walk capped at TREE_DEPTH_CAP levels (flagged when hit).
 */
export async function loadCreatorsPage(
  db: PrismaClient,
  cq: Pick<CreatorQuery, "q" | "sort" | "dir">,
  opts: { limit: number; offset: number; warmOnly?: boolean; now?: Date }
): Promise<{ total: number; rows: CreatorRow[] }> {
  const W = WARMTH_WEIGHTS;
  const now = opts.now ?? new Date();
  const order = Prisma.raw(`${SORT_SQL[cq.sort]} ${cq.dir === "asc" ? "ASC" : "DESC"}`);
  const search = cq.q ? Prisma.sql`AND (first_name ILIKE ${likePattern(cq.q)} OR "homeCity" ILIKE ${likePattern(cq.q)})` : Prisma.empty;
  const warm = opts.warmOnly ? Prisma.sql`AND warmth > 0` : Prisma.empty;
  const rows = await db.$queryRaw<CreatorSqlRow[]>`
    WITH RECURSIVE up AS (
      SELECT "id" AS node, "invitedByMapId" AS anc, 1 AS d FROM "Map" WHERE "invitedByMapId" IS NOT NULL
      UNION ALL
      SELECT up.node, m."invitedByMapId", up.d + 1 FROM up JOIN "Map" m ON m."id" = up.anc
      WHERE m."invitedByMapId" IS NOT NULL AND up.d < ${TREE_DEPTH_CAP}
    ),
    below AS (
      SELECT anc AS id, count(*) FILTER (WHERE d = 1) AS direct, count(*) AS total, max(d) AS deepest FROM up GROUP BY anc
    ),
    facts AS (
      SELECT m."id", regexp_replace(btrim(coalesce(m."ownerName", '')), '[[:space:]].*$', '') AS first_name,
             m."homeCity", m."createdAt", m."arrivedVia", m."kind", m."km",
             CASE WHEN m."km" IS NULL OR m."kind" IS NULL THEN m."entries" END AS entries,
             e.lanterns, e.cities,
             coalesce(t.c, 0) AS thank_links, coalesce(v.c, 0) AS gold,
             coalesce(s.whatsapp, 0) AS sh_whatsapp, coalesce(s.linkedin, 0) AS sh_linkedin, coalesce(s.copy, 0) AS sh_copy,
             coalesce(s.story, 0) AS sh_story, coalesce(s.native, 0) AS sh_native, coalesce(s.total, 0) AS shares_total, coalesce(s.total, 0) - coalesce(s.whatsapp, 0) AS shares_warm, coalesce(s.d30, 0) AS shares_30d,
             coalesce(o.c, 0) AS opens,
             coalesce(b.direct, 0) AS spawned_direct, coalesce(b.total, 0) AS spawned_all, coalesce(b.deepest, 0) >= ${TREE_DEPTH_CAP} AS spawned_capped
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
               count(*) FILTER (WHERE "metadata"->>'channel' = 'native') AS native,
               count(*) AS total, -- every share tap on the map, an unknown channel included (as the 30-day column)
               ${shareTaps30dSql(now)} AS d30
        FROM "AnalyticsEvent" WHERE "event" = 'share' AND "mapId" IS NOT NULL GROUP BY 1
      ) s ON s."mapId" = m."id"
      LEFT JOIN (SELECT "mapId", count(*) AS c FROM "AnalyticsEvent" WHERE "event" = 'map_view' AND "mapId" IS NOT NULL GROUP BY 1) o ON o."mapId" = m."id"
      LEFT JOIN below b ON b.id = m."id"
    ),
    scored AS (
      -- Warmth's shares term leaves out WhatsApp taps: a thank-you send on WhatsApp is already scored as a thank-link.
      SELECT *, (${W.thankLinks} * thank_links + ${W.tiesBack} * gold + ${W.shares} * shares_warm
                 + ${W.spawnedDirect} * spawned_direct + ${W.spawnedDeeper} * greatest(spawned_all - spawned_direct, 0)) AS warmth
      FROM facts
    )
    SELECT *, count(*) OVER () AS total FROM scored
    WHERE true ${search} ${warm}
    ORDER BY ${order}, "createdAt" DESC, "id"
    LIMIT ${opts.limit} OFFSET ${opts.offset}`;
  return {
    total: n(rows[0]?.total),
    rows: rows.map((r) => {
      let km = r.km;
      let kind = r.kind;
      if (km === null || kind === null) {
        // Legacy maps saved before km / kind were stored: computed from the cities, as the connectors API does.
        const entries = parseEntries(r.entries);
        km ??= mapStats(entries.map((e) => ({ city: e.city })), r.homeCity).km;
        kind ??= computeKind({ homeCity: r.homeCity, lanterns: entries }).kind;
      }
      return {
        id: r.id, firstName: r.first_name, homeCity: r.homeCity, createdAt: r.createdAt.toISOString(), kind: kind ?? "", km,
        lanterns: n(r.lanterns), cities: n(r.cities), gold: n(r.gold), thankLinks: n(r.thank_links), opens: n(r.opens),
        shares: { whatsapp: n(r.sh_whatsapp), linkedin: n(r.sh_linkedin), copy: n(r.sh_copy), story: n(r.sh_story), native: n(r.sh_native) },
        sharesTotal: n(r.shares_total), shares30d: n(r.shares_30d), spawnedDirect: n(r.spawned_direct), spawnedAll: n(r.spawned_all), spawnedAllCapped: r.spawned_capped,
        arrivedVia: r.arrivedVia, warmth: n(r.warmth),
      };
    }),
  };
}

/** One page of creators; a page past the end shows the last page. */
export async function loadCreators(db: PrismaClient, cq: CreatorQuery): Promise<{ total: number; pages: number; page: number; rows: CreatorRow[] }> {
  let page = cq.page;
  let res = await loadCreatorsPage(db, cq, { limit: cq.perPage, offset: (page - 1) * cq.perPage });
  if (!res.rows.length && page > 1) {
    const { total } = await loadCreatorsPage(db, cq, { limit: 1, offset: 0 });
    page = Math.max(1, Math.ceil(total / cq.perPage));
    res = await loadCreatorsPage(db, cq, { limit: cq.perPage, offset: (page - 1) * cq.perPage });
  }
  return { total: res.total, pages: Math.max(1, Math.ceil(res.total / cq.perPage)), page, rows: res.rows };
}

/** The CSV rows, at most CSV_ROW_CAP. */
export async function loadCreatorsCsv(db: PrismaClient, cq: CreatorQuery): Promise<{ rows: CreatorRow[]; truncated: boolean }> {
  const res = await loadCreatorsPage(db, cq, { limit: CSV_ROW_CAP + 1, offset: 0 });
  return { rows: res.rows.slice(0, CSV_ROW_CAP), truncated: res.rows.length > CSV_ROW_CAP };
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
  // Share taps are stamped 00:00 IST of their day, so their window starts at an IST midnight: a rolling bound would drop
  // the oldest partial day's taps. (UTC-converted, so the session time zone does not move it.)
  const shareSince = Prisma.sql`(${days ? istDayStart(since) : since} AT TIME ZONE 'UTC')`;
  const [nodes, shareRows, openRows, myRows] = await Promise.all([
    loadNodes(db),
    db.$queryRaw<{ k: string | null; c: bigint }[]>`
      SELECT "metadata"->>'channel' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'share' AND "createdAt" >= ${shareSince} GROUP BY 1`,
    db.$queryRaw<{ k: string; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" IN ('map_view', 't_open') AND "createdAt" >= ${since} AND "metadata"->>'s' IS NOT NULL GROUP BY 1`,
    db.$queryRaw<{ k: string | null; c: bigint }[]>`
      SELECT "metadata"->>'s' AS k, count(*) AS c FROM "AnalyticsEvent"
      WHERE "event" = 'make_yours' AND "createdAt" >= ${since} GROUP BY 1`,
  ]);
  const forest = buildForest(nodes);
  // "Invited" means one thing everywhere on this page: the map carries a live inviter's id.
  const invited = (m: MapNode) => forest.depth.get(m.id)! > 0;
  const inWindow = nodes.filter((m) => m.createdAt >= since);
  const shares = new Map(shareRows.map((r) => [r.k, n(r.c)]));
  const opens = new Map(openRows.map((r) => [r.k, n(r.c)]));
  const mine = new Map(myRows.map((r) => [r.k, n(r.c)]));
  const makeYoursAll = myRows.reduce((a, r) => a + n(r.c), 0);
  const counts = CHANNELS.map((c) => ({
    channel: c.channel, label: c.label,
    shares: c.shareAs.reduce((a, s) => a + (shares.get(s) ?? 0), 0),
    opens: opens.get(c.channel) ?? 0,
    makeYours: mine.get(c.channel) ?? 0,
  }));
  const invitedSaved = inWindow.filter(invited).length;
  const funnel = channelFunnel(counts, { makeYoursAll, invitedSaved, mapsTotal: inWindow.length });
  const viral = viralFactor(nodes, forest);
  const route = (pred: (via: string) => boolean) => {
    const c = nodes.filter((m) => invited(m) && pred(m.arrivedVia)).length;
    return { maps: c, k: nodes.length ? Math.round((c / nodes.length) * 100) / 100 : 0 };
  };
  return {
    generatedAt: now.toISOString(),
    window,
    viral,
    // Split of the invited maps by how they say they arrived; the three add up to viral.invited.
    kByRoute: { map: route((v) => v === "map"), thanks: route((v) => v === "thanks"), other: route((v) => v !== "map" && v !== "thanks") },
    daily: cohorts(nodes, forest, "day", now, 30),
    weekly: cohorts(nodes, forest, "week", now, 12),
    generations: generationCounts(forest),
    topTrees: topTrees(nodes, forest, 15),
    funnel: {
      ...funnel,
      makeYoursAll,
      makeYoursUntagged: mine.get(null) ?? 0,
      nativeShares: shares.get("native") ?? 0,
      invitedSaved,
    },
  };
}
export type Virality = Awaited<ReturnType<typeof loadVirality>>;

const LIST_CAP = 1000;

export interface Timeline { id: string; items: TimelineItem[]; truncated: boolean }

/** One map's timeline, by its internal id, short slug or public id. Null if it does not exist. */
export async function loadTimeline(db: PrismaClient, key: string): Promise<Timeline | null> {
  const map = await db.map.findFirst({
    where: { OR: [{ id: key }, { shortSlug: key }, { publicId: key }] },
    // Never ownerName: the timeline carries no names.
    select: { id: true, createdAt: true, updatedAt: true, arrivedVia: true, entries: true, kind: true, homeCity: true },
  });
  if (!map) return null;
  const IST_DAY = Prisma.sql`to_char("createdAt" + interval '5 hours 30 minutes', 'YYYY-MM-DD')`;
  const [thankLinks, vouches, events, spawned, upRow, downRow] = await Promise.all([
    db.thankLink.findMany({ where: { mapId: map.id }, orderBy: { createdAt: "asc" }, take: LIST_CAP + 1, select: { createdAt: true, usedAt: true } }),
    db.vouch.findMany({
      where: { mapId: map.id, tier: "tap", thankLinkId: { not: null } }, orderBy: { createdAt: "asc" }, take: LIST_CAP + 1,
      select: { createdAt: true, seenByOwnerAt: true },
    }),
    // Daily counts only: never an exact time for an open, a share or a report.
    db.$queryRaw<{ event: string; day: string; key: string | null; count: number }[]>`
      SELECT "event", ${IST_DAY} AS day,
             CASE "event" WHEN 'share' THEN "metadata"->>'channel' WHEN 'map_view' THEN "metadata"->>'s' END AS key,
             count(*)::int AS count
      FROM "AnalyticsEvent" WHERE "mapId" = ${map.id} AND "event" IN ('share', 'map_view', 'gold_seen', 'link_report')
      GROUP BY 1, 2, 3 ORDER BY 2 DESC LIMIT ${LIST_CAP + 1}`,
    // Spawned maps: per IST day and route, a count. No id, no exact time.
    db.$queryRaw<{ day: string; key: string; count: number }[]>`
      SELECT ${IST_DAY} AS day, "arrivedVia" AS key, count(*)::int AS count
      FROM "Map" WHERE "invitedByMapId" = ${map.id} GROUP BY 1, 2 ORDER BY 1 DESC LIMIT ${LIST_CAP + 1}`,
    db.$queryRaw<{ up: number; capped: boolean }[]>`
      WITH RECURSIVE up AS (
        SELECT "invitedByMapId" AS id, 1 AS d FROM "Map" WHERE "id" = ${map.id} AND "invitedByMapId" IS NOT NULL
        UNION ALL SELECT m."invitedByMapId", up.d + 1 FROM "Map" m JOIN up ON m."id" = up.id
        WHERE m."invitedByMapId" IS NOT NULL AND up.d < ${TREE_DEPTH_CAP}
      ) SELECT count(*)::int AS up, coalesce(max(d), 0) >= ${TREE_DEPTH_CAP} AS capped FROM up`,
    db.$queryRaw<{ below: number; capped: boolean }[]>`
      WITH RECURSIVE sub AS (
        SELECT "id", 1 AS d FROM "Map" WHERE "invitedByMapId" = ${map.id}
        UNION ALL SELECT m."id", sub.d + 1 FROM "Map" m JOIN sub ON m."invitedByMapId" = sub."id" WHERE sub.d < ${TREE_DEPTH_CAP}
      ) SELECT count(*)::int AS below, coalesce(max(d), 0) >= ${TREE_DEPTH_CAP} AS capped FROM sub`,
  ]);
  const entries = parseEntries(map.entries);
  const lanterns = entries.filter((e) => !("carried" in e && e.carried)).length;
  const daily = (event: string): DayCount[] => events.filter((e) => e.event === event).map(({ day, key, count }) => ({ day, key, count }));
  const items = timeline({
    map: {
      createdAt: map.createdAt, updatedAt: map.updatedAt, arrivedVia: map.arrivedVia, kind: map.kind, homeCity: map.homeCity,
      lanterns, cities: new Set(entries.map((e) => e.city)).size,
      generation: n(upRow[0]?.up), generationCapped: !!upRow[0]?.capped,
      descendants: n(downRow[0]?.below), descendantsCapped: !!downRow[0]?.capped,
    },
    thankLinks: thankLinks.slice(0, LIST_CAP),
    vouches: vouches.slice(0, LIST_CAP),
    daily: ["share", "map_view", "gold_seen", "link_report"].map((event) => ({ event, days: daily(event) })),
    spawned: spawned.slice(0, LIST_CAP),
  });
  const truncated = [thankLinks, vouches, events, spawned].some((l) => l.length > LIST_CAP);
  return { id: map.id, items, truncated };
}
