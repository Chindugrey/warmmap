// POST /api/analytics: allow-listed client events only, small payloads.
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_EVENTS, trackEvent } from "@/lib/analytics";
import { findMap } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";

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
  if (typeof body.event !== "string" || !(CLIENT_EVENTS as readonly string[]).includes(body.event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  // A share tap may name the map it was made for (slug or public id); only the resolved internal id is stored.
  // An unknown or missing map is still counted, just not against any map.
  const map = body.event === "share" && typeof body.map === "string" ? await findMap(body.map) : null;
  await trackEvent(body.event as (typeof CLIENT_EVENTS)[number], map?.id ?? null, body.metadata);
  return NextResponse.json({ ok: true });
}
