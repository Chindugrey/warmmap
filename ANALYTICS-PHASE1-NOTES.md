# Warm Map analytics, phase 1: notes

Branch `wm/analytics-phase1` (based on 40b6352). Plan: `plans/warmmap-analytics-v2/PLAN.md` §2. No schema change, no migration, no new data collected, no new packages. Reviewed in `REVIEW-FABLE.md` (SHIP WITH FIXES); the fixes are listed under "Review fixes" below.

## What was built

New pages behind the existing ADMIN_TOKEN gate. They use the same cookie sign-in or a Bearer header, the same `noindex` / `no-store` / CSP / `nosniff` headers, and 404 when ADMIN_TOKEN is unset. A nav bar links them from `/admin/dashboard`.

| Page | Shows | Names? |
|---|---|---|
| `/admin/dashboard/creators` | One row per map: first name, home city, created (IST), kind, lanterns, distinct cities, km, gold, thank-links, shares by channel (wa/li/cp/st/native), opens, maps spawned (direct + all generations, "N+" past the depth cap), arrived via. Sorted, searched (first name or city, a literal substring) and paged **in SQL**: only the 50 rows asked for leave the database. `?format=json`, `?format=csv` (honours the search and sort; capped at 50,000 rows, and a cut is reported in an `X-Rows-Truncated` header and a last `#` line) | Owner first name only |
| `/admin/dashboard/virality` | New maps per map, split by route (shared map / thank-you / other; the three add up); weekly and daily IST cohorts; invite-generation distribution; the 15 biggest trees; channel funnel per `?s=` tag: share → open → Make yours → **Saved (est.)**, with "Saved (est.) / share" and "k (est.)", for all / 30 d / 7 d (`?w=`) | None |
| `/admin/dashboard/ranking` | The top 100 creators by warmth, aggregated in SQL, with every component shown, and a caution that "spawned" can be inflated | Owner first name only |
| `/admin/dashboard/map/[id]` | One map's timeline (IST). Exact times only for the map's own thank-links, ties and last edit. Opens (by tag), shares (by channel), "owner saw gold", reports and spawned maps (by route) are **daily counts**. Generation and the total below it are capped at 50 levels and shown as "50+" when the cap is reached | None. Spawned maps have no link, id or exact time |

Warmth = 1 × thank-links sent + 2 × ties-back received + 1 × shares + 3 × maps spawned directly + 1 × maps spawned in later generations (`WARMTH_WEIGHTS`, used by the SQL too).

### Code
- `src/lib/growth.ts`: the pure math. Invite forest (cycle-safe), generations, top trees, viral factor, IST cohorts, the funnel estimate, warmth, query parsing, the LIKE escaping, CSV columns, the timeline (day buckets), and `TREE_DEPTH_CAP = 50` / `CSV_ROW_CAP = 50,000`.
- `src/lib/growth-load.ts`: the loaders.
  - Creators and ranking: one statement (grouped joins, a recursive ancestor walk capped at 50, warmth, `WHERE` / allow-listed `ORDER BY` / `LIMIT` / `OFFSET`, `count(*) OVER ()`).
  - Virality: 4 queries.
  - Timeline: 6 queries. Events and spawned maps are grouped by IST day in SQL, so exact times never leave the database. Lists are capped at 1,000.
- `src/lib/growth-html.ts` (pages), `src/lib/admin-route.ts` (shared gate and headers).
- `src/app/privacy/page.tsx` and `src/lib/privacy-facts.ts` (S3 wording).
- `scripts/seed-analytics.ts`: local-only seed (10k maps, ~16k links, ~7k vouches, 100k events) plus loader timings.

## Review fixes (REVIEW-FABLE.md)
| # | Status | What changed |
|---|---|---|
| S1 spawned maps identifiable by timestamp | **Fixed** | Spawned maps are one row per IST day: "Spawned 3 maps: 2 via shared map, 1 via thank-you". The day is computed in SQL, so the JSON cannot carry a child's time. The per-child "brought N more" is gone; one all-generations total sits on the "Created" row. The footnote says plainly that on a quiet day a day plus route can still be matched by hand. |
| S2 exact opens next to tie-backs | **Fixed** | `map_view`, `share`, `gold_seen` and `link_report` are daily counts by tag / channel ("Opened 14 times: 9 WhatsApp, 5 untagged"), sorted after that day's exact events. The follow-up of not recording a `map_view` on the `via=thanks` prefetch is outside this diff and still open. |
| S3 privacy page | **Fixed** (counsel to confirm) | "Counts" now says a few counts are kept with the map (opens and their link kind, "saw new gold"). A new bullet says what the people running Warm Map can see per map, and that it is used to rank maps. Retention: "Counts kept with your map: until you delete your map", "Other counts: plain totals". No share-tap wording, because shares are still not attached. |
| S4 estimates unlabelled | **Fixed** | The per-row "saved / make yours" column is removed (the overall rate is one tile). The other columns are "Saved (est.) / share" and "k (est.)". JSON fields are `savedEst`, `savedEstPerShare` and `kEst`. A unit test requires `Est` in every derived field name. |
| S5 invited defined two ways | **Fixed** | "Invited" = has a live inviter, everywhere on the page, including the save rate. Routes are now map / thank-you / other, so they really add up; an API test checks the sum. The ranking page warns that "spawned" can be inflated. |
| S6 unbounded creators / ranking / CSV | **Fixed** | Aggregation, search, sort and paging happen in SQL; the ranking is `LIMIT 100` in SQL; the CSV is capped at 50,000 rows with a truncation signal. The database still aggregates every map per request (unavoidable when sorting by a count); a 60-second cache is the next step if it ever gets slow. |
| S7 silent depth cap / unbounded lists | **Fixed** | `TREE_DEPTH_CAP` is a named constant used by every recursive CTE. When it is reached, the page says "generation 50+", "50+ maps below it (depth capped at 50)", and "N+" in the creators list and CSV (`spawnedAllCapped` in the JSON). Thank-links, vouches, events and spawned rows are capped at 1,000 with a note. A 56-map chain is tested. |
| S9 attach share taps to maps | **Not done, on purpose** | Left for the co-founder's decision (see the review's §6). |

Nits fixed: N1 (the creators blurb is now accurate about internal ids), N3 (CSV dates are date-only for thank-you maps), N4 (page clamp tested), N6 (`nosniff`), N8 (cohort note on date-only stamps), N10 ("tied back").

Nits left: N2 (search is a GET), N5 (sign-in redirects to the overview), N7 (Bearer GETs are not rate-limited; this pre-dates the branch), N9 (opens include the thank-you prefetch).

## Test results (throwaway Postgres 16 on :55433, `next start` on :3102, Node v22.23.3 from nodejs.org in /tmp/wm-node22)
- `npm test`: **113 / 113**. 13 in `tests/unit/growth.test.ts`; new since the review:
  - funnel field names
  - query clamps and LIKE escaping
  - CSV date-only and "N+"
  - the day-bucket timeline (no exact times, IST midnights, order)
  - the depth cap text
- `npm run test:api`: **36 / 36**. 7 in `tests/api/growth.test.ts`; new since the review:
  - S1 + S2 pins: no child `createdAt` and no exact share / open time in the timeline JSON or HTML (ISO or IST minute); count rows on IST midnights.
  - Signed-in HTML / JSON / CSV carry `no-store`, `noindex`, `nosniff` and `no-referrer`.
  - Funnel deltas per channel for all / 30 d / 7 d, with 40-day-old events outside the short windows.
  - Routes add up.
  - The depth cap on a 56-map chain (timeline, creators JSON and CSV).
  - SQL search is literal (`%`), server-side sort and paging, and a page past the end.
- `npm run test:browser`: **22 / 22** (`CHROME=~/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`, `DATABASE_URL` set).
- `npm run build`: OK. `tsc --noEmit`: clean. `eslint`: 0 errors (1 warning that was already there, in `tests/browser/sendagain.test.mjs`).
- Speed at 10k maps / 100k events (median of 3, measured while the browser suite was running):

  | Load | Median |
  |---|---|
  | Creators page (search + sort) | 32 ms |
  | Creators, page 100 | 66 ms |
  | Ranking | 50 ms |
  | Full CSV | 156 ms |
  | Virality | 67–76 ms |
  | Timeline | 6 ms |
  | Overview | 15 ms |

Environment notes: Homebrew's `node@22` is broken on this Mac (built against `libsimdjson.34`; brew now has 37). Postgres needs `LC_ALL=C` here.

## Left open / decisions
1. **Shares per map read 0** until share taps carry their map (S9). It's a decision for the co-founder; the review recommends daily per-map counts, together with a privacy-page change.
2. **Saved per channel is an estimate**, and is labelled as one everywhere.
3. **The `via=thanks` prefetch records a `map_view` on the inviter's map** (review S2 follow-up). It's now harmless on the timeline (daily counts), but it still inflates "Opens". A small fix (`?nv=1`) is outside this diff.
4. **Counsel** should confirm the S3 privacy wording, and legitimate interests for per-map counts and the creator ranking (PLAN §5.6).
5. Not pushed, not deployed, no remote DB touched.
