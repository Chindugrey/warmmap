// POST /api/analytics: allow-listed client events only, small payloads.
import { NextRequest, NextResponse } from "next/server";
import { CLIENT_EVENTS, trackEvent } from "@/lib/analytics";
import { limitRequest, HOUR } from "@/lib/limits";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 512) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const limited = await limitRequest(req, "analytics", { device: [300, HOUR], ip: [3000, HOUR] });
  if (limited) return limited;
  let body: { event?: unknown; metadata?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.event !== "string" || !(CLIENT_EVENTS as readonly string[]).includes(body.event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }
  await trackEvent(body.event as (typeof CLIENT_EVENTS)[number], null, body.metadata);
  return NextResponse.json({ ok: true });
}
