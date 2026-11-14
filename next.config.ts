import type { NextConfig } from "next";

// Private pages: never indexed, and never leak their address as a referrer
// (a /t/ token or a /m/ page) when a link on them is followed.
const privatePageHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/t/:path*", headers: privatePageHeaders },
      { source: "/m/:path*", headers: privatePageHeaders },
      { source: "/api/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
