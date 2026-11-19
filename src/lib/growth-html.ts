// Server-rendered admin pages for phase-1 analytics. Same rules as the overview
// (dashboard-html.ts): inline style, no script, every value through esc().
// Names: the creators list and the warmth ranking show each map owner's FIRST
// name (already public on their map). Virality and the timeline show none.
import { ADMIN_NAV, esc, num, page, signOut, table, tile } from "./dashboard-html";
import {
  WARMTH_FORMULA, istStamp, pct,
  type CreatorQuery, type CreatorRow, type CreatorSort, type TimelineItem,
} from "./growth";
import type { Virality, WindowKey } from "./growth-load";

const head = (title: string, sub: string) => signOut + ADMIN_NAV + `<h1>${esc(title)}</h1><p class="sub">${sub}</p>`;
const def = (s: string) => `<p class="def">${s}</p>`;
const pctText = (v: number | null) => (v === null ? "" : `${v}%`);
const mapLink = (id: string, label: string) => `<a href="/admin/dashboard/map/${encodeURIComponent(id)}">${esc(label)}</a>`;

const qs = (o: Record<string, string | number>) =>
  "?" + Object.entries(o).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

const COLS: [CreatorSort | null, string, (r: CreatorRow) => string][] = [
  ["firstName", "First name", (r) => mapLink(r.id, r.firstName || "(none)")],
  ["homeCity", "Home city", (r) => esc(r.homeCity)],
  ["createdAt", "Created (IST)", (r) => esc(istStamp(r.createdAt, r.arrivedVia === "thanks"))],
  ["kind", "Kind", (r) => esc(r.kind)],
  ["lanterns", "Lanterns", (r) => num(r.lanterns)],
  ["cities", "Cities", (r) => num(r.cities)],
  ["km", "Km", (r) => num(r.km)],
  ["gold", "Gold", (r) => num(r.gold)],
  ["thankLinks", "Thank-links", (r) => num(r.thankLinks)],
  ["sharesTotal", "Shares (wa/li/cp/st/native)", (r) => `${num(r.sharesTotal)} <small>(${[r.shares.whatsapp, r.shares.linkedin, r.shares.copy, r.shares.story, r.shares.native].join("/")})</small>`],
  ["opens", "Opens", (r) => num(r.opens)],
  ["spawnedDirect", "Spawned", (r) => num(r.spawnedDirect)],
  ["spawnedAll", "Spawned, all gens", (r) => num(r.spawnedAll)],
  ["arrivedVia", "Arrived via", (r) => esc(r.arrivedVia)],
];

export function renderCreators(res: { total: number; pages: number; rows: CreatorRow[] }, cq: CreatorQuery): string {
  const base = { q: cq.q, sort: cq.sort, dir: cq.dir };
  const th = COLS.map(([key, label], i) => {
    const cls = i > 3 && i !== COLS.length - 1 ? ' class="n"' : "";
    if (!key) return `<th${cls}>${esc(label)}</th>`;
    const active = cq.sort === key;
    const dir = active && cq.dir === "desc" ? "asc" : "desc";
    return `<th${cls}><a href="${esc(qs({ ...base, sort: key, dir }))}">${esc(label)}${active ? (cq.dir === "desc" ? " &#8595;" : " &#8593;") : ""}</a></th>`;
  }).join("");
  const body = res.rows.length
    ? res.rows.map((r) => `<tr>${COLS.map(([, , cell], i) => `<td${i > 3 && i !== COLS.length - 1 ? ' class="n"' : ""}>${cell(r)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${COLS.length}">No maps match.</td></tr>`;
  const p = Math.min(cq.page, res.pages);
  const pager =
    `<div class="pager">` +
    (p > 1 ? `<a href="${esc(qs({ ...base, page: p - 1 }))}">&#8592; Previous</a>` : "") +
    `<span>Page ${p} of ${res.pages} (${num(res.total)} maps)</span>` +
    (p < res.pages ? `<a href="${esc(qs({ ...base, page: p + 1 }))}">Next &#8594;</a>` : "") +
    `<a href="${esc(qs({ ...base, format: "csv" }))}">Download CSV</a></div>`;
  return page(
    "Creators",
    head("Creators", "One row per map: the owner's first name and home city, dates and counts. No friends' names (the server never has them), no ids or fingerprints.") +
      `<form class="q" method="get" action="/admin/dashboard/creators"><input type="search" name="q" value="${esc(cq.q)}" placeholder="First name or city" aria-label="Search by first name or city"><input type="hidden" name="sort" value="${esc(cq.sort)}"><input type="hidden" name="dir" value="${esc(cq.dir)}"><button type="submit">Search</button></form>` +
      pager +
      `<div class="wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>` +
      pager +
      def(
        "Lanterns = lanterns the owner lit (the carried one is left out). Cities = distinct cities on the map. Gold = lanterns tied back. " +
          "Shares = share taps attributed to this map, by channel (share taps are counted without a map today, so this reads 0 until they carry one; see the notes). " +
          "Opens = visits to this map's public page. Spawned = maps that carry this map's id (made via its share or a thank-you); all gens = every generation below it. " +
          "A map made from a thank-you keeps a date-only stamp, by design."
      )
  );
}

export function renderRanking(rows: CreatorRow[]): string {
  return page(
    "Warmth ranking",
    head("Warmth ranking (creators)", `Creators, not connectors: who connectors are is unknowable by design. ${esc(WARMTH_FORMULA)}.`) +
      `<div class="wrap"><table><thead><tr><th>#</th><th>First name</th><th>Home city</th><th class="n">Warmth</th><th class="n">Thank-links sent</th><th class="n">Ties-back received</th><th class="n">Shares</th><th class="n">Spawned</th><th class="n">Spawned, later gens</th><th class="n">Opens (not scored)</th></tr></thead><tbody>` +
      (rows.length
        ? rows
            .map(
              (r, i) =>
                `<tr><td>${i + 1}</td><td>${mapLink(r.id, r.firstName || "(none)")}</td><td>${esc(r.homeCity)}</td><td class="n"><b>${num(r.warmth)}</b></td><td class="n">${num(r.thankLinks)}</td><td class="n">${num(r.gold)}</td><td class="n">${num(r.sharesTotal)}</td><td class="n">${num(r.spawnedDirect)}</td><td class="n">${num(r.spawnedAll - r.spawnedDirect)}</td><td class="n">${num(r.opens)}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="10">Nothing yet.</td></tr>`) +
      `</tbody></table></div>` +
      def("Top 100 by warmth; ties broken by newest map. Only maps with a warmth above 0 are listed.")
  );
}

const WINDOW_LABEL: Record<WindowKey, string> = { all: "All time", d30: "Last 30 days", d7: "Last 7 days" };

export function renderVirality(v: Virality): string {
  const windows = (Object.keys(WINDOW_LABEL) as WindowKey[])
    .map((w) => (w === v.window ? `<b>${esc(WINDOW_LABEL[w])}</b>` : `<a href="?w=${w}">${esc(WINDOW_LABEL[w])}</a>`))
    .join(" &middot; ");
  const f = v.funnel;
  const cohortTable = (rows: Virality["daily"], dateOnly: boolean) =>
    table(
      ["Cohort starts (IST)", "Maps made", "of which invited", "Direct children", "All generations", "New maps per map"],
      [...rows].reverse().map((r) => [istStamp(r.start, dateOnly), r.maps, r.invitedMaps, r.children, r.descendants, String(r.k)])
    );
  return page(
    "Virality and channels",
    head("Virality and channels", "Counts only: no names. Maps link to their parent through invitedByMapId; channels come from the ?s= tag on links.") +
      `<h2>New maps per map (viral factor)</h2><div class="grid">${tile(String(v.viral.k), "New maps per map, all time")}${tile(num(v.viral.maps), "Maps")}${tile(num(v.viral.invited), "Maps from another map")}${tile(num(v.viral.inviters), "Maps that brought one in")}${tile(String(v.kByRoute.map.k), "k via shared map")}${tile(String(v.kByRoute.thanks.k), "k via thank-you")}</div>` +
      def("New maps per map = maps that carry another map's id / all maps. k via shared map / via thank-you = the same, split by how the new map arrived (they add up to the total).") +
      `<h2>By weekly cohort</h2>${cohortTable(v.weekly, true)}` +
      def("A cohort = maps made in that IST week (Monday to Sunday). Direct children = maps those maps brought in, whenever they were made; new maps per map = direct children / maps made. Recent cohorts have had less time, so their numbers still rise.") +
      `<h2>By day (last 30 days)</h2>${cohortTable(v.daily, true)}` +
      `<h2>Invite generations</h2>${table(["Generation", "Maps"], v.generations.map((g) => [g.generation === 0 ? "0 (no inviter)" : String(g.generation), g.maps]))}` +
      `<h2>Biggest invite trees</h2>${
        `<div class="wrap"><table><thead><tr><th>Root map</th><th class="n">Root made (IST)</th><th class="n">Maps in tree</th><th class="n">Generations</th><th class="n">via shared map</th><th class="n">via thank-you</th></tr></thead><tbody>` +
        (v.topTrees.length
          ? v.topTrees.map((t, i) => `<tr><td>${mapLink(t.rootId, `Tree ${i + 1} timeline`)}</td><td class="n">${esc(istStamp(t.rootCreatedAt, true))}</td><td class="n">${num(t.size)}</td><td class="n">${num(t.generations)}</td><td class="n">${num(t.fromMap)}</td><td class="n">${num(t.fromThanks)}</td></tr>`).join("")
          : `<tr><td colspan="6">No map has brought one in yet.</td></tr>`) +
        `</tbody></table></div>`
      }` +
      def("A tree = a map with no inviter plus every map below it. Generations = how deep it goes.") +
      `<h2>Channel funnel: share, open, "Make yours", saved</h2><p class="sub">Window: ${windows}</p>` +
      `<div class="wrap"><table><thead><tr><th>Channel (?s=)</th><th class="n">Shares</th><th class="n">Opens</th><th class="n">open / share</th><th class="n">Make yours</th><th class="n">make yours / open</th><th class="n">Saved (est.)</th><th class="n">saved / make yours</th><th class="n">saved / share</th><th class="n">k (est.)</th></tr></thead><tbody>` +
      f.rows
        .map((r) => `<tr><td>${esc(r.label)} (${esc(r.channel)})</td><td class="n">${num(r.shares)}</td><td class="n">${num(r.opens)}</td><td class="n">${pctText(r.openPerShare)}</td><td class="n">${num(r.makeYours)}</td><td class="n">${pctText(r.makeYoursPerOpen)}</td><td class="n">${num(r.savedEst)}</td><td class="n">${pctText(r.savedPerMakeYours)}</td><td class="n">${pctText(r.savedPerShare)}</td><td class="n">${r.k}</td></tr>`)
        .join("") +
      `</tbody></table></div>` +
      `<div class="grid" style="margin-top:10px">${tile(num(f.makeYoursAll), "Make yours, all")}${tile(num(f.makeYoursUntagged), "Make yours with no tag")}${tile(num(f.invitedSaved), "Invited maps saved")}${tile(pctText(pct(f.invitedSaved, f.makeYoursAll)) || "0%", "Make yours to saved, overall")}${tile(num(f.nativeShares), "Shares by share sheet (no tag)")}</div>` +
      def(
        "Shares = share taps on that channel. Opens = visits to a map or thank-you page whose link carried ?s=wa|li|cp|st. Make yours = taps on \"Make yours\" from such a link. " +
          "A saved map does not record its tag, so Saved (est.) = that channel's Make yours x the overall Make-yours-to-saved rate (" +
          `${Math.round(f.saveRate * 100)}% in this window, capped at 100%). k (est.) = Saved (est.) / maps made in the window. ` +
          "Untagged traffic (share sheet, pasted links) is not in the rows."
      )
  );
}

export function renderTimeline(id: string, t: { items: TimelineItem[]; truncated: boolean }): string {
  return page(
    "Map timeline",
    head("Map timeline", `What happened to one map, in order (IST). No names. <a href="/admin/dashboard/map/${encodeURIComponent(id)}?format=json">JSON</a>`) +
      table(["When (IST)", "What", "Detail"], t.items.map((i) => [istStamp(i.at, i.dateOnly) + (i.dateOnly ? " (date only)" : ""), i.what, i.detail])) +
      (t.truncated ? def("Only the latest 500 shares / opens are listed.") : "") +
      def("Spawned maps are listed without a link or a name on purpose: they are other people's maps.")
  );
}
