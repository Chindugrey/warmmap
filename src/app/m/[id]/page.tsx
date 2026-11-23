import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicMap } from "@/components/PublicMap";
import { findMap } from "@/lib/owner";
import { toPublicMap } from "@/lib/public-map";
import { mapUrl } from "@/lib/site";
import { cardUrl, cardVersion, CARD_SIZES } from "@/lib/card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const row = await findMap(id);
  if (!row) return { title: "Map not found", robots: { index: false, follow: false } };
  const map = toPublicMap(row);
  const owner = map.ownerName || "Someone";
  const ogUrl = cardUrl(map.id, "link", false, cardVersion(row));
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
      images: [{ url: ogUrl, ...CARD_SIZES.link, alt: `${owner}'s Warm Map: cities only, names hidden` }],
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
