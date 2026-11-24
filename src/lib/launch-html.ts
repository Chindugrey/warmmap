// Server-rendered /admin/dashboard/launch. Same rules as the other admin pages:
// inline style, no script, every value through esc(). No names at all.
import { ADMIN_NAV, esc, num, page, signOut, table } from "./dashboard-html";
import { istStamp } from "./growth";
import { LAUNCH_START, TARGETS, TIE_MIN_LINKS, type ChannelLine, type Scoreboard, type Status } from "./launch";

const MARK: Record<Status, string> = { ok: "✅ on target", below: "⚠ below target", early: "⏳ too early", none: "– no data yet" };
const pctText = (v: number | null) => (v === null ? "–" : `${v}%`);

function row(name: string, value: string, target: string, status: Status, def: string): string {
  return (
    `<tr><td><b>${esc(name)}</b><p class="def">${def}</p></td><td class="n"><b>${esc(value)}</b></td>` +
    `<td class="n">${esc(target)}</td><td class="st-${status}">${esc(MARK[status])}</td></tr>`
  );
}

const channelRow = (c: ChannelLine) =>
  `<tr><td>${esc(c.label)}${c.channel === "all" ? "" : ` (${esc(c.channel)})`}</td><td class="n">${num(c.shares)}</td>` +
  (c.channel === "native"
    ? `<td class="n">–</td><td class="n">–</td><td>no tag: opens not attributable</td><td class="n">–</td><td class="n">–</td><td></td>`
    : `<td class="n">${num(c.opens)}</td><td class="n">${pctText(c.openPerShare)}</td><td class="st-${c.openStatus}">${esc(MARK[c.openStatus])}</td>` +
      `<td class="n">${num(c.makeYours)}</td><td class="n">${pctText(c.startPerOpen)}</td><td class="st-${c.startStatus}">${esc(MARK[c.startStatus])}</td>`) +
  `</tr>`;

const STYLE = `<style>.st-ok{color:#1f6b2a}.st-below{color:#8b1a1a}.st-early,.st-none{color:#6b5438}table.lt td:first-child{white-space:normal}td .def{margin:2px 0 0;max-width:560px}.post{font-size:20px;background:#fbf5e6;border:1px solid #d9c7a0;border-radius:8px;padding:10px 12px}</style>`;

export function renderLaunch(s: Scoreboard): string {
  const T = TARGETS;
  const tieValue = `${pctText(s.tieBack.value)} (${s.tieBack.tiedIn48h} of ${s.tieBack.eligible})`;
  const fridayOk = s.friday.post === "numbers";
  const hourly = table(
    ["Hour starting (IST)", "Maps", "Lanterns", "Tie-backs"],
    [...s.hourly.rows].reverse().map((h) => [istStamp(h.hour), h.maps, h.lanterns, h.tieBacks])
  );
  return page(
    "Launch scoreboard",
    STYLE + signOut + ADMIN_NAV +
      `<h1>Launch scoreboard</h1>` +
      `<p class="sub">Window: <b>${esc(istStamp(s.from))}</b> to <b>${esc(istStamp(s.to))}</b> IST. Updated ${esc(istStamp(s.generatedAt))} IST. Counts only: no names. ` +
      `Change it with <code>?from=</code> and <code>?to=</code> (ISO times, e.g. <code>?from=${esc(LAUNCH_START)}</code>); the default runs from launch (18:30 IST, Wed 25 Nov) to now.</p>` +
      (s.windowNote ? `<p class="err">${esc(s.windowNote)}</p>` : "") +
      `<h2>Targets (by Fri 27 Nov)</h2>` +
      `<div class="wrap"><table class="lt"><thead><tr><th>Metric</th><th class="n">Value</th><th class="n">Target</th><th>Status</th></tr></thead><tbody>` +
      row("Maps created", num(s.maps.value ?? 0), `≥ ${num(T.maps)}`, s.maps.status,
        `Maps saved in the window that still exist, seed maps (arrivedVia = seed, placed by us) left out${s.maps.seedLeftOut ? `: ${num(s.maps.seedLeftOut)} left out` : ""}. ` +
        `A map made from a thank-you keeps a date-only stamp (00:00 UTC), so it counts from 00:00 UTC of the window's first day (${num(s.maps.fromThanks)} such maps here). /api/counter itself leaves nothing out.`) +
      row("K (new maps per map)", s.k.value === null ? "–" : String(s.k.value), `≥ ${T.k}`, s.k.status,
        `Same definition as the viral factor (growth.ts viralFactor): maps in the window that carry a live inviter's id (invitedByMapId) ÷ all maps in the window = ${num(s.k.invited)} ÷ ${num(s.k.maps)}. ` +
        `The inviter may be any map, made in the window or before. For reference, ${num(s.k.inviters)} distinct maps did the inviting` +
        (s.k.perInviter === null ? "." : ` (${s.k.perInviter} new maps per inviting map; that ratio is 1 or more by construction, so it is not the target).`)) +
      row("Tie-back rate (within 48 h)", tieValue, `≥ ${T.tieBackPct}%`, s.tieBack.status,
        `Thank-links made in the window on non-seed maps and at least 48 h old at ${esc(istStamp(s.tieBack.asOf))} IST (the window's end, or now if sooner): ${num(s.tieBack.eligible)} of ${num(s.tieBack.links)}. ` +
        `Tied = the link was used (usedAt, a "Tie it back" tap) within 48 h of being made. "Too early" while fewer than ${TIE_MIN_LINKS} links are 48 h old. ` +
        `All ${num(s.tieBack.links)} links in the window, any age: ${num(s.tieBack.tiedAnyTime)} tied so far.`) +
      row("Share → open (all channels)", pctText(s.funnel.overall.openPerShare), `≥ ${T.openPerSharePct}%`, s.funnel.overall.openStatus,
        `Opens of a map or thank-you page whose link carried ?s=wa|li|cp|st ÷ share taps on WhatsApp, LinkedIn, copy, Story and share sheet = ${num(s.funnel.overall.opens)} ÷ ${num(s.funnel.overall.shares)}. ` +
        `Share taps are stamped 00:00 IST of their day, so they count from 00:00 IST of the window's first day. Per channel below.`) +
      row("Open → start map (all channels)", pctText(s.funnel.overall.startPerOpen), `≥ ${T.startPerOpenPct}%`, s.funnel.overall.startStatus,
        `"Make yours" taps from a link with a ?s= tag ÷ those tagged opens = ${num(s.funnel.overall.makeYours)} ÷ ${num(s.funnel.overall.opens)} (the virality page's channel funnel, over this window).`) +
      row("LinkedIn posts", s.linkedinPosts === null ? "from the roster sheet" : num(s.linkedinPosts), "–", "none",
        s.linkedinPosts === null
          ? "This deployment has no engagement log table, so the count lives in the roster sheet."
          : "Rows in the engagement log with platform linkedin dated (IST) on the window's days.") +
      `</tbody></table></div>` +
      `<h2>Friday post</h2>` +
      `<p class="post">${fridayOk ? "✅ <b>Post the numbers.</b>" : "⚠ <b>Post what we learned.</b>"} ` +
      `${num(s.friday.maps)} maps (gate ≥ ${num(T.fridayMaps)}) and ${num(s.friday.lanterns)} lanterns (gate ≥ ${num(T.fridayLanterns)}).</p>` +
      `<p>Copy: <b>${esc(s.friday.line)}</b></p>` +
      `<p class="def">Gate: maps ≥ ${num(T.fridayMaps)} AND lanterns ≥ ${num(T.fridayLanterns)} in the window, else post what we learned. ` +
      `Lanterns = lanterns the owner lit on the window's maps (the carried lantern pointing back to whoever brought them is left out; /api/counter counts it). ` +
      `Countries = distinct countries of those lanterns' cities, from the city data` +
      (s.citiesUnplaced ? `; ${num(s.citiesUnplaced)} city name(s) were not found there and add no country.` : ".") +
      ` Lanterns added later by editing an older map are not counted.</p>` +
      `<h2>Share → open → start, by channel</h2>` +
      `<div class="wrap"><table><thead><tr><th>Channel (?s=)</th><th class="n">Shares</th><th class="n">Opens</th><th class="n">open / share</th><th>≥ ${T.openPerSharePct}%</th><th class="n">Make yours</th><th class="n">start / open</th><th>≥ ${T.startPerOpenPct}%</th></tr></thead><tbody>` +
      s.funnel.rows.map(channelRow).join("") + channelRow(s.funnel.overall) +
      `</tbody></table></div>` +
      `<p class="def">A share-sheet share carries no ?s= tag, so its opens and "Make yours" taps cannot be told apart from other untagged traffic; its shares still count in the overall row. A tap with an unknown channel is not counted.</p>` +
      `<h2>By IST hour</h2>${hourly}` +
      `<p class="def">Maps and their lanterns by the hour they were saved; tie-backs by the hour of the tap. ` +
      `Maps made from a thank-you have a date only, so they are not in these rows (${num(s.hourly.dateOnlyMaps)} maps, ${num(s.hourly.dateOnlyLanterns)} lanterns in the window).` +
      (s.hourly.truncated ? " Only the latest 14 days of hours are shown." : "") +
      `</p>`
  );
}
