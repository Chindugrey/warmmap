// One share tap, counted on our server against the map it was made for (its slug). Nothing else is sent.
import { apiFetch } from "./device";

export const trackShare = (channel: string, slug: string) =>
  apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "share", map: slug, metadata: { channel } }) }).catch(() => {});
