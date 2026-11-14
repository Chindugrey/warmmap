import type { Metadata, Viewport } from "next";
import {
  IM_Fell_English,
  IM_Fell_English_SC,
  EB_Garamond,
  Courier_Prime,
} from "next/font/google";
import "./globals.css";
import "./storybook.css";
import { cardUrl, CARD_SIZES } from "@/lib/card";

const imFellEnglish = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const imFellEnglishSC = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F1E6CF",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://warmmap.world"),
  title: {
    default: "Warm Map · Who's in your corner?",
    template: "%s · Warm Map",
  },
  description:
    "Almost everything good in your life came through someone. Put those people on one warm globe, and share it with them.",
  openGraph: {
    type: "website",
    images: [{ url: cardUrl(null), ...CARD_SIZES.link, alt: "Warm Map: a globe of lanterns, one for each person in your corner" }],
    url: "/",
    siteName: "Warm Map",
    locale: "en_IN",
    title: "Warm Map · Who's in your corner?",
    description:
      "Almost everything good in your life came through someone. Put those people on one warm globe, and share it with them.",
  },
  twitter: {
    card: "summary_large_image",
    images: [cardUrl(null)],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${imFellEnglish.className} ${imFellEnglishSC.className} ${ebGaramond.className} ${courierPrime.className}`}
      style={{
        ["--font-warm-display" as string]: imFellEnglish.style.fontFamily,
        ["--font-warm-caps" as string]: imFellEnglishSC.style.fontFamily,
        ["--font-warm-body" as string]: ebGaramond.style.fontFamily,
        ["--font-warm-type" as string]: courierPrime.style.fontFamily,
      }}
    >
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
