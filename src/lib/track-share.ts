// One share tap, counted on our server against the map it was made for (its slug). The owner's key goes in the
// header, as on every owner call: only the owner's tap counts against the map. Nothing else is sent.
import { apiFetch, ownerKeyFor } from "./device";

// A thank-you sent from the thank-you sheet by copy or the share sheet says via "thanks", so warmth can leave it out
// (it is already scored as a thank-link, as WhatsApp thank-you sends are).
export const trackShare = (channel: string, slug: string, via?: "thanks") =>
  apiFetch("/api/analytics", { method: "POST", ownerKey: ownerKeyFor(slug), body: JSON.stringify({ event: "share", map: slug, metadata: via ? { channel, via } : { channel } }) }).catch(() => {});
