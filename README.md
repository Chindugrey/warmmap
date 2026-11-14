# Warm Map

Who's in your corner? A small, shareable map of the people who have your back, and a way to tell them.

Live at **https://warmmap.world**

## What's inside

- A one-card creation flow: home city, then the 12 questions in 3 chapters. Five lanterns unlock the reveal; twelve complete the map.
- The map is saved at **Show me**, with the owner's first name and the cities. Friends' names never reach the server.
- Private thank-you links `/t/[token]`: the token is made on the phone; the server keeps only its hash. **Tie it back** turns the lantern gold.
- The owner's map `/m/[id]` with gold (by keeper key, `/m/[id]#k=…`), delete and a new key. Visitors see cities only.
- Share cards in Storybook dusk: `/api/og?id=…` (1200×627) and `&f=story` (1080×1920).
- A live lantern counter, per-device rate limits, and a founder's connector score at `/api/admin/connectors`.
- No e-mail anywhere, no accounts, no third-party analytics.

## Local development

PostgreSQL only. Use a throwaway local cluster (or `docker compose up db`), never a shared database.

```bash
npm ci
# put the variables below in .env.local (local values)
export DATABASE_URL="postgresql://warmmap@127.0.0.1:55432/warmmap"
npx prisma migrate deploy
node --import ./tests/register.mjs scripts/seed-local.ts http://localhost:3100   # prints URLs to open
npm run dev -- -H 127.0.0.1 -p 3100
```

Tests: `npm test` (unit), `npm run test:api` and `npm run test:browser` (against the local server), `scripts/check-migration.sh` (replays the migrations on v1 rows in a scratch database). `scripts/walkthrough.sh` is a curl walk-through for a screen-share (see `docs/WALKTHROUGH.md`).

## Environment variables

The app reads exactly these:

| Variable | Required? | Production | Preview | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | Required | The production Neon database | **Its own Neon branch, never production** | Previews run `prisma migrate deploy` against it on every build. Use the direct (non-pooled) connection string so migrations work. |
| `WM_SECRET` | Required wherever `NODE_ENV=production` (both Vercel Production and Preview) | 32+ random characters | 32+ random characters, **different from production** | Salts the IP and device fingerprints. Missing or short: every route that hashes returns 500. |
| `ADMIN_TOKEN` | Optional | 32+ random characters | Its own value, or unset | Bearer token for `/api/admin/connectors`. Unset (or under 16 characters): the admin API answers 404. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Leave unset (defaults to `https://warmmap.world`) | The preview's own URL | Inlined at **build** time. Every share link and card URL is built from it, never from the request. Unset on a preview means its links and cards point at production. |

Set by Vercel, not by us: `NODE_ENV`, `VERCEL_ENV` (read by the build command). No longer read and safe to delete from Vercel: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DOMAIN`. Test-only: `BASE`, `CHROME`, `SHOTS`.

## Deploying and migrations

`vercel.json` builds with:

```sh
if [ "$VERCEL_ENV" != "production" ]; then prisma migrate deploy || exit 1; fi; next build
```

- **Production never migrates on build.** Jai migrates production **by hand**, after taking a private backup. Migration `20261114180000_no_email_sign_in` drops the `User`, `Account`, `Session` and `VerificationToken` tables (they hold e-mail addresses) and `Map.userId`; back those up first.
- **Previews migrate their own database** on every build. A failed preview migration fails the build. A failed `next build` fails every build.
- `tests/unit/vercel-build.test.ts` runs this exact command under sh, bash and dash with stub binaries to prove all of the above.

Production order of operations: back up, then `DATABASE_URL=<prod direct URL> npx prisma migrate deploy` from a trusted machine, then deploy.

## Privacy and trust

- Friends' names never reach the server: they stay on the phone and travel only after the `#` of a thank-you link.
- Public maps show the owner's first name, home city and cities sorted by name. Never which question a city answered, never gold, never counts.
- A map is deleted for good from its keeper link.
- Rate limits are per device and per IP, stored as hashes.

## License

Private, built by the Zeyhi team.
