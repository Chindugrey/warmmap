#!/usr/bin/env bash
# Warm Map phase-1/2 walk-through for a screen-share: curl calls against the
# LOCAL seeded server showing link states, the cities-only public payload
# before and after a vouch, rate limits, the counter and the admin score.
#   BASE=http://127.0.0.1:3100 DATABASE_URL=postgresql://warmmap@127.0.0.1:55432/warmmap \
#   ADMIN_TOKEN=local-admin-token scripts/walkthrough.sh
# Needs curl, jq, node and psql. Refuses any non-local server or database.
set -euo pipefail
BASE=${BASE:-http://127.0.0.1:3100}
DATABASE_URL=${DATABASE_URL:-postgresql://warmmap@127.0.0.1:55432/warmmap}
ADMIN_TOKEN=${ADMIN_TOKEN:-local-admin-token}
PSQL=${PSQL:-/usr/lib/postgresql/15/bin/psql}
case "$BASE" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing non-local BASE $BASE"; exit 2;; esac
case "$DATABASE_URL" in *@127.0.0.1:*|*@localhost:*) ;; *) echo "refusing non-local DATABASE_URL"; exit 2;; esac

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }
dev() { node -e 'console.log(require("crypto").randomBytes(18).toString("base64url"))'; }
token() { node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))'; }
sha() { node -e 'console.log(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "$1"; }
code() { curl -s -o "$TMP/body" -w '%{http_code}' "$@"; }
sql() { "$PSQL" "$DATABASE_URL" -At -c "$1"; }

step "0. Fresh rate-limit windows for the demo (local only)"
sql 'DELETE FROM "RateLimit"' >/dev/null; note "cleared"

step "1. The live counter (shown from the first lantern)"
curl -s "$BASE/api/counter"; echo

step "2. Show me: save a 5-lantern India-only map (cities and question numbers, never a friend's name)"
OWNER_DEV=$(dev)
ENTRIES='[{"city":"Kochi","questionIndex":0},{"city":"Mysuru","questionIndex":1},{"city":"Chennai","questionIndex":2},{"city":"Hyderabad","questionIndex":3},{"city":"Pune","questionIndex":4}]'
c=$(code -X POST "$BASE/api/maps" -H "content-type: application/json" -H "x-wm-device: $OWNER_DEV" \
  -d "{\"homeCity\":\"Bengaluru\",\"ownerName\":\"Ananya\",\"entries\":$ENTRIES}")
SLUG=$(jq -r .id "$TMP/body"); KEY=$(jq -r .ownerKey "$TMP/body")
note "HTTP $c  map $SLUG  kind $(jq -r .kind "$TMP/body")  (the key is returned once; the DB holds only its hash)"
note "Owner link: $BASE/m/$SLUG#k=$KEY"
c=$(code -X POST "$BASE/api/maps" -H "content-type: application/json" -H "x-wm-device: $OWNER_DEV" \
  -d "{\"homeCity\":\"Bengaluru\",\"ownerName\":\"Ananya\",\"entries\":[{\"city\":\"Kochi\",\"questionIndex\":0,\"name\":\"Meera\"}]}")
note "A save that carries a friend's name is refused: HTTP $c $(cat "$TMP/body")"

step "3. Public payload BEFORE any vouch (cities only, sorted; no questions, no gold)"
curl -s "$BASE/api/maps/$SLUG" > "$TMP/before.json"; jq -c . "$TMP/before.json"

step "4. The phone makes three thank-you links; the server gets only hash + lantern"
A=$(token); B=$(token); C=$(token)
for pair in "$A:0" "$B:1" "$C:2"; do
  t=${pair%%:*}; q=${pair##*:}
  body="{\"mapId\":\"$SLUG\",\"entryIndex\":$q,\"tokenHash\":\"$(sha "$t")\"}"
  note "POST /api/thanks $body -> $(code -X POST "$BASE/api/thanks" -H "content-type: application/json" -H "x-owner-key: $KEY" -H "x-wm-device: $OWNER_DEV" -d "$body")"
done
note "What the friend gets: $BASE/t/$A#Meera  (the name after # never reaches us)"

step "5. Link states"
c=$(code "$BASE/t/$A"); note "fresh   /t/<A>  HTTP $c: $(grep -o 'The answer was you\.' "$TMP/body" | head -1), $(grep -o 'Tie it back' "$TMP/body" | head -1)"
c=$(code "$BASE/t/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); note "missing /t/<unknown>  HTTP $c: $(grep -o "couldn&#x27;t find this lantern" "$TMP/body" | head -1 | sed "s/&#x27;/'/")"
c=$(code -X POST "$BASE/api/vouch" -H "content-type: application/json" -H "x-owner-key: $KEY" -H "x-wm-device: $OWNER_DEV" -d "{\"token\":\"$C\"}")
note "own     owner taps their own link   HTTP $c $(cat "$TMP/body")"
# Prisma stores UTC timestamps without a zone, so age the link in UTC.
sql "UPDATE \"ThankLink\" SET \"expiresAt\" = (now() AT TIME ZONE 'utc') - interval '1 minute' WHERE \"tokenHash\" = '$(sha "$B")'" >/dev/null
c=$(code -X POST "$BASE/api/vouch" -H "content-type: application/json" -H "x-wm-device: $(dev)" -d "{\"token\":\"$B\"}")
note "expired (aged by SQL, local only)  HTTP $c $(cat "$TMP/body")"
c=$(code "$BASE/t/$B"); note "expired /t/<B> says: $(grep -o 'This link has gone quiet\.' "$TMP/body" | head -1)"
c=$(code -X POST "$BASE/api/vouch" -H "content-type: application/json" -H "x-wm-device: $(dev)" -d "{\"token\":\"$A\"}")
note "Tie it back                        HTTP $c $(jq -c '{ok,ownerName,city}' "$TMP/body")"
c=$(code -X POST "$BASE/api/vouch" -H "content-type: application/json" -H "x-wm-device: $(dev)" -d "{\"token\":\"$A\"}")
note "used    the same link again        HTTP $c $(cat "$TMP/body")"
c=$(code "$BASE/t/$A"); note "used    /t/<A> now says: $(grep -o 'This lantern has already been answered\.' "$TMP/body" | head -1)"
c=$(code -X GET "$BASE/api/vouch"); note "a link scanner's GET cannot vouch: HTTP $c"

step "6. Public payload AFTER the vouch"
curl -s "$BASE/api/maps/$SLUG" > "$TMP/after.json"; jq -c . "$TMP/after.json"
if cmp -s "$TMP/before.json" "$TMP/after.json"; then note "byte-identical to BEFORE: the public cannot see gold"; else note "DIFFERENT (unexpected)"; fi
note "keys: $(jq -c keys "$TMP/after.json")"

step "7. The owner (keeper key) sees the gold"
curl -s "$BASE/api/maps/$SLUG/owner" -H "x-owner-key: $KEY" -H "x-wm-device: $OWNER_DEV" | jq -c '{gold}'
note "Without the key: HTTP $(code "$BASE/api/maps/$SLUG/owner")"

step "8. Per-device rate limit: six maps from one phone in an hour"
D=$(dev); codes=""
for i in 1 2 3 4 5 6; do
  codes="$codes $(code -X POST "$BASE/api/maps" -H "content-type: application/json" -H "x-wm-device: $D" -d "{\"homeCity\":\"Pune\",\"ownerName\":\"Rate\",\"entries\":$ENTRIES}")"
done
note "HTTP:$codes   (the sixth is 429; $(jq -r .error "$TMP/body"))"
note "Another phone is not blocked: HTTP $(code -X POST "$BASE/api/maps" -H "content-type: application/json" -H "x-wm-device: $(dev)" -d "{\"homeCity\":\"Pune\",\"ownerName\":\"Other\",\"entries\":$ENTRIES}")"

step "9. The counter again"
note "(cached for 30 s at the edge; locally it is live)"
curl -s "$BASE/api/counter"; echo

step "10. Admin connector score (Bearer ADMIN_TOKEN)"
note "without the token: HTTP $(code "$BASE/api/admin/connectors")"
curl -s "$BASE/api/admin/connectors" -H "authorization: Bearer $ADMIN_TOKEN" \
  | jq -c --arg s "$SLUG" '.rows[] | select(.map == $s) | {map, ownerName, lanterns, cities, thankYousSent, vouchesReceived, distinctVouchers, mapsBroughtIn, score}'
note "top 3 by score:"
curl -s "$BASE/api/admin/connectors" -H "authorization: Bearer $ADMIN_TOKEN" | jq -c '.rows[:3][] | {map, ownerName, score}'
printf '\nDone. Owner link to open in the browser: %s/m/%s#k=%s\n' "$BASE" "$SLUG" "$KEY"
