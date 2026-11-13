import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicMap } from "@/components/PublicMap";
import { mapStats } from "@/lib/geo";

interface MapData {
  id: string;
  publicId: string;
  shortSlug?: string | null;
  homeCity: string;
  ownerName?: string | null;
  entries: string; // JSON: [{ city, questionIndex }]
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
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/maps/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MapData;
  } catch {
    return null;
  }
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
  try {
    entries = JSON.parse(map.entries || "[]");
  } catch {
    entries = [];
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
