# Review: Warm Map analytics phase 1 (`wm/analytics-phase1`, 40b6352..fb8cc8c)

Reviewer: Fable (independent), 20 Nov 2026. Scope: `git diff 40b6352..HEAD` (a8317d6, a11254d, fb8cc8c), `ANALYTICS-PHASE1-NOTES.md`, against PLAN.md §2 and §5.

## Verdict: SHIP WITH FIXES

No auth hole, no injection, no hash or friend-name leak, and the math is right. Fix S1 and S2 before the merge (both are small); the rest can follow.

The main finding is that the timeline's "spawned maps carry no id" protection does not hold: the spawned rows carry the child's exact `createdAt`, which is an exact join key into the creators list (first name, city, internal id). For thank-you children that yields "creator X thanked [first name, city]".

## How this was checked

- Read every changed file plus the code it depends on (`admin.ts`, `owner.ts`, `analytics.ts`, `map-input.ts`, `maps` routes, `PublicMap.tsx`, `CornerFlow.tsx`, privacy page).
- Ran `tests/unit/growth.test.ts` on a scratch copy in `/tmp/wm-review-fable` (Node 22.23.3): 11/11 pass.
- Ran 23 mutations against the unit tests (`/tmp/wm-review-scripts/mutate.py`): 18 killed, 5 survived (see §5).
- Ran the three loaders against a throwaway local Postgres 16 (`/tmp`, port 55440, since removed) with edge cases: 0 maps, deleted parent, a forced cycle, a 120-deep chain, a 5,000-wide fan, non-array `entries`, a formula-shaped owner name (`/tmp/wm-review-fable/rv.ts`).
- **Not run:** `npm run test:api`, `test:browser` and `npm run build`. They need a running `next start`, and building would write into the worktree. The API-test findings in §5 are from reading the test, not from mutating it.

---

## Findings

### Blockers
None.

### Should-fix

**S1. Spawned maps are identifiable by timestamp (fix before merge).**
- `src/lib/growth.ts:421-427` emits each spawned map with `at: c.createdAt.toISOString()` (millisecond precision). `src/lib/growth.ts:296` puts the same ISO string, with `id`, `firstName` and `homeCity`, in the creators JSON; the HTML shows it to the minute (`growth-html.ts:23`).
- Measured: for a parent with one `map` child and one `thanks` child, filtering creators on `createdAt === spawned.at` returned exactly one named row for each.
- The `"it brought N more"` detail (`growth.ts:426`) equals the child's `spawnedAll`, which is a second join key.
- Consequence: for `arrivedVia = thanks`, the admin can read "Ananya (Bengaluru) thanked Meera (Kochi)". The edge already exists in the database (`invitedByMapId`), so this is not new collection, but phase 1 makes it a two-click lookup while the page says otherwise (`growth-html.ts:141`, NOTES line 15).
- The API test only checks that the child ids are absent (`tests/api/growth.test.ts:130`), so it passes.
- Fix:
  1. In `timeline()`, aggregate spawned maps to one row per IST day and route: `"Spawned 3 maps: 2 via shared map, 1 via thank-you"`, with `at = istDayStart(createdAt)` and `dateOnly: true`. Drop the per-child "brought N more"; show one total for all generations on the "Created" row.
  2. In `loadTimeline` (`growth-load.ts:161-167`), return only the day bucket, the route and a count, so the JSON cannot carry the exact stamp.
  3. Add a test: no `at` in the timeline JSON or HTML equals any child's `createdAt`, and no per-child row exists.
  4. Reword the footnote honestly: on low-volume days the day + route can still be matched to the creators list. If that is not acceptable, drop spawned rows from the timeline and keep only the two counts.

**S2. The timeline defeats the "date-only" stamp for thank-you maps.**
- `src/app/api/maps/route.ts:37-40` truncates a thank-you map's `createdAt` "so it cannot be lined up with the moment a lantern was tied".
- `src/components/CornerFlow.tsx:97-98`: a friend arriving with `via=thanks` fetches `/api/maps/<inviter>`, which writes a `map_view` on the **inviter's** map at the exact second (`src/app/api/maps/[id]/route.ts:19`).
- The inviter's timeline then lists, to the minute: "Tied back (gold)" (`growth.ts:411`), "Thank-link sent" (`growth.ts:408`), "Opened: untagged link" (`growth.ts:417`) and "Spawned a map, via thanks (date only)". The date-only line sits next to the exact-time events it was meant to be separated from.
- The data pre-dates this branch; the timeline is what surfaces it.
- Fix (this branch): on a timeline, show `map_view` rows as per-day counts by tag ("Opened 14 times: 9 WhatsApp, 5 untagged") rather than one row per open. That also removes the 500-row cap problem.
- Fix (follow-up, outside this diff): stop the `via=thanks` prefetch from recording a `map_view` (for example a `?nv=1` parameter that skips `trackEvent`). It also inflates "Opens".

**S3. The privacy page no longer describes what is kept per map.**
- `src/app/privacy/page.tsx` ("Counts" bullet) says counts "cannot be traced to a person"; `src/lib/privacy-facts.ts` says they are "kept as plain totals, with nothing that leads back to a person".
- `map_view`, `gold_seen` and `link_report` already carry `mapId`. Phase 1 displays them per map, per event, with timestamps, one click from the owner's first name and city. `gold_seen` is the owner's own behaviour ("Owner saw gold", `growth.ts:418`).
- A per-creator "warmth" ranking is also a new purpose, beyond "knowing whether the service works".
- Fix: change the "Counts" bullet and the retention line in the same release (wording proposed in §6). PLAN §5.6 already sends the opt-in work to counsel; add this paragraph to that review, since EU users are in scope.

**S4. Derived funnel columns are not labelled as estimates.**
- `growth-html.ts:120`: "Saved (est.)" and "k (est.)" are labelled, but "saved / make yours" and "saved / share" are computed from the same estimate and are not.
- "saved / make yours" is the overall save rate repeated in every row (`growth.ts:214-220`; measured: 100% in each populated row). It reads as a per-channel conversion and is not one.
- Fix: remove the "saved / make yours" column (the overall rate is already a tile) and rename the other to "saved (est.) / share". In the JSON, rename `savedPerMakeYours` and `savedPerShare` to carry `Est`.

**S5. `arrivedVia` and `invitedByMapId` are independent, client-supplied fields, and the page mixes them.**
- `src/lib/map-input.ts:79-85` accepts any `via` with or without `invitedBy`.
- `viralFactor` and `byRoute` count by pointer (`growth-load.ts:113`); `invitedSaved` counts by `arrivedVia` (`growth-load.ts:109`).
- So "they add up to the total" (`growth-html.ts:106`) is false whenever a map has a pointer with `via=cold`, and the funnel's save rate uses a different definition of "invited" from the tiles beside it.
- Fix: define invited as "has a live inviter" everywhere, add an "other route" tile, or drop the "add up" sentence.
- Related: anyone can POST a map with `invitedBy=<any public slug>`, so "spawned" (weight 3) and the ranking can be inflated at 5 maps per device-hour. Say so on the ranking page before it drives any outreach.

**S6. Every creators or ranking request loads and aggregates every map.**
- `creators/route.ts:18` and `ranking/route.ts:14` call `loadCreators`, which runs the full grouped join (`growth-load.ts:26-49`) and sorts and pages in memory. The CSV is unbounded.
- Fine at the seeded 10k maps (66 ms reported). It is linear in maps and events with no ceiling, on a serverless function.
- Fix now: a row cap on the CSV (for example 50,000, with a `truncated` note). Later: page in SQL or cache the facts for 60 seconds.

**S7. Timeline trees are silently wrong past 50 levels, and the lists are unbounded.**
- `growth-load.ts:158` and `:164` cap both recursive CTEs at 50. Measured on a 120-deep chain: the timeline said "generation 51" and "it brought 49 more"; the creators and virality pages (uncapped, iterative) said 120 and 5,121.
- A map with 5,000 direct children returned 5,007 timeline rows (0.5 MB, 32 ms). Thank-links and vouches have no `take` either (`growth-load.ts:146-147`).
- Fix: S1's aggregation removes the per-child rows. Show "50+" when the cap is hit, and add `take` to the two `findMany` calls.

### Nits

- **N1.** `growth-html.ts:58` says "no ids or fingerprints", but every row's link holds the internal map id and the JSON has `id`. The internal id is not a public address (`src/lib/owner.ts:10` resolves only `shortSlug` and `publicId`), so it is harmless; fix the sentence.
- **N2.** The search term is a GET parameter (`growth-html.ts:59`), so searched first names land in browser history and the host's request logs. Acceptable; a POST search avoids it.
- **N3.** The CSV prints thank-you maps as "19 Nov 2026, 05:30" (`growth.ts:363`); the HTML shows date-only. Pass `r.arrivedVia === "thanks"` as in `growth-html.ts:23`.
- **N4.** Negative `page` in direct callers of `queryCreators` slices from the end; `parseCreatorQuery` clamps it (`growth.ts:325`), but nothing tests the clamp.
- **N5.** After sign-in from a sub-page, the redirect goes to `/admin/dashboard`, not back to the page.
- **N6.** No `X-Content-Type-Options: nosniff` in `ADMIN_HEADERS` (`admin-route.ts:7-12`).
- **N7.** Bearer attempts on GET are not rate-limited (only the POST sign-in is, `dashboard/route.ts:29`). `admin.ts:7` accepts 16+ characters while its comment says 24+. Both pre-date this branch; four more routes now share it.
- **N8.** The weekly cohort note does not say that thank-you maps (stamped 00:00 UTC) can fall into the previous IST day or week; the overview page does say it.
- **N9.** "Opens" includes the `via=thanks` prefetch described in S2.
- **N10.** `growth.ts:408`: "later opened and tied back" for `usedAt`; `usedAt` is set only on the tie (`src/app/api/vouch/route.ts:42-43`), so "tied back" is enough.

---

## 1. Auth: pass

- All five GET handlers call `adminGate` first, before any parameter parsing or database work: `creators/route.ts:14`, `map/[id]/route.ts:13`, `ranking/route.ts:12`, `virality/route.ts:11`, `dashboard/route.ts:20`. The id regex and the 404 in `map/[id]` come after the gate, so an unauthenticated caller cannot probe which maps exist.
- `adminGate` (`admin-route.ts:20-29`): 404 when `ADMIN_TOKEN` is unset, 401 otherwise; JSON and CSV callers get `{error}` and no data.
- The refactor of `dashboard/route.ts` is behaviour-preserving, with one addition: `?format=csv` now also gets the JSON 401.
- Cross-site CSV: the cookie is `HttpOnly; SameSite=Strict; Path=/admin` (`dashboard/route.ts:36`), so a cross-site navigation or embed sends no session. There are no CORS headers on `/admin` (`next.config.ts` adds headers only for `/t`, `/m`, `/api`), so a response cannot be read cross-origin. Every new handler is a pure read; only GET is exported.
- Token: accepted only from the `Authorization` header (`admin.ts:8`) or the POST form body (`dashboard/route.ts:40`); never from a query string. The cookie holds an expiry and an HMAC, not the token (`admin.ts:34-39`). No new `console.*` call in the diff; the only logger in `src` is `analytics.ts:52` (an error message).
- Headers: `Cache-Control: no-store`, `noindex`, `Referrer-Policy: no-referrer` and a `default-src 'none'` CSP are on every admin response, including 401, 404, JSON and CSV (`admin-route.ts:7-17`, `creators/route.ts:24`).
- Output escaping: every dynamic value goes through `esc()` or `encodeURIComponent`; the un-escaped `sub` argument of `head()` only ever receives literals (`growth-html.ts:12`).

## 2. Privacy: pass, except S1 to S3

- Friend names: no query reads anything a friend typed. `entries` is fetched only for legacy rows and only `city` and `carried` are used (`growth-load.ts:28`, `:55-57`, `:168-169`). The API test plants a `name` inside stored JSON and sweeps every page for it.
- Hashes: no query selects `deviceHash`, `ipHash`, `tokenHash` or `ownerKeyHash` (`growth-load.ts:39`, `:146-147` select timestamps only). `entryIndex` is not selected either, so a tie cannot be pinned to a lantern.
- Owner names: `ownerName` is read only in `loadMapFacts` (`growth-load.ts:27`) and reduced to the first word (`growth.ts:18-20`). The timeline query excludes it (`growth-load.ts:141`). Virality carries none.
- Public links: no `publicId` or `shortSlug` is ever selected or printed. Internal ids appear in admin links and JSON (N1) and cannot open a public page.
- CSV: 19 columns, no id, formula-safe. Measured: an owner named `=HYPERLINK(1) Rao` exported as `'=HYPERLINK(1)`.
- Spawned maps: ids are absent as claimed, but identity is recoverable (S1).

## 3. Correctness: pass, with S4, S5, S7

- Viral factor: invited / all maps, where invited means the parent still exists (`growth.ts:138-142`). Zero maps gives 0, not NaN (measured).
- Generations and forest: iterative, with a per-walk cycle guard (`growth.ts:55`). Measured on a forced A↔C cycle: all loaders returned in about 2 ms with one node as root. A deleted parent makes the child a root through `SetNull` (measured: generation 0).
- IST cohorts: `istWeekStart` is right (Monday 00:00 IST; `growth.ts:145-149`); buckets are fixed-length from an IST boundary, which is valid because IST has no daylight saving.
- Funnel: the percentages return null on a zero denominator; the save rate is capped at 1; the estimate is labelled and explained (`growth-html.ts:126-130`), apart from S4.
- Warmth: matches the stated formula (`growth.ts:231-246`); later generations are `spawnedAll − spawnedDirect`, floored at 0.
- Gold: uses the same rule as the owner view (`tier = tap` and a thank-link; `src/lib/vouches.ts:9`).

## 4. Performance and safety: pass, with S6, S7

- No N+1: creators is one statement, virality four, a timeline six.
- Injection: every raw query is a tagged template with bound parameters. Search and sort run in memory. `sort` is allow-listed (`growth.ts:323`), `dir` is binary, `page` is clamped, `q` is cut to 60 characters, `w` is one of three values (`growth-load.ts:80`), and the map id must match `^[A-Za-z0-9_-]{4,40}$`.
- Recursion: none in JavaScript; the SQL recursion is depth-capped.
- Non-array `entries` does not crash the creators query (measured: 0 lanterns).
- `scripts/seed-analytics.ts:13-14` refuses a non-local `DATABASE_URL`.

## 5. Tests

Mutation results on `tests/unit/growth.test.ts`:

| Result | Mutations |
|---|---|
| Killed (18) | warmth weights (3 variants), week start on Sunday, UTC weekday, UTC day cohorts, cohort k from descendants, save-rate cap removed, funnel k denominator, sort allow-list removed, full name instead of first name, dangling parent counted as invited, k = invited / inviters, `dir` ignored, spawned thank-you not date-only, single-map trees kept, divide by zero in `pct`, cycle guard removed (hang) |
| Survived (5) | `page` clamp removed; `q` length cap removed; search also matching `kind`; a CSV column named `map` holding the id (the unit check is by column name; the API test's `!csv.includes(A.id)` should catch it); self-parent guard removed (equivalent: the path guard covers it) |

Gaps to close:
1. Nothing pins S1 (timestamp join) or S2.
2. Headers on signed-in responses are untested: `no-store` is asserted only on the bare 401 (`tests/api/growth.test.ts:44`), not on 200 HTML, JSON or the CSV.
3. The funnel's database wiring has no exact assertion (only `rows.length === 4`, line 140): window filtering, shares by channel, opens by tag and Make-yours by tag could all break unnoticed. Assert deltas before and after the fixture.
4. The timeline's `generation` and "brought N more" are not asserted, and neither CTE cap is tested.
5. No test for a vouch without a thank-link being left out of gold, for a parent deleted through the API, or for the `page` and `q` clamps.

## 6. The open decision: tying share taps to a map

Recommendation: **yes, in a reduced form, and only together with the privacy-page change.** Do not make it part of this merge.

What it would link: a share tap to a map, and so to the owner's first name and city. It does not link to a device: `AnalyticsEvent` has no device or IP column, and the rate-limit keys are separate hashes kept about two days. `ShareRow` renders on the public map for visitors as well as owners (`PublicMap.tsx:179`, `:231`), so the count means "shares of this map", not "the owner shared".

How to do it without a new personal-data trail:
1. Store a per-map, per-channel **daily count**, not a timestamped event. Either truncate `createdAt` to the UTC day for map-attached `share` rows (no schema change), or add a small counter table keyed by map, channel and day. Phase 1 needs counts, not times.
2. The client sends the public slug; `/api/analytics` resolves it with `findMap` for `share` only, drops it when unknown, and never accepts an internal id.
3. Leave `ThankSheet` shares unattached. `ThankLink` already counts thank-you sends per map, and attaching them would count the same act twice in warmth (thank-links ×1 plus shares ×1).
4. Keep the existing cascade: events with a `mapId` are deleted with the map, which keeps "Delete my map" true.
5. No backfill; old share events stay unattached.
6. Note on the ranking page that shares are tappable by anyone and rate-limited only per device.

Privacy page changes (also needed for S3, with or without this decision):
- "Counts" bullet, replace the tail with: "Most are plain totals with no name and no device or connection mark. A few are kept with your map: how many times its link was opened and from which kind of link, how many times a share button on it was tapped and which one, and when you saw a new gold lantern. They carry no device or connection mark and no friend's name."
- "How long we keep it": "Counts kept with your map: until you delete your map. Other counts: plain totals."
- `privacy-facts.ts` `counts` fallback: drop "with nothing that leads back to a person" for the per-map counts.
- Have counsel confirm legitimate interests still covers per-map counts and a creator ranking; any use for outreach stays behind the §3A opt-in, as PLAN §5.3 already says.
