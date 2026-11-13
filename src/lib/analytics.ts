import { prisma } from "./prisma";

export type AnalyticsEventType =
  | "page_view"
  | "play"
  | "create"
  | "share"
  | "vouch"
  | "login"
  | "invite_click";

export async function trackEvent(
  event: AnalyticsEventType,
  mapId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        mapId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  } catch (e) {
    // Analytics should never break the user flow.
    console.error("Analytics error:", e);
  }
}

export async function getMapStats(mapId: string) {
  const [plays, shares, vouches] = await Promise.all([
    prisma.analyticsEvent.count({ where: { mapId, event: "play" } }),
    prisma.analyticsEvent.count({ where: { mapId, event: "share" } }),
    prisma.analyticsEvent.count({ where: { mapId, event: "vouch" } }),
  ]);
  return { plays, shares, vouches };
}

export async function getGlobalStats() {
  const [maps, vouches, plays] = await Promise.all([
    prisma.map.count({ where: { deletedAt: null } }),
    prisma.vouch.count({ where: { status: "verified" } }),
    prisma.analyticsEvent.count({ where: { event: "play" } }),
  ]);
  return { maps, vouches, plays };
}
