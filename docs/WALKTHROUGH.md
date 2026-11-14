# Warm Map walk-through (screen-share)

About ten minutes. Everything runs on a laptop against a local, seeded database; nothing touches production.

## Before the call

```bash
cd ~/work/warmmap/repo
/usr/lib/postgresql/15/bin/pg_ctl -D ~/work/warmmap/.localpg/data -l ~/work/warmmap/.localpg/pg.log \
  -o "-p 55432 -k $HOME/work/warmmap/.localpg -c listen_addresses=127.0.0.1" start
export DATABASE_URL="postgresql://warmmap@127.0.0.1:55432/warmmap"
npx prisma migrate deploy && npx prisma generate
node --import ./tests/register.mjs scripts/seed-local.ts http://127.0.0.1:3100   # keep the printed URLs
npm run dev -- -H 127.0.0.1 -p 3100
```

## Part 1: in the browser (seeded URLs)

1. `/` : the hero, the live counter, **Light my first lantern** → home chips → five questions → **See my map** → the reveal (tap to skip) → name → **Show me** → *Your corner is glowing.* with WhatsApp, LinkedIn, Copy link and the Status/Story picture.
2. The friend link `/t/…#Rohan` : *The answer was you.* → **Tie it back** → *Tied at both ends.* → **Make yours** starts with the carried lantern.
3. Ananya's keeper link `/m/…#k=…` : *Kochi answered.* → **Share your gratitude map**. The `#k=` disappears from the address bar.
4. The same map in a private window: cities only, no gold.
5. The cards: `/api/og?id=<map>` and `/api/og?id=<map>&f=story`, for the 5-lantern India map and the 12-lantern three-country map.

## Part 2: under the hood (`scripts/walkthrough.sh`)

```bash
BASE=http://127.0.0.1:3100 ADMIN_TOKEN=local-admin-token scripts/walkthrough.sh
```

| Step | What it shows |
|---|---|
| 1, 9 | `GET /api/counter`: the exact lantern total, from the first lantern |
| 2 | **Show me** saves cities and question numbers; a save that carries a friend's name is refused (400) |
| 3, 6 | The public payload before and after a vouch: cities only, sorted, **byte-identical** (the public cannot see gold) |
| 4 | Three thank-you links: the server receives only `{mapId, entryIndex, tokenHash}` |
| 5 | Link states: **fresh** (The answer was you.), **missing**, **own** (409), **expired** (410, aged in SQL), **Tie it back** (200), **used** (409), and a GET cannot vouch (405) |
| 7 | The owner's view with the keeper key shows the gold; without it, 403 |
| 8 | Per-device rate limit: five maps, then 429; another phone is not blocked |
| 10 | The admin connector score (401 without the token), this map's row and the top three |

The script refuses any server or database that is not on this machine. It clears the local rate-limit table first, so it can run more than once in an hour.

## After the call

Stop the dev server (Ctrl-C), then `pg_ctl -D ~/work/warmmap/.localpg/data stop`.
