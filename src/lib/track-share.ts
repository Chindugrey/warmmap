// One share tap, counted on our server against the map it was made for (its slug). The owner's key goes in the
// header, as on every owner call: only the owner's tap counts against the map. Nothing else is sent.
import { apiFetch, ownerKeyFor } from "./device";

export const trackShare = (channel: string, slug: string) =>
  apiFetch("/api/analytics", { method: "POST", ownerKey: ownerKeyFor(slug), body: JSON.stringify({ event: "share", map: slug, metadata: { channel } }) }).catch(() => {});
