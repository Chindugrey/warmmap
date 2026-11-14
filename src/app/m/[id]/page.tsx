import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicMap } from "@/components/PublicMap";
import { findMap } from "@/lib/owner";
import { toPublicMap } from "@/lib/public-map";
import { SITE_URL, mapUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const row = await findMap(id);
  if (!row) return { title: "Map not found", robots: { index: false, follow: false } };
  const map = toPublicMap(row);
  const owner = map.ownerName || "Someone";
  const ogUrl = `${SITE_URL}/api/og?id=${map.id}`;
  const description = `The people who've had ${owner}'s back, across ${map.stats.cities} ${map.stats.cities === 1 ? "city" : "cities"}. Names hidden.`;
  return {
    title: `${owner}'s Warm Map`,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: mapUrl(map.id) },
    openGraph: {
      title: `${owner}'s Warm Map`,
      description,
      url: mapUrl(map.id),
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${owner}'s Warm Map` }],
    },
    twitter: { card: "summary_large_image", images: [ogUrl] },
  };
}

export default async function MapPage({ params }: Props) {
  const { id } = await params;
  const row = await findMap(id);
  if (!row) notFound();
  return <PublicMap map={toPublicMap(row)} />;
}
