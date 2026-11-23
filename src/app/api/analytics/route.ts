// POST /api/analytics: allow-listed client events only, small payloads.
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_EVENTS, trackEvent } from "@/lib/analytics";
import { findMap, keyMatches } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";

/** Share taps counted against one map per IST day; more still count globally, against no map. */
const MAP_SHARE_DAILY_CAP = 200;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 512) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const limited = await limitRequest(req, "analytics", { device: [300, HOUR], ip: [3000, HOUR] });
  if (limited) return limited;
  let body: { event?: unknown; metadata?: unknown; map?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (typeof body.event !== "string" || !(CLIENT_EVENTS as readonly string[]).includes(body.event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  // A share tap names its map (slug or public id) and counts against it only with that map's owner key (the share
  // buttons are owner-only). Anything else (no key, wrong key, unknown map, map over its daily cap) is still counted,
  // against no map, and gets the very same answer: nothing here tells a caller whether a slug or key was right.
  let mapId: string | null = null;
  if (body.event === "share" && typeof body.map === "string") {
    const map = await findMap(body.map);
    if (map && keyMatches(map, req.headers.get("x-owner-key"))) mapId = map.id; // the cap is applied inside trackEvent
  }
  await trackEvent(body.event as (typeof CLIENT_EVENTS)[number], mapId, body.metadata, MAP_SHARE_DAILY_CAP);
  return NextResponse.json({ ok: true });
}
