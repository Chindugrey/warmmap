// The friend's page: "The answer was you." The token is in the path; we look
// up its hash. The friend's name, if any, sits after # and stays in the browser.
import type { Metadata } from "next";
import { lookupThankLink } from "@/lib/thank-link";
import { FriendPage } from "@/components/FriendPage";
import { cardUrl, cardVersion, CARD_SIZES } from "@/lib/card";
import { numberWord, QUESTION_COUNT } from "@/lib/questions";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const found = await lookupThankLink(token);
  const owner = found.state === "missing" ? "Someone" : found.view.ownerName;
  const count = numberWord(found.state === "missing" ? QUESTION_COUNT : found.view.questionCount);
  const description = `You were the answer to one of ${count} questions. Open to see which.`;
  // Every link of a map previews the same, so a preview fetch reveals nothing.
  return {
    title: `${owner} lit a lantern for you`,
    description,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    twitter: { card: "summary_large_image" },
    openGraph: {
      title: `${owner} lit a lantern for you`,
      description,
      images: [{ url: found.state === "missing" ? cardUrl(null) : cardUrl(found.view.mapSlug, "link", false, cardVersion(found.map)), ...CARD_SIZES.link }],
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
