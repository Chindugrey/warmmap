// Every link and preview address is built from the fixed site address, never
// from the incoming request. Overridable only for local runs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://warmmap.world").replace(/\/+$/, "");

export const mapUrl = (slug: string) => `${SITE_URL}/m/${slug}`;
