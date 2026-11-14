// POST /api/report { token }: "Not you? Report this link". Records which map a
// reported link belongs to (for the founder to look at), nothing about who reported.
import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { limitRequest, HOUR } from "@/lib/limits";
import { lookupThankLink } from "@/lib/thank-link";

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "report", { device: [10, HOUR], ip: [60, HOUR] });
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string") return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const found = await lookupThankLink(token);
  if (found.state === "missing") return NextResponse.json({ ok: true });
  await trackEvent("link_report", found.map.id);
  return NextResponse.json({ ok: true });
}
