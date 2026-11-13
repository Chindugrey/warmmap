# Warm Map

Who's in your corner? A small story about the people who'd pick up — and a way to tell them.

Live at **https://warmmap.world**

## What's inside

- A login-free 12-question globe game.
- A shareable Warm Map with a short link (`/m/xxxx`).
- Automatic preview pictures for WhatsApp, LinkedIn and Twitter.
- A friend's page where someone can vouch back with email verification.
- Light sign-in with email magic links (only when saving).
- A `/me` dashboard to see and delete your maps.
- Privacy-first: names stay on your device until someone vouches. The server stores cities and counts only.

## Stack

- Next.js 16 (App Router)
- Prisma + SQLite for local dev (switch to PostgreSQL for production)
- NextAuth with email magic links
- Resend for transactional email
- @vercel/og for OpenGraph images
- Deployed on Vercel

## Local development

```bash
npm install
# The SQLite database file is created automatically:
npx prisma migrate dev
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your values.

## Production database

The committed schema uses **SQLite**, which is fine for local development but not persistent on Vercel serverless functions. For a live product:

1. Create a PostgreSQL database (Neon, Supabase or Vercel Postgres).
2. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
3. Update `DATABASE_URL` in Vercel to your PostgreSQL connection string.
4. Run `npx prisma migrate deploy` against that database (or use Vercel's build command: `prisma migrate deploy && next build`).
5. For local dev with PostgreSQL, use `docker compose up db` (see `docker-compose.yml`).

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file locally, PostgreSQL URL in production |
| `NEXTAUTH_SECRET` | Random string for JWT/session signing |
| `NEXTAUTH_URL` | e.g. `https://warmmap.world` |
| `RESEND_API_KEY` | Required to send magic links and vouch codes |
| `RESEND_FROM_EMAIL` | e.g. `noreply@warmmap.world` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional OAuth |
| `NEXT_PUBLIC_BASE_URL` | `https://warmmap.world` |
| `NEXT_PUBLIC_DOMAIN` | `warmmap.world` |

## Deploy

Pushes to `main` deploy automatically via Vercel.

```bash
vercel --prod
```

## Privacy and trust

- Names are never stored until that person vouches back themselves.
- The shared map stores only cities and counts.
- Users can delete their map from `/me`.
- Rate limits protect against spam (maps per hour, vouch codes per email).

## License

Private — built by the Zeyhi team.
