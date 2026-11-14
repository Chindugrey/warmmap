# Warm Map — Product Index

A single source of truth for product, flow, copy and build status. Share this file with Claude when reviewing strategy or implementation.

---

## 1. Product one-liner

**Warm Map** is a two-minute game that shows you who is in your corner, lets you tell them, and earns the most-vouched people a seat at a small, exclusive dinner.

Core loop: **find your people → share the map → they vouch back → they play too → your people get you a seat.**

Live site: https://warmmap.world  
GitHub: https://github.com/Chindugrey/warmmap  
Vercel project: chindus-projects/warmmap

---

## 2. The promise

In a world of campaigns, MQLs, cold emails and GTM playbooks, we lost the freshness of warm meetings, warm intros and humane interactions. Warm Map brings that back by making trust visible, shareable and a little bit fun.

**What the user feels in 2 minutes**
- “These people actually matter.”
- “I should tell them.”
- “If they feel the same, I might get a seat.”

**What the product never does**
- Stores a name until that person vouches back themselves.
- Sends any message for anyone.
- Sells a seat or runs a popularity contest.

---

## 3. User flow

| Step | Screen | What happens |
|---|---|---|
| 1 | Hero | One-line pitch + “Make my Warm Map” |
| 2 | Your details | First name + home city |
| 3 | 12 questions | Name + city per question; each answer lights a lantern |
| 4 | Your Warm Map | Globe, stats, share picture |
| 5 | Share | WhatsApp, LinkedIn, native share, copy link/picture |
| 6 | Friend opens link | Public map + “Is one of these you?” |
| 7 | Personal link (optional) | `warmmap.world/m/xxxx#Priya` shows “Priya, you’re on Arjun’s map” without sending the name to the server |
| 8 | Vouch | Friend picks their city, enters email, receives 6-digit code, writes one line |
| 9 | Make yours | Friend starts their own map, carrying the inviter |
| 10 | Seat | Most-vouched (different people only, counted up to 5, never shown publicly) get “Your people got you a seat” |

---

## 4. What is built now (P0)

| # | Feature | Status |
|---|---|---|
| 1 | Domain + hosting | ✅ `warmmap.world` on Vercel |
| 2 | Save map + short link (`/m/xxxx`) | ✅ PostgreSQL via Neon, stores cities/counts only |
| 3 | OG preview image per link | ✅ `/api/og?id=...` generates 1200×630 PNG |
| 4 | Native share with picture | ✅ Web Share API with generated PNG |
| 5 | Friend’s page + vouch-back | ✅ `/m/[id]/vouch` with email code |
| 6 | Real-person check | ✅ Email 6-digit code via Resend (needs `RESEND_API_KEY`) |
| 7 | “Make yours” carrying inviter | ✅ `?invitedBy=...` param |
| 8 | Light sign-in when saving | ✅ NextAuth email magic links |
| 9 | Analytics | ✅ plays, shares, vouches, creates |
| 10 | Trust basics | ✅ privacy page, delete-my-map, consent banner, rate limits |
| — | Game fixes | ✅ edit/remove lanterns, >12 people, duplicate cities, 500+ cities |

### Pages
- `/` — landing + game
- `/m/[id]` — public map with OG metadata
- `/m/[id]/vouch` — vouch-back flow
- `/me` — dashboard, delete map
- `/privacy` — privacy + consent
- `/auth/signin`, `/auth/verify-request` — magic links

### APIs
- `POST /api/maps` — save map
- `GET /api/maps/[id]` — fetch map
- `POST /api/vouch?action=request|confirm` — send/verify vouch code
- `GET /api/og?id=...` — OG image
- `POST /api/analytics` — track events
- `/api/auth/[...nextauth]` — NextAuth

---

## 5. Roadmap

### P1 — The Table (first dinner)

| Feature | Purpose |
|---|---|
| Vouch counting | Different people only, up to 5, never public |
| City waitlists | “Bengaluru opens with 30 people” |
| Super-connector invite codes | 12 per city, sent by hand |
| Seat picking + invites | 6 super connectors + 6 most vouched + 2 newcomers |
| RSVP, deposit, waitlist | Refundable deposit; seat releases 48h before |
| Host tools | Guest list, dots (looking for / can help with), printed door cards, check-in |
| Receipts | Night-of receipt, then day-14 / day-30 follow-up, then public 30-day receipt |
| Vouch-request limits | Max 10 requests/month, “maybe later” button |

### P2 — Spread

| Feature | Purpose |
|---|---|
| Year-end “Corner recap” | Recurring reason to share |
| Hello Hours | 6-person themed coffees |
| Local hello | Ask someone in another city for an intro |
| Hindi + other languages | Reach beyond founders |
| Zeyhi Bridges | Opt-in member connector + API/MCP |

---

## 6. Data model & privacy

### Stored in PostgreSQL

- **Map**: `id`, `publicId`, `shortSlug`, `homeCity`, `ownerName`, `entries` (JSON array of `{city, questionIndex}`), `shareImageUrl`, `createdAt`, `userId`, `consent`, `deletedAt`
- **Vouch**: `mapId`, `entryIndex`, `voucherEmailHash`, `voucherName` (only after vouch), `note`, `status`, `verifiedAt`
- **EmailVerification**: `email`, `code`, `purpose`, `mapId`, `usedAt`, `expiresAt`
- **AnalyticsEvent**: `mapId`, `event`, `metadata`, `createdAt`
- **User** (NextAuth): `id`, `email`, `emailVerified`, `image`

### Privacy rules
1. Names stay on the user’s device until a friend vouches back.
2. The shared map stores cities and counts only.
3. Personal names in links live in the URL hash (`#Priya`) and never reach the server.
4. Emails are hashed for vouch identity; plain emails are only used to send the verification code.
5. Users can delete their map from `/me`.

---

## 7. Key copy

### Hero
- **Title:** Who’s in your corner?
- **Subtitle:** Almost everything good in your life came through someone. Put those people on one warm globe, and share it with them.
- **CTA:** Make my Warm Map

### Why we built this
> We are living in the world of campaigns, MQLs, meetings, cold emails, and GTM. Somewhere along the way we missed the freshness of warm meetings, warm intros and humane interactions. We are trying to bring it back.

### Game
- **Question label:** Question X of 12
- **Button:** Light a lantern
- **Tally empty:** No lanterns yet. Your corner is waiting.
- **Tally:** N lanterns lit across N cities.

### Share message
```
This is my Warm Map.
N people in my corner, N cities, N countries, N km of threads.
If you're on it, you know why. Thank you.
— [Name]

Who's in your corner? https://warmmap.world
```

### Public map / friend page
- Heading: Is one of these you?
- Sub: [Name] lit a lantern for someone in your city. If it’s you, tap below to vouch and make your own Warm Map.
- Buttons: Make yours / That’s me

### Table pitch
> Once a map has enough warmth, it becomes a table. Fourteen people, one long dinner, no pitches, no performances. Just the kind of conversations that used to happen over a shared meal and a second cup of tea.
>
> We are starting in a handful of cities. The vision is simple: bring back warm meetings, warm intros and humane interactions everywhere. City by city. Table by table.

### Share CTA
- Heading: Share the warmth
- Sub: If this made you think of someone, tell them. Warmth spreads when we name it.

### Final CTA
- If no map: Missed Warm Map? / Take two minutes. Name the people who’d pick up.
- If map exists: Your corner is lit / Tell the people you named. One share is worth a hundred campaigns.

---

## 8. Decisions made

| Decision | Choice | Why |
|---|---|---|
| Public vs personal link | **Both** | Public for posts/groups; personal `#Name` links for close friends |
| Name storage | **Deferred until vouch** | Keeps the privacy promise; builds trust |
| Voucher verification | **Email 6-digit code** | Cheaper than SMS; real enough to stop fake vouches |
| Auth | **Email magic links only when saving** | Game stays login-free; owners can keep/delete maps |
| Database | **PostgreSQL via Neon** | Persistent, serverless-friendly, free tier |
| Email provider | **Resend** | Clean API; domain verification via DNS |
| Share picture | **Canvas + `@vercel/og`** | Client PNG for saving; server PNG for link previews |
| Cities | **500+ curated + aliases** | Covers most founders; small towns use nearest big city |
| Seat logic | **Different vouchers only, max 5, private** | Avoids popularity contests |

---

## 9. Open questions / next actions

- [ ] Add `RESEND_API_KEY` to Vercel and redeploy so emails send.
- [ ] Confirm domain DNS is fully propagated.
- [ ] Trademark check on “Warm Map”.
- [ ] Decide launch date: early December (slim) vs mid-December (full loop).
- [ ] First Bengaluru Table: manual form + WhatsApp until P1 is built.
- [ ] Collect photos/testimonials for social proof.

---

## 10. Files to share with Claude for strategy review

When reviewing strategy vs implementation, share this index plus:

- `archive/Who's in Your Corner Product Document.md` — original strategy doc
- `README.md` — stack, deploy, env vars
- `src/app/page.tsx` — landing page copy and flow
- `src/components/WarmMapGame.tsx` — game logic and UX
- `src/app/m/[id]/page.tsx` — public map + OG metadata
- `src/app/m/[id]/vouch/page.tsx` — vouch-back flow
- `src/components/ShareCTA.tsx` — social share CTA
- `src/components/FinalCTA.tsx` — final CTA logic
- `src/components/Founders.tsx` — founders story/chips
- `src/app/globals.css` — visual style and mobile breakpoints
- `prisma/schema.prisma` — data model and privacy boundaries
