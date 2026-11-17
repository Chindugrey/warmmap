// GET: the public map, cities only. PATCH / DELETE: owner, by keeper key.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelTag, trackEvent } from "@/lib/analytics";
import { toPublicMap } from "@/lib/public-map";
import { parsePatchInput } from "@/lib/map-input";
import { mapShape, pinCarried } from "@/lib/map-shape";
import { parseEntries } from "@/lib/entries";
import { findMap, noStore, requireOwner } from "@/lib/owner";
import { limitRequest, HOUR } from "@/lib/limits";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const map = await findMap(id);
  if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  await trackEvent("map_view", map.id, { s: channelTag(req.nextUrl.searchParams.get("s")) });
  return NextResponse.json(toPublicMap(map), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const limited = await limitRequest(req, "map_patch", { device: [60, HOUR], ip: [300, HOUR] });
  if (limited) return limited;
  const { id } = await params;
  const owned = await requireOwner(req, id);
  if (owned.error) return owned.error;
  const map = owned.map;
  if (map.questionSet !== 2) {
    return NextResponse.json({ error: "Older maps can't be changed. Make a new one." }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const inviter = map.invitedByMapId ? await prisma.map.findUnique({ where: { id: map.invitedByMapId } }) : null;
  const parsed = parsePatchInput(body, { hasInviter: !!inviter });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data: { ownerName?: string; entries?: object; kind?: string | null; km?: number } = {};
  if (parsed.value.ownerName) data.ownerName = parsed.value.ownerName;
  if (parsed.value.entries) {
    const entries = pinCarried(parsed.value.entries, inviter?.homeCity ?? null);
    const shape = mapShape(map.homeCity, entries, parsed.value.repeatMax ?? 1);
    Object.assign(data, { entries, kind: shape.kind, km: shape.km });
    // A lantern that is gold (or has a live link) keeps its question: removing
    // that answer would orphan the vouch, so it is refused.
    const kept = new Set(entries.flatMap((e) => ("questionIndex" in e ? [e.questionIndex] : [])));
    const tied = await prisma.vouch.findMany({ where: { mapId: map.id }, select: { entryIndex: true } });
    if (tied.some((v) => !kept.has(v.entryIndex))) {
      return NextResponse.json({ error: "A lantern that answered back can't be removed." }, { status: 409 });
    }
  }
  const updated = await prisma.map.update({ where: { id: map.id }, data });
  await trackEvent("map_updated", null, { n: parseEntries(updated.entries).length });
  return NextResponse.json(toPublicMap(updated), { headers: noStore });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const limited = await limitRequest(req, "map_delete", { device: [10, HOUR], ip: [60, HOUR] });
  if (limited) return limited;
  const { id } = await params;
  const owned = await requireOwner(req, id);
  if (owned.error) return owned.error;
  // Real delete: links, vouches and events cascade; maps it brought in lose the pointer.
  await prisma.map.delete({ where: { id: owned.map.id } });
  await trackEvent("map_deleted");
  return NextResponse.json({ ok: true }, { headers: noStore });
}
