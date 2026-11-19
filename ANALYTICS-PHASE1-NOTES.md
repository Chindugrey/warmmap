# Warm Map analytics, phase 1: notes

Branch `wm/analytics-phase1` (based on 40b6352). Plan: `plans/warmmap-analytics-v2/PLAN.md` §2. No schema change, no migration, no new data collected, no new packages.

## What was built

New pages behind the existing ADMIN_TOKEN gate. They use the same cookie sign-in or a Bearer header, the same `noindex` / `no-store` / CSP headers, and 404 when ADMIN_TOKEN is unset. A nav bar links them from `/admin/dashboard`.

| Page | Shows | Names? |
|---|---|---|
| `/admin/dashboard/creators` | One row per map: first name, home city, created (IST), kind, lanterns, distinct cities, km, gold, thank-links, shares by channel (wa/li/cp/st/native), opens, maps spawned (direct + all generations), arrived via. Sortable column headers, 50 per page, search by first name or city. `?format=json`, `?format=csv` (honours the search and sort) | Owner first name only |
| `/admin/dashboard/virality` | New maps per map (all time, plus split by route: shared map / thank-you); weekly cohorts (12 IST weeks, Monday start) and daily cohorts (30 days): maps made, of which invited, direct children, all generations, k; invite-generation distribution; the 15 biggest invite trees (size, depth, via map / thanks); channel funnel per `?s=` tag: share → open → Make yours → saved (est.), with %s and k by channel, window all / 30 d / 7 d (`?w=`) | None |
| `/admin/dashboard/ranking` | Top 100 creators by warmth, with every component shown | Owner first name only |
| `/admin/dashboard/map/[id]` | One map's timeline in IST: created, lanterns at save, last change, thank-links (and whether they were used), ties-back (and when the owner saw them), shares, opens (by tag), gold seen, reports, spawned maps (date, route, their own reach). Accepts the internal id, short slug or public id. `?format=json` | None. Spawned maps have no link or id, because they are other people's maps |

Warmth = 1 × thank-links sent + 2 × ties-back received + 1 × shares + 3 × maps spawned directly + 1 × maps spawned in later generations (`WARMTH_WEIGHTS` in `src/lib/growth.ts`). Opens are shown but not scored.

CSV columns: first_name, home_city, created_ist, kind, arrived_via, lanterns, cities, km, gold, thank_links, shares_* (5), opens, maps_spawned_direct, maps_spawned_all, warmth. There are no ids and no hashes. Cells go through the existing `csvCell` (formula-safe).

### Code
- `src/lib/growth.ts`: the pure math (invite forest with a cycle guard, generations, top trees, viral factor, IST day/week cohorts, channel funnel, warmth, creators search/sort/page, CSV columns, timeline).
- `src/lib/growth-load.ts`: the database loaders. Creators is one SQL statement (per-map aggregates via grouped LEFT JOINs and a jsonb lateral). Virality is 4 queries. A timeline is 6 queries, with recursive CTEs over `invitedByMapId` capped at 50 levels. There are no per-map queries (no N+1), and they use the existing indexes only. No query selects `deviceHash`, `ipHash`, `tokenHash` or `ownerKeyHash`, and the timeline never selects `ownerName`.
- `src/lib/growth-html.ts`: the server-rendered pages (no script, everything escaped). `src/lib/admin-route.ts`: the shared gate and headers. `/admin/dashboard/route.ts` now uses it too, with no behaviour change.
- `scripts/seed-analytics.ts`: a local-only, deterministic seed (10k maps in invite trees, ~16k thank-links, ~7k vouches, 100k events over 90 days) that then times each loader.

## Test results (local throwaway Postgres 16 on :55433, `next start` on :3102)
- `npm test`: **111 / 111** pass (100 existing + 11 new in `tests/unit/growth.test.ts`: forest, cycle, generations, viral factor, top trees, IST weeks, cohorts, funnel %s and the estimate cap, warmth weights, first name, creators search/sort/pages/CSV columns, timeline).
- `npm run test:api`: **33 / 33** pass (29 existing + 4 new in `tests/api/growth.test.ts`, now part of the script):
  - 401 on every new page in HTML, JSON and CSV without a token, with a wrong token and with a forged cookie.
  - Cookie sign-in reaches the pages.
  - Exact counts on a seeded fixture.
  - A sweep of every page in every format: no friend name (planted in the stored JSON), no surname, no device or IP hash value, and no `deviceHash` / `ipHash` / `tokenHash` / `ownerKeyHash`. Owner names appear only on the creators list and the ranking, never on the overview, virality or timelines.
  - The existing overview "no names" test is unchanged and still passes.
- `npm run test:browser`: **22 / 22** pass (headless shell from the Playwright cache via `CHROME=…/chrome-headless-shell-mac-arm64/chrome-headless-shell`; `delete.test.mjs` needs `DATABASE_URL` set).
- `npm run build`: OK (the 4 new routes are dynamic). `tsc --noEmit`: clean. `eslint`: 0 errors, 1 warning that was already there (`tests/browser/sendagain.test.mjs`, unused `text`).
- Speed at 10k maps / 100k events (median of 3, warm): creators 66 ms (load, search, sort), virality 32 ms, timeline 1 ms, overview 10 ms.

Environment notes: Homebrew's `node@22` currently fails to start on this Mac (it links `libsimdjson.34`, but brew upgraded simdjson to 37). I used the official Node v22.23.3 tarball from nodejs.org (SHA-256 checked) in `/tmp/wm-node22`. Postgres needs `LC_ALL=C` to start here.

Screenshots: none taken. To take some, sign in at `/admin/dashboard` with the token on a local server and open the four pages. `tests/browser/cdp.mjs` `shot()` can capture them headless.

## Left open / decisions for Aadarsh
1. **Shares per map read 0 today.** `share` events are stored with `mapId = null` (`/api/analytics` never attaches a map), so the per-map "shares by channel" columns, the shares part of warmth and "Shared" on the timeline stay empty until share taps carry their map. The code already counts them by `mapId` when present. The change is small (ShareRow / ThankSheet / StoryPicture send the map's slug, and `/api/analytics` resolves it for `share` only). But it links a tap to a map, so it is a privacy-model decision, not phase-1 plumbing. The channel totals on the virality page do not depend on it. Per-map **opens** (from `map_view`, which does carry `mapId`) are real and shown.
2. **Saved maps per channel are an estimate.** A saved map does not record the `?s=` it came with (that would need `s` on `map_saved` or the map, which is a schema or privacy change). The page labels the estimate and explains it: a channel's Make yours × the overall Make-yours-to-saved rate. Exact k is shown by route (shared map vs thank-you).
3. Lantern timestamps don't exist: lanterns are saved with the map. The timeline shows the lantern count at save plus a "last changed" line.
4. Thank-you maps keep their date-only stamp (by design), and are shown as "(date only)".
5. Not pushed, not deployed, no remote DB touched.
