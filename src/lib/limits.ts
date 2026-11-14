// Who is asking, without knowing who they are. The device mark is a random id
// the browser keeps in localStorage and sends as "x-wm-device". IPs and marks
// are only ever stored as HMACs: IPs salted per day, device marks per scope.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dayStamp, hmacHex, serverSecret } from "./server-crypto";
import { hit, HOUR } from "./rate-limit";

export { HOUR };

const MARK_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function deviceMark(req: NextRequest): string | null {
  const m = req.headers.get("x-wm-device");
  return m && MARK_RE.test(m) ? m : null;
}

export function ipHash(req: NextRequest, now = new Date()): string {
  return hmacHex(serverSecret(), `ip:${dayStamp(now)}:${clientIp(req)}`);
}

/** Device hash scoped to one map, so one friend cannot be linked across maps. */
export function deviceHashFor(scope: string, req: NextRequest): string | null {
  const m = deviceMark(req);
  return m ? hmacHex(serverSecret(), `dev:${scope}:${m}`) : null;
}

export interface Limits {
  device: [number, number]; // [max, windowMs]
  ip: [number, number];
}

/**
 * Per-device first, per-IP as a looser backstop (many Indian phones share a
 * carrier IP). Without a device mark the request is limited by IP at the
 * device rate. Returns a 429 response, or null when allowed.
 */
export async function limitRequest(req: NextRequest, route: string, limits: Limits): Promise<NextResponse | null> {
  const secret = serverSecret();
  const day = dayStamp();
  const mark = deviceMark(req);
  const ip = clientIp(req);
  const devKey = mark ? hmacHex(secret, `rl:${route}:d:${mark}`) : hmacHex(secret, `rl:${route}:nd:${day}:${ip}`);
  const ipKey = hmacHex(secret, `rl:${route}:ip:${day}:${ip}`);
  const okDev = await hit(devKey, limits.device[0], limits.device[1]);
  const okIp = await hit(ipKey, limits.ip[0], limits.ip[1]);
  if (okDev && okIp) return null;
  return NextResponse.json(
    { error: "That's a lot from one place. Try again in a little while." },
    { status: 429, headers: { "Retry-After": "600" } }
  );
}
