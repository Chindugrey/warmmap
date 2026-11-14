#!/usr/bin/env bash
# Replays the v2 migration on legacy (v1) rows in a scratch database and checks
# the result. LOCAL ONLY: refuses any host other than 127.0.0.1/localhost.
# Usage: PGBIN=/usr/lib/postgresql/15/bin PGPORT=55432 scripts/check-migration.sh
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/15/bin}
PGHOST=${PGHOST:-127.0.0.1}; PGPORT=${PGPORT:-55432}; PGUSER=${PGUSER:-warmmap}
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo "refusing non-local host $PGHOST"; exit 2;; esac
DB=warmmap_migcheck
URL="postgresql://$PGUSER@$PGHOST:$PGPORT/$DB"
psql() { "$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }
"$PGBIN/dropdb" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --if-exists "$DB"
"$PGBIN/createdb" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB"
cd "$(dirname "$0")/.."
psql -q -d "$DB" -f prisma/migrations/20261113083739_init/migration.sql
psql -q -d "$DB" -f scripts/fixtures/legacy-v1.sql
psql -q -d "$DB" -f prisma/migrations/20261114120000_v2_gratitude_map/migration.sql
psql -q -d "$DB" -f prisma/migrations/20261114180000_no_email_sign_in/migration.sql
q() { psql -d "$DB" -At -c "$1"; }
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got '$2' want '$3'"; fail=1; fi; }
check "soft-deleted map is hard-deleted"        "$(q "select count(*) from \"Map\" where id='legacy_gone'")" 0
check "its events are gone too"                 "$(q "select count(*) from \"AnalyticsEvent\" where id='ae2'")" 0
check "legacy maps are question set 1"          "$(q "select string_agg(\"questionSet\"::text, ',' order by id) from \"Map\"")" "1,1"
check "string entries became an array"          "$(q "select jsonb_array_length(entries) from \"Map\" where id='legacy_str'")" 2
check "one gold vouch kept per lantern"         "$(q "select string_agg(id, ',') from \"Vouch\"")" "v_ok1"
check "new maps default to question set 2"      "$(q "select column_default from information_schema.columns where table_name='Map' and column_name='questionSet'")" 2
check "EmailVerification dropped"               "$(q "select to_regclass('\"EmailVerification\"') is null")" t
check "no e-mail sign-in tables left"           "$(q "select count(*) from information_schema.tables where table_name in ('User','Account','Session','VerificationToken')")" 0
check "legacy maps stay ownerless (no key)"     "$(q "select count(*) from \"Map\" where \"ownerKeyHash\" is not null")" 0
check "no voucher names left"                   "$(q "select count(*) from information_schema.columns where table_name='Vouch' and column_name in ('voucherName','note','voucherEmailHash')")" 0
DATABASE_URL="$URL" npx prisma migrate diff --from-url "$URL" --to-schema-datamodel prisma/schema.prisma --exit-code >/dev/null 2>&1 && echo "ok   schema matches prisma/schema.prisma" || { echo "FAIL schema drift"; fail=1; }
"$PGBIN/dropdb" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB"
exit $fail
