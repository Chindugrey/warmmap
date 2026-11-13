import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { z } from "zod";

const eventSchema = z.object({
  event: z.union([
    z.literal("page_view"),
    z.literal("play"),
    z.literal("share"),
    z.literal("invite_click"),
    z.literal("login"),
  ]),
  mapId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  await trackEvent(parsed.data.event, parsed.data.mapId, parsed.data.metadata);
  return NextResponse.json({ ok: true });
}
