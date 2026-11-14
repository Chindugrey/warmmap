// Client side of the private thank-you link. Runs in the browser (and in tests).
// The phone makes the token; the server only ever receives its SHA-256 hash and
// the lantern index. The friend's name goes after "#", which browsers never send.

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeLanternToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashLanternToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PreparedThank {
  url: string; // goes into the owner's own WhatsApp message, never to us
  body: { mapId: string; entryIndex: number; tokenHash: string }; // POST /api/thanks
}

export async function prepareThank(opts: {
  base: string;
  mapId: string;
  entryIndex: number;
  friendName?: string;
}): Promise<PreparedThank> {
  const token = makeLanternToken();
  const tokenHash = await hashLanternToken(token);
  const name = (opts.friendName ?? "").trim().slice(0, 24);
  const url = `${opts.base}/t/${token}` + (name ? `#${encodeURIComponent(name)}` : "");
  return { url, body: { mapId: opts.mapId, entryIndex: opts.entryIndex, tokenHash } };
}

export function readFriendName(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw || raw.startsWith("k=")) return null;
  let name: string;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return null;
  }
  name = name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  return name || null;
}
