// Server-rendered HTML for /admin/dashboard. Self-contained: inline style, no
// script, no fonts or files from anywhere else. Every value goes through esc().
import type { Dashboard, Windowed } from "./dashboard";

export const esc = (v: unknown) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const num = (v: number) => v.toLocaleString("en-IN");
const ist = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const CSS = `
:root{color-scheme:light}*{box-sizing:border-box}
body{margin:0;background:#F1E6CF;color:#3a2a1a;font:16px/1.5 Georgia,'Times New Roman',serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:32px 0 8px;border-bottom:1px solid #c9b48a;padding-bottom:4px}
p.sub{margin:0 0 8px;color:#6b5438}.def{font-size:14px;color:#6b5438;margin:4px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tile{background:#fbf5e6;border:1px solid #d9c7a0;border-radius:8px;padding:10px 12px}
.tile b{display:block;font-size:26px;line-height:1.2}.tile span{font-size:13px;color:#6b5438}
table{width:100%;border-collapse:collapse;background:#fbf5e6;border:1px solid #d9c7a0;font-size:15px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e6d8b8}th{font-size:13px;color:#6b5438;font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}td:first-child{white-space:nowrap}
.wrap{overflow-x:auto}.bar{height:10px;background:#d98a1c;border-radius:5px;min-width:2px}
form.out{position:absolute;top:12px;right:16px;margin:0}
nav.adm{margin:0 0 12px;font-size:15px}nav.adm a{margin-right:14px;color:#8a4b0f}a{color:#8a4b0f}
form.q{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}form.q input{width:auto;flex:1;min-width:180px}.pager{margin:10px 0}.pager a,.pager span{margin-right:12px}
button,input{font:inherit}button{padding:8px 16px;border:1px solid #3a2a1a;background:#3a2a1a;color:#F1E6CF;border-radius:6px;cursor:pointer}
input{padding:8px;border:1px solid #8a7550;border-radius:6px;width:100%;max-width:420px;background:#fffdf6}
.err{color:#8b1a1a}
@media (max-width:480px){h1{font-size:23px}.tile b{font-size:22px}}`;

export const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

export const ADMIN_NAV =
  `<nav class="adm"><a href="/admin/dashboard">Overview</a><a href="/admin/dashboard/creators">Creators</a><a href="/admin/dashboard/virality">Virality and channels</a><a href="/admin/dashboard/ranking">Warmth ranking</a></nav>`;
export const signOut = `<form class="out" method="post" action="/admin/dashboard"><input type="hidden" name="logout" value="1"><button type="submit">Sign out</button></form>`;

export function renderLogin(failed: boolean): string {
  return page(
    "Admin",
    `<h1>Warm Map admin</h1><p class="sub">Enter the admin token.</p>${failed ? '<p class="err" role="alert">That token did not match.</p>' : ""}` +
      `<form method="post" action="/admin/dashboard"><p><label>Token<br><input type="password" name="token" autocomplete="off" required></label></p><button type="submit">Open dashboard</button></form>`
  );
}

export const tile = (value: string, label: string) => `<div class="tile"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
const windowTiles = (w: Windowed, what: string) =>
  tile(num(w.total), `${what}, total`) + tile(num(w.today), `${what}, today (IST)`) + tile(num(w.d7), `${what}, last 7 days`) + tile(num(w.d30), `${what}, last 30 days`);
export const table = (head: string[], rows: (string | number)[][]) =>
  `<div class="wrap"><table><thead><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
  (rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ""}>${esc(typeof c === "number" ? num(c) : c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}">Nothing yet.</td></tr>`) +
  `</tbody></table></div>`;

export function renderDashboard(d: Dashboard): string {
  const top = Math.max(1, ...d.funnel.map((f) => f.all));
  const funnel =
    `<div class="wrap"><table><thead><tr><th>Step</th><th class="n">All time</th><th class="n">Last 7 days</th><th class="n">% of previous (all time)</th><th></th></tr></thead><tbody>` +
    d.funnel
      .map((f, i) => {
        const prev = i ? d.funnel[i - 1].all : 0;
        const pct = i && prev ? `${Math.round((f.all / prev) * 100)}%` : "";
        return `<tr><td>${esc(f.label)}</td><td class="n">${num(f.all)}</td><td class="n">${num(f.d7)}</td><td class="n">${pct}</td><td style="width:30%"><div class="bar" style="width:${Math.max(0, Math.round((f.all / top) * 100))}%"></div></td></tr>`;
      })
      .join("") +
    `</tbody></table></div>`;

  return page(
    "Dashboard",
    `<form class="out" method="post" action="/admin/dashboard"><input type="hidden" name="logout" value="1"><button type="submit">Sign out</button></form>` +
      ADMIN_NAV +
      `<h1>Warm Map dashboard</h1><p class="sub">Counts only: no names, anywhere. Updated ${esc(ist(d.generatedAt))} IST. "Today" starts 00:00 IST.</p>` +
      `<h2>Maps created</h2><div class="grid">${windowTiles(d.maps, "Maps")}</div>` +
      `<p class="def">Definition: maps that exist now (a deleted map is gone from this count). A map started from a thank-you keeps a date-only stamp (by design), so it can land on the previous IST day.</p>` +
      `<h2>Lanterns lit</h2><div class="grid">${tile(num(d.lanterns.total), "Lanterns, total")}${tile(String(d.lanterns.avgPerMap), "Average per map")}</div>` +
      `<p class="def">Definition: lanterns the owner lit on existing maps (answers to the questions). The carried lantern that points back to whoever brought them is not counted.</p>` +
      `<h2>Thank-links to vouches</h2><div class="grid">${windowTiles(d.thanks.links, "Thank-links created")}${windowTiles(d.thanks.vouches, "Vouches")}${tile(String(d.thanks.vouchPerLink), "Vouches per thank-link")}</div>` +
      `<p class="def">Definition: thank-links = links made on owners' phones (rows kept on existing maps). Vouch = one tap of "Tie it back" on a thank-link (a lantern turned gold). Vouches per thank-link = vouches total / thank-links total.</p>` +
      `<h2>Funnel</h2>${funnel}` +
      `<p class="def">Definitions (anonymous events, not people, so it is a flow and not a cohort): Start = tap on the first "Start" button. 5+ lanterns = the fifth lantern lit in a draft. Saved = a map was saved with "Show me" (counts maps later deleted). Vouch = a "Tie it back" tap. A later step can exceed an earlier one in a short window because it includes people who started earlier.</p>` +
      `<h2>New maps per map (the viral factor)</h2><div class="grid">${tile(String(d.viral.newMapsPerMap), "New maps per map")}${tile(num(d.viral.invitedMaps), "Maps that came from another map")}${tile(num(d.viral.inviterMaps), "Maps that brought one in")}${tile(num(d.viral.mapsFromMaps), "Arrived from a shared map")}${tile(num(d.viral.mapsFromThanks), "Arrived from a thank-you")}${tile(num(d.viral.makeYoursFromMaps), "Make yours, from a map")}${tile(num(d.viral.makeYoursFromThanks), "Make yours, from a thank-you")}</div>` +
      `<p class="def">Definition: new maps per map = maps that arrived from another map's share (they carry that map's id) / all maps. If the inviting map is deleted, its pointer is cleared and those maps drop out of this count.</p>` +
      `<h2>Share, open, "Make yours" by channel</h2>${table(["Channel", "Shares", "Opens", "Make yours"], d.channels.map((c) => [c.label, c.shares, c.opens, c.makeYours]))}` +
      `<p class="def">Shares = share taps (WhatsApp, LinkedIn, copy, Story). Opens = visits to a map or thank-you page whose link carried the tag ?s=wa|li|cp|st (a link with no tag is not attributed). Make yours (by channel) = arrivals through "Make yours" whose link carried a tag (links do not carry the tag yet, so this column reads 0 until they do; the untagged total is in the viral section). Shares go out untagged too (e.g. a card shared natively), so opens can be below or above shares.</p>` +
      `<h2>Invite generations</h2>${table(["Generation", "Maps"], d.generations.map((g) => [g.generation === 0 ? "0 (no inviter)" : String(g.generation), g.maps]))}` +
      `<p class="def">Generation 0 = maps made without another map's invite; 1 = invited by a generation 0 map; and so on.</p>` +
      `<h2>Top cities and countries</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${table(["Home city", "Maps"], d.topCities.map((c) => [c.city, c.maps]))}${table(["Country", "Maps"], d.topCountries.map((c) => [c.country, c.maps]))}</div>` +
      `<h2>Arrived via</h2>${table(["Arrived via", "Maps"], d.arrivedVia.map((v) => [v.via, v.maps]))}` +
      `<p class="def">cold = no invite; map = from a shared map; thanks = from a thank-you; seed = placed by us.</p>` +
      `<h2>Recent activity</h2>${table(["Time (IST)", "Event", "Detail"], d.recent.map((r) => [ist(r.at), r.event, r.detail]))}` +
      `<p class="def">The last 30 events (page views left out). Events carry no names or ids.</p>`
  );
}
