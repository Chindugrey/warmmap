// Owner proof is the keeper key (from /m/[id]#k=…), sent as "x-owner-key".
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Map as MapRow } from "@prisma/client";
import { prisma } from "./prisma";
import { safeEqualHex, sha256Hex } from "./server-crypto";

export async function findMap(id: string) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  return prisma.map.findFirst({ where: { OR: [{ shortSlug: id }, { publicId: id }] } });
}

export function keyMatches(map: Pick<MapRow, "ownerKeyHash">, key: string | null | undefined): boolean {
  if (!key || !map.ownerKeyHash || key.length > 128) return false;
  return safeEqualHex(sha256Hex(key), map.ownerKeyHash);
}

export async function requireOwner(
  req: NextRequest,
  id: string
): Promise<{ map: MapRow; error?: never } | { map?: never; error: NextResponse }> {
  const map = await findMap(id);
  if (!map) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!keyMatches(map, req.headers.get("x-owner-key"))) {
    return { error: NextResponse.json({ error: "This needs the map's key." }, { status: 403 }) };
  }
  return { map };
}

export const noStore = { "Cache-Control": "no-store" };
