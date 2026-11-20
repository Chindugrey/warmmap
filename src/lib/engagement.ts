// Phase 3: the manual engagement log. Pure validation and aggregation (no database,
// see the route for the queries). Everything is typed in by an admin: nothing is ever
// fetched from a platform. No names of people are stored: platform, a campaign label,
// an optional post URL, three counts, a date and a short note.
export const PLATFORMS = ["linkedin", "whatsapp_status", "instagram", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = { linkedin: "LinkedIn", whatsapp_status: "WhatsApp Status", instagram: "Instagram", other: "Other" };

export const COUNT_MAX = 10_000_000;
export const NOTE_MAX = 280;
export const URL_MAX = 300;
export const LIST_CAP = 5000; // rows aggregated per request; a cut is reported
export const RECENT_SHOWN = 100;

export interface EngagementInput {
  mapRef: string | null; // public id, short slug, internal id or the owner's name; resolved by the route
  platform: Platform;
  campaign: string | null;
  postUrl: string | null;
  likes: number;
  comments: number;
  reshares: number;
  occurredOn: string; // YYYY-MM-DD
  note: string | null;
}

export type Parsed = { ok: true; value: EngagementInput } | { ok: false; errors: Record<string, string> };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : null);
const CAMPAIGN_RE = /^[a-z0-9][a-z0-9 _-]{0,39}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today in IST as YYYY-MM-DD. */
export const istToday = (now = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

function parseCount(v: unknown, label: string, errors: Record<string, string>, field: string): number {
  const s = typeof v === "number" ? String(v) : str(v);
  if (s === null || (s !== "" && !/^\d{1,8}$/.test(s)) || Number(s) > COUNT_MAX) {
    errors[field] = `${label} must be a whole number from 0 to ${COUNT_MAX.toLocaleString("en-IN")}.`;
    return 0;
  }
  return s === "" ? 0 : Number(s);
}

export function parseEngagement(raw: Record<string, unknown>, now = Date.now()): Parsed {
  const errors: Record<string, string> = {};
  const platform = str(raw.platform);
  if (!platform || !(PLATFORMS as readonly string[]).includes(platform)) errors.platform = "Pick a platform.";

  const campaignRaw = str(raw.campaign);
  const campaign = campaignRaw === null ? null : campaignRaw.toLowerCase();
  if (campaignRaw === null || (campaign && !CAMPAIGN_RE.test(campaign))) {
    errors.campaign = "Campaign: up to 40 letters, digits, spaces, - or _ (e.g. launch-week).";
  }

  let postUrl: string | null = null;
  const u = str(raw.postUrl);
  if (u === null || u.length > URL_MAX) errors.postUrl = `Post URL must be an http(s) link of at most ${URL_MAX} characters.`;
  else if (u) {
    try {
      const url = new URL(u);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("scheme");
      url.hash = "";
      postUrl = url.toString();
    } catch {
      errors.postUrl = `Post URL must be an http(s) link of at most ${URL_MAX} characters.`;
    }
  }

  const likes = parseCount(raw.likes, "Likes", errors, "likes");
  const comments = parseCount(raw.comments, "Comments", errors, "comments");
  const reshares = parseCount(raw.reshares, "Reshares", errors, "reshares");

  const d = str(raw.occurredOn);
  const m = d ? DATE_RE.exec(d) : null;
  const real = m && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
  if (!real || d! > istToday(now) || d! < "2026-01-01") errors.occurredOn = "Date must be a real day (YYYY-MM-DD), not in the future.";

  const noteRaw = str(raw.note);
  const note = noteRaw === null ? null : noteRaw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (noteRaw === null || (note && note.length > NOTE_MAX)) errors.note = `Note: at most ${NOTE_MAX} characters.`;

  const mapRaw = str(raw.map);
  if (mapRaw === null || mapRaw.length > 80) errors.map = "Map reference: a public id, a short link name, or the owner's name (at most 80 characters).";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      mapRef: mapRaw || null, platform: platform as Platform, campaign: campaign || null, postUrl,
      likes, comments, reshares, occurredOn: d!, note: note || null,
    },
  };
}

export interface LogRow {
  mapId: string | null;
  platform: string;
  campaign: string | null;
  likes: number;
  comments: number;
  reshares: number;
}
export interface Totals { posts: number; likes: number; comments: number; reshares: number; total: number }
export interface Group extends Totals { key: string | null }

const empty = (): Totals => ({ posts: 0, likes: 0, comments: 0, reshares: 0, total: 0 });
function add(t: Totals, r: LogRow) {
  t.posts += 1; t.likes += r.likes; t.comments += r.comments; t.reshares += r.reshares;
  t.total += r.likes + r.comments + r.reshares;
}

function groupBy(rows: LogRow[], key: (r: LogRow) => string | null): Group[] {
  const m = new Map<string | null, Group>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { key: k, ...empty() };
    add(g, r);
    m.set(k, g);
  }
  // biggest first; ties by key, the unlabelled bucket last
  return [...m.values()].sort((a, b) => b.total - a.total || (a.key === null ? 1 : b.key === null ? -1 : a.key.localeCompare(b.key)));
}

export interface Aggregate { totals: Totals; byMap: Group[]; byPlatform: Group[]; byCampaign: Group[] }

export function aggregate(rows: LogRow[]): Aggregate {
  const totals = empty();
  for (const r of rows) add(totals, r);
  return { totals, byMap: groupBy(rows, (r) => r.mapId), byPlatform: groupBy(rows, (r) => r.platform), byCampaign: groupBy(rows, (r) => r.campaign) };
}
