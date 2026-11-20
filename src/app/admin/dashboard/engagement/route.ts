// /admin/dashboard/engagement[?platform=&campaign=&map=&format=json]: the manual engagement log.
// GET shows the form and the per-map / per-platform / per-campaign views. POST logs (or deletes) one
// entry. Admin only: the same cookie / Bearer gate as the rest. The cookie is SameSite=Strict and the
// CSP says form-action 'self'; a POST that carries a foreign Origin is refused as well. Manual only.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_HEADERS, adminGate, adminHtml, adminJson, adminNotFound } from "@/lib/admin-route";
import { LIST_CAP, PLATFORMS, RECENT_SHOWN, aggregate, istToday, parseEngagement } from "@/lib/engagement";
import { renderEngagement, type EngagementView, type FormState, type RecentRow } from "@/lib/engagement-html";
import { firstName } from "@/lib/growth";

export const dynamic = "force-dynamic";

const PATH = "/admin/dashboard/engagement";
const REF_RE = /^[A-Za-z0-9_\- ]{1,80}$/;

/** A foreign Origin means another site posted the form: refuse. No Origin (curl, same-origin GET) passes. */
function foreignOrigin(req: NextRequest): boolean {
  const o = req.headers.get("origin");
  if (!o || o === "null") return false; // "null": the admin pages send Referrer-Policy no-referrer, so a same-site browser POST says null; the SameSite=Strict cookie is the guard there
  try {
    return new URL(o).host !== (req.headers.get("host") ?? req.nextUrl.host);
  } catch {
    return true;
  }
}

/** A map by public id, short link name or internal id; else by owner name (only when exactly one map has it). */
async function resolveMap(ref: string): Promise<{ id: string } | { error: string }> {
  if (!REF_RE.test(ref)) return { error: "No map matches that." };
  const exact = await prisma.map.findFirst({ where: { OR: [{ publicId: ref }, { shortSlug: ref }, { id: ref }] }, select: { id: true } });
  if (exact) return exact;
  const named = await prisma.map.findMany({ where: { OR: [{ ownerName: { equals: ref, mode: "insensitive" } }, { ownerName: { startsWith: ref + " ", mode: "insensitive" } }] }, select: { id: true }, take: 2 });
  if (named.length === 1) return named[0];
  return { error: named.length ? "More than one map has that name: use the public id." : "No map matches that." };
}

async function load(filter: { platform: string; campaign: string; map: string }): Promise<EngagementView> {
  const where: Prisma.EngagementLogWhereInput = {};
  if ((PLATFORMS as readonly string[]).includes(filter.platform)) where.platform = filter.platform;
  else filter.platform = "";
  if (filter.campaign) where.campaign = filter.campaign.toLowerCase().slice(0, 40);
  if (filter.map) {
    const m = REF_RE.test(filter.map) ? await resolveMap(filter.map) : { error: "x" };
    where.mapId = "id" in m ? m.id : "no-such-map";
  }
  const rows = await prisma.engagementLog.findMany({ where, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }], take: LIST_CAP + 1 });
  const truncated = rows.length > LIST_CAP;
  const used = rows.slice(0, LIST_CAP);
  const ids = [...new Set(used.map((r) => r.mapId).filter((x): x is string => !!x))];
  const maps = ids.length ? await prisma.map.findMany({ where: { id: { in: ids } }, select: { id: true, ownerName: true, homeCity: true } }) : [];
  const mapLabels = Object.fromEntries(maps.map((m) => [m.id, [firstName(m.ownerName), m.homeCity].filter(Boolean).join(", ")]));
  const recent: RecentRow[] = used.slice(0, RECENT_SHOWN).map((r) => ({
    id: r.id, mapId: r.mapId, mapLabel: r.mapId ? mapLabels[r.mapId] ?? "" : "", platform: r.platform, campaign: r.campaign, postUrl: r.postUrl,
    likes: r.likes, comments: r.comments, reshares: r.reshares, occurredOn: r.occurredOn.toISOString().slice(0, 10), note: r.note,
  }));
  return { agg: aggregate(used), mapLabels, recent, truncated, filter, today: istToday() };
}

const clean = (v: string | null) => (v ?? "").slice(0, 100);

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const view = await load({ platform: clean(sp.get("platform")), campaign: clean(sp.get("campaign")), map: clean(sp.get("map")) });
  if (sp.get("format") === "json") return adminJson({ ...view, perMap: view.agg.byMap, perPlatform: view.agg.byPlatform, perCampaign: view.agg.byCampaign, totals: view.agg.totals });
  return adminHtml(renderEngagement(view, { values: {}, errors: {} }, sp.get("ok") ? "Logged." : sp.get("deleted") ? "Deleted." : ""), 200);
}

export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  if (foreignOrigin(req)) return adminJson({ error: "Cross-site request refused" }, 403);
  const wantsJson = /application\/json/i.test(req.headers.get("content-type") ?? "");
  let raw: Record<string, unknown> = {};
  try {
    if (wantsJson) {
      const b = await req.json();
      if (b && typeof b === "object" && !Array.isArray(b)) raw = b as Record<string, unknown>;
    } else {
      raw = Object.fromEntries([...(await req.formData()).entries()].filter(([, v]) => typeof v === "string"));
    }
  } catch {
    return adminJson({ error: "Could not read the request body" }, 400);
  }

  const fail = async (errors: Record<string, string>, status = 400) => {
    if (wantsJson) return adminJson({ error: "Invalid", errors }, status);
    const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 400) : String(v ?? "")]));
    return adminHtml(renderEngagement(await load({ platform: "", campaign: "", map: "" }), { values, errors } satisfies FormState), status);
  };

  if (typeof raw.deleteId === "string" && raw.deleteId) {
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(raw.deleteId)) return adminNotFound();
    const r = await prisma.engagementLog.deleteMany({ where: { id: raw.deleteId } });
    if (!r.count) return adminNotFound();
    if (wantsJson) return adminJson({ deleted: true });
    return new NextResponse(null, { status: 303, headers: { ...ADMIN_HEADERS, Location: `${PATH}?deleted=1` } });
  }

  const parsed = parseEngagement(raw);
  if (!parsed.ok) return fail(parsed.errors);
  const v = parsed.value;
  let mapId: string | null = null;
  if (v.mapRef) {
    const m = await resolveMap(v.mapRef);
    if ("error" in m) return fail({ map: m.error }, 404);
    mapId = m.id;
  }
  const row = await prisma.engagementLog.create({
    data: { mapId, platform: v.platform, campaign: v.campaign, postUrl: v.postUrl, likes: v.likes, comments: v.comments, reshares: v.reshares, occurredOn: new Date(`${v.occurredOn}T00:00:00Z`), note: v.note },
  });
  if (wantsJson) return adminJson({ id: row.id, mapId, platform: v.platform, campaign: v.campaign, likes: v.likes, comments: v.comments, reshares: v.reshares, occurredOn: v.occurredOn }, 201);
  return new NextResponse(null, { status: 303, headers: { ...ADMIN_HEADERS, Location: `${PATH}?ok=1` } });
}
