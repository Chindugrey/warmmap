// Server-side counts for the four numbers that matter. Event names and
// metadata keys are allow-listed; values are enums or small numbers. No event
// ever carries a name, e-mail, token, owner key or the # part of an address.
import { prisma } from "./prisma";

export const SERVER_EVENTS = [
  "map_saved",
  "map_updated",
  "map_deleted",
  "map_view",
  "thank_link_created",
  "vouch_tap",
  "gold_seen",
] as const;

export const CLIENT_EVENTS = ["page_view", "start", "lantern", "reveal", "share", "t_open", "make_yours"] as const;

export type EventName = (typeof SERVER_EVENTS)[number] | (typeof CLIENT_EVENTS)[number];

const ENUMS: Record<string, readonly string[]> = {
  via: ["cold", "map", "thanks", "seed"],
  inApp: ["whatsapp", "linkedin", "instagram", "none"],
  channel: ["whatsapp", "linkedin", "copy", "native", "story"],
};
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

export async function trackEvent(event: EventName, mapId?: string | null, metadata?: unknown) {
  try {
    await prisma.analyticsEvent.create({
      data: { event, mapId: mapId ?? null, metadata: cleanMetadata(metadata) },
    });
  } catch (e) {
    console.error("Analytics error:", (e as Error).message);
  }
}
