import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicMap } from "@/components/PublicMap";
import { mapStats } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

interface MapData {
  id: string;
  publicId: string;
  shortSlug?: string | null;
  homeCity: string;
  ownerName?: string | null;
  entries: any;
  vouchCount?: number;
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const proto = headersList.get("x-forwarded-proto");
  if (host) {
    return `${proto || "https"}://${host}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://warmmap.world";
}

async function fetchMap(id: string): Promise<MapData | null> {
  const map = await prisma.map.findFirst({
    where: {
      deletedAt: null,
      OR: [{ shortSlug: id }, { publicId: id }],
    },
    include: {
      _count: { select: { vouches: { where: { status: "verified" } } } },
    },
  });

  if (!map) return null;

  return {
    id: map.id,
    publicId: map.publicId,
    shortSlug: map.shortSlug,
    homeCity: map.homeCity,
    ownerName: map.ownerName,
    entries: map.entries,
    vouchCount: map._count.vouches,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const map = await fetchMap(id);
  if (!map) {
    return {
      title: "Map not found · Warm Map",
    };
  }

  const owner = map.ownerName || "Someone";
  const base = await getBaseUrl();
  const ogUrl = `${base}/api/og?id=${map.publicId}`;

  return {
    title: `${owner}'s Warm Map`,
    description: `A warm globe of the people ${owner} knows. Who's in your corner?`,
    openGraph: {
      title: `${owner}'s Warm Map · Warm Map`,
      description: `A warm globe of the people ${owner} knows. Who's in your corner?`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${owner}'s Warm Map` }],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
  };
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await fetchMap(id);
  if (!map) notFound();

  let entries: { city: string; questionIndex: number }[] = [];
  if (Array.isArray(map.entries)) {
    entries = map.entries as { city: string; questionIndex: number }[];
  } else if (typeof map.entries === "string") {
    try {
      entries = JSON.parse(map.entries || "[]");
    } catch {
      entries = [];
    }
  }

  const stats = mapStats(entries, map.homeCity);

  return (
    <PublicMap
      mapId={map.shortSlug || map.publicId}
      ownerName={map.ownerName ?? null}
      homeCity={map.homeCity}
      entries={entries}
      stats={stats}
      vouchCount={map.vouchCount ?? 0}
    />
  );
}
