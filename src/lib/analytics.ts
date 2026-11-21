// Server-side counts for the four numbers that matter. Event names and
// metadata keys are allow-listed; values are enums or small numbers. No event
// ever carries a name, e-mail, token, owner key or the # part of an address.
import { prisma } from "./prisma";
import { randomUUID } from "node:crypto";
import { CHANNEL_TAGS } from "./flow";
import { istDayStart } from "./dashboard";

export const SERVER_EVENTS = [
  "map_saved",
  "map_updated",
  "map_deleted",
  "map_view",
  "thank_link_created",
  "vouch_tap",
  "gold_seen",
  "link_report",
] as const;

export const CLIENT_EVENTS = ["page_view", "start", "lantern", "reveal", "share", "t_open", "make_yours"] as const;

export type EventName = (typeof SERVER_EVENTS)[number] | (typeof CLIENT_EVENTS)[number];

const ENUMS: Record<string, readonly string[]> = {
  via: ["cold", "map", "thanks", "seed"],
  inApp: ["whatsapp", "linkedin", "instagram", "none"],
  channel: ["whatsapp", "linkedin", "copy", "native", "story"],
  // How the link reached the visitor: ?s= on a share link (WhatsApp, LinkedIn, copied, Story).
  s: CHANNEL_TAGS,
};

/** The ?s= value if it is one of the allowed tags, else undefined. Never anything the sender typed. */
export function channelTag(v: string | null | undefined): string | undefined {
  return typeof v === "string" && ENUMS.s.includes(v) ? v : undefined;
}
const NUMS = ["n", "questionSet"];

export function cleanMetadata(meta: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!meta || typeof meta !== "object") return out;
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (ENUMS[k] && typeof v === "string" && ENUMS[k].includes(v)) out[k] = v;
    else if (NUMS.includes(k) && typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100) out[k] = v;
  }
  return out;
}

/**
 * `mapDailyCap` (share taps only): at most that many taps per map per IST day; one past it is kept against no map.
 * The count and the insert run under a per-(map, day) advisory lock so taps that arrive together cannot all pass.
 */
export async function trackEvent(event: EventName, mapId?: string | null, metadata?: unknown, mapDailyCap?: number) {
  try {
    // A share tap is kept as a count, not as a moment: its time is the start of its IST day (00:00 IST) and its id is
    // random (a cuid embeds the time), so a row says "one tap that day" and nothing finer.
    const share = event === "share" ? { id: randomUUID(), createdAt: istDayStart(new Date()) } : {};
    const data = { event, mapId: mapId ?? null, metadata: cleanMetadata(metadata), ...share };
    if (event === "share" && mapId && mapDailyCap !== undefined) {
      const day = istDayStart(new Date());
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`share-cap:${mapId}:${day.toISOString()}`}, 0))`;
        const today = await tx.analyticsEvent.count({ where: { mapId, event: "share", createdAt: { gte: day } } });
        await tx.analyticsEvent.create({ data: today < mapDailyCap ? data : { ...data, mapId: null } });
      });
      return;
    }
    await prisma.analyticsEvent.create({ data });
  } catch (e) {
    console.error("Analytics error:", (e as Error).message);
  }
}
