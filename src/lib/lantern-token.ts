// Client side of the private thank-you link. Runs in the browser (and in tests).
// The phone makes the token; the server only ever receives its SHA-256 hash and
// the lantern index. The friend's name goes after "#", which browsers never send.

const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 12; // 62^12 is about 2^71; links are single-use, expire and are rate limited

// No "-" or "_", so WhatsApp never breaks the link at a hyphen. Bytes at or above 248
// are skipped (248 = 4 x 62), so every symbol is equally likely.
export function makeLanternToken(): string {
  let out = "";
  while (out.length < TOKEN_LENGTH) {
    const bytes = new Uint8Array(TOKEN_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 248 && out.length < TOKEN_LENGTH) out += BASE62[b % 62];
    }
  }
  return out;
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
  /** Share channel tag (?s=), one of the allow-listed analytics tags. */
  channel?: "wa" | "li" | "cp" | "st";
}): Promise<PreparedThank> {
  const token = makeLanternToken();
  const tokenHash = await hashLanternToken(token);
  const name = (opts.friendName ?? "").trim().slice(0, 24);
  const url = `${opts.base}/t/${token}` + (opts.channel ? `?s=${opts.channel}` : "") + (name ? `#${encodeURIComponent(name)}` : "");
  return { url, body: { mapId: opts.mapId, entryIndex: opts.entryIndex, tokenHash } };
}

/**
 * The same thank-you link with another ?s= tag (or none): the token, and so the server row, stay the same, so one
 * lantern still has one link whichever way it is sent. The # part (the friend's name) is kept as it was.
 */
export function withChannelTag(url: string, channel: "wa" | "li" | "cp" | "st" | null): string {
  const hash = url.indexOf("#");
  const [head, frag] = hash < 0 ? [url, ""] : [url.slice(0, hash), url.slice(hash)];
  return head.replace(/\?s=[a-z]{2}$/, "") + (channel ? `?s=${channel}` : "") + frag;
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
