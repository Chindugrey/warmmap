// Server-rendered /admin/dashboard/engagement: the manual log form, and the per-map,
// per-platform and per-campaign views. Same rules as the other admin pages: inline
// style, no script, every value through esc(). No names of people are collected.
import { ADMIN_NAV, esc, num, page, signOut, tile } from "./dashboard-html";
import { PLATFORMS, PLATFORM_LABEL, NOTE_MAX, URL_MAX, type Aggregate, type Group, type Platform } from "./engagement";

export interface RecentRow {
  id: string;
  mapId: string | null;
  mapLabel: string; // owner first name + home city, or ""
  platform: string;
  campaign: string | null;
  postUrl: string | null;
  likes: number;
  comments: number;
  reshares: number;
  occurredOn: string;
  note: string | null;
}
export interface EngagementView {
  agg: Aggregate;
  mapLabels: Record<string, string>; // mapId -> "Asha, Pune"
  recent: RecentRow[];
  truncated: boolean;
  filter: { platform: string; campaign: string; map: string };
  today: string;
}
export interface FormState { values: Record<string, string>; errors: Record<string, string> }

const platformName = (p: string) => PLATFORM_LABEL[p as Platform] ?? p;
const CSS_EXTRA = `<style>form.log label{display:block;margin:0 0 10px;font-size:14px;color:#6b5438}form.log input,form.log select,form.log textarea{display:block;width:100%;max-width:520px;margin-top:2px;padding:8px;border:1px solid #8a7550;border-radius:6px;background:#fffdf6;font:inherit;color:#3a2a1a}form.log .row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:520px}form.log .err{margin:2px 0 0;font-size:13px}.ok{color:#2f6b2f}form.del{margin:0}form.del button{padding:2px 8px;font-size:13px}@media (max-width:480px){form.log .row{grid-template-columns:1fr}}</style>`;

const mapCell = (id: string | null, labels: Record<string, string>) =>
  id ? `<a href="/admin/dashboard/map/${encodeURIComponent(id)}">${esc(labels[id] || "(map)")}</a>` : "(no map)";

function groupTable(title: string, keyHead: string, groups: Group[], label: (k: string | null) => string, emptyKey: string): string {
  const rows = groups.length
    ? groups.map((g) => `<tr><td>${label(g.key) || esc(emptyKey)}</td><td class="n">${num(g.posts)}</td><td class="n">${num(g.likes)}</td><td class="n">${num(g.comments)}</td><td class="n">${num(g.reshares)}</td><td class="n">${num(g.total)}</td></tr>`).join("")
    : `<tr><td colspan="6">Nothing logged yet.</td></tr>`;
  return `<h2>${esc(title)}</h2><div class="wrap"><table><thead><tr><th>${esc(keyHead)}</th><th class="n">Posts</th><th class="n">Likes</th><th class="n">Comments</th><th class="n">Reshares</th><th class="n">Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function field(name: string, label: string, control: string, st: FormState): string {
  return `<label>${esc(label)}${control}${st.errors[name] ? `<span class="err" role="alert">${esc(st.errors[name])}</span>` : ""}</label>`;
}

export function renderEngagement(v: EngagementView, st: FormState, flash = ""): string {
  const val = (k: string) => esc(st.values[k] ?? "");
  const text = (name: string, type = "text", extra = "") => `<input type="${type}" name="${name}" value="${val(name)}" ${extra}>`;
  const count = (name: string) => `<input type="number" name="${name}" value="${val(name) || "0"}" min="0" max="10000000" step="1" inputmode="numeric">`;
  const chosen = st.values.platform ?? "linkedin";
  const select = `<select name="platform" required>${PLATFORMS.map((p) => `<option value="${p}"${p === chosen ? " selected" : ""}>${esc(PLATFORM_LABEL[p])}</option>`).join("")}</select>`;
  const form =
    `<form class="log" method="post" action="/admin/dashboard/engagement" id="log-form">` +
    field("map", "Map (public id, short link name or the owner's name; leave empty for a campaign-wide post)", text("map", "text", 'maxlength="80" autocomplete="off"'), st) +
    field("platform", "Platform", select, st) +
    field("campaign", "Campaign (optional, e.g. launch-week)", text("campaign", "text", 'maxlength="40" autocomplete="off"'), st) +
    field("postUrl", "Post URL (optional)", text("postUrl", "url", `maxlength="${URL_MAX}" autocomplete="off"`), st) +
    `<div class="row">${field("likes", "Likes", count("likes"), st)}${field("comments", "Comments", count("comments"), st)}${field("reshares", "Reshares", count("reshares"), st)}</div>` +
    field("occurredOn", "Date of the counts", text("occurredOn", "date", `required max="${esc(v.today)}"`).replace(`value=""`, `value="${esc(v.today)}"`), st) +
    field("note", `Note (optional, up to ${NOTE_MAX} characters; no names of friends or other people)`, `<textarea name="note" rows="3" maxlength="${NOTE_MAX}">${val("note")}</textarea>`, st) +
    `<button type="submit">Log engagement</button></form>`;

  const t = v.agg.totals;
  const tiles = `<div class="grid">${tile(num(t.posts), "Entries")}${tile(num(t.likes), "Likes")}${tile(num(t.comments), "Comments")}${tile(num(t.reshares), "Reshares")}</div>`;
  const filterActive = v.filter.platform || v.filter.campaign || v.filter.map;
  const filterForm =
    `<form class="q" method="get" action="/admin/dashboard/engagement"><select name="platform" aria-label="Filter by platform"><option value="">All platforms</option>${PLATFORMS.map((p) => `<option value="${p}"${p === v.filter.platform ? " selected" : ""}>${esc(PLATFORM_LABEL[p])}</option>`).join("")}</select>` +
    `<input type="search" name="campaign" value="${esc(v.filter.campaign)}" placeholder="Campaign" aria-label="Filter by campaign"><input type="search" name="map" value="${esc(v.filter.map)}" placeholder="Map public id" aria-label="Filter by map"><button type="submit">Filter</button>${filterActive ? ' <a href="/admin/dashboard/engagement">Clear</a>' : ""}</form>`;

  const recent = v.recent.length
    ? v.recent.map((r) =>
        `<tr><td>${esc(r.occurredOn)}</td><td>${mapCell(r.mapId, v.mapLabels)}</td><td>${esc(platformName(r.platform))}</td><td>${esc(r.campaign ?? "")}</td>` +
        `<td class="n">${num(r.likes)}</td><td class="n">${num(r.comments)}</td><td class="n">${num(r.reshares)}</td>` +
        `<td>${r.postUrl ? `<a href="${esc(r.postUrl)}" rel="noopener noreferrer nofollow">post</a>` : ""} ${esc(r.note ?? "")}</td>` +
        `<td><form class="del" method="post" action="/admin/dashboard/engagement"><input type="hidden" name="deleteId" value="${esc(r.id)}"><button type="submit" aria-label="Delete this entry">Delete</button></form></td></tr>`
      ).join("")
    : `<tr><td colspan="9">Nothing logged yet.</td></tr>`;

  return page(
    "Engagement log",
    CSS_EXTRA + signOut + ADMIN_NAV +
      `<h1>Engagement log</h1><p class="sub">Typed in by hand: nothing is fetched from LinkedIn or anywhere else. Counts and a short label only; no names of people.</p>` +
      (flash ? `<p class="ok" role="status">${esc(flash)}</p>` : "") +
      `<h2>Log engagement</h2>${form}` +
      `<h2>Views</h2>${filterForm}${tiles}` +
      (v.truncated ? `<p class="def">Showing the newest entries only; the views add up the newest ${num(5000)}.</p>` : "") +
      groupTable("Per map", "Map", v.agg.byMap, (k) => (k ? mapCell(k, v.mapLabels) : ""), "(no map)") +
      groupTable("Per platform", "Platform", v.agg.byPlatform, (k) => esc(k ? platformName(k) : ""), "(none)") +
      groupTable("Per campaign", "Campaign", v.agg.byCampaign, (k) => esc(k ?? ""), "(no campaign)") +
      `<h2>Latest entries</h2><div class="wrap"><table><thead><tr><th>Date</th><th>Map</th><th>Platform</th><th>Campaign</th><th class="n">Likes</th><th class="n">Comments</th><th class="n">Reshares</th><th>Post / note</th><th></th></tr></thead><tbody>${recent}</tbody></table></div>` +
      `<p class="def">Counts are what you read off the post on the day; log the same post again on a later date to track growth (each entry is added, so log only the new totals once per post to avoid double counting).</p>`
  );
}
