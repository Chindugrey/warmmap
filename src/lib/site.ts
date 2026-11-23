// Every link and preview address is built from the fixed site address, never
// from the incoming request. Overridable only for local runs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://warmmap.world").replace(/\/+$/, "");

export const mapUrl = (slug: string) => `${SITE_URL}/m/${slug}`;

/** "Follow Zeyhi on LinkedIn" under the share buttons. A plain link: no tracking, nothing collected. Change it here. */
export const ZEYHI_LINKEDIN_URL = "https://www.linkedin.com/company/zeyhi/";
