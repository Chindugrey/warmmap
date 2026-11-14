// The friend's page: "The answer was you." The token is in the path; we look
// up its hash. The friend's name, if any, sits after # and stays in the browser.
import type { Metadata } from "next";
import { lookupThankLink } from "@/lib/thank-link";
import { FriendPage } from "@/components/FriendPage";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const found = await lookupThankLink(token);
  const owner = found.state === "missing" ? "Someone" : found.view.ownerName;
  // Every link of a map previews the same, so a preview fetch reveals nothing.
  return {
    title: `${owner} lit a lantern for you`,
    description: "You were the answer to one of twelve questions. Open to see which.",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    openGraph: {
      title: `${owner} lit a lantern for you`,
      description: "You were the answer to one of twelve questions. Open to see which.",
      images: found.state === "missing" ? [] : [{ url: `${SITE_URL}/api/og?id=${found.view.mapSlug}`, width: 1200, height: 630 }],
    },
  };
}

export default async function ThankPage({ params }: Props) {
  const { token } = await params;
  const found = await lookupThankLink(token);
  if (found.state === "missing") {
    return <FriendPage token={token} state="missing" view={null} />;
  }
  return <FriendPage token={token} state={found.state} view={found.view} />;
}
