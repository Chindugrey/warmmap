-- Legacy (v1, commit 7ccc728) rows used to test the v2 migration locally.
-- Load AFTER the init migration and BEFORE the v2 migration. Local DB only.
INSERT INTO "Map" (id, "publicId", "shortSlug", "homeCity", "ownerName", "ownerEmail", entries, consent, "deletedAt", "createdAt", "updatedAt") VALUES
 ('legacy_live', 'pub_live', 'oldlive1', 'Bengaluru', 'Ravi', NULL,
  '[{"city":"Kochi","questionIndex":0},{"city":"Mumbai","questionIndex":2},{"city":"Bengaluru","questionIndex":3},{"city":"Bengaluru","questionIndex":4},{"city":"London","questionIndex":9},{"city":"Atlantis","questionIndex":10}]'::jsonb,
  false, NULL, now() - interval '1 day', now()),
 ('legacy_str', 'pub_str', 'oldstr01', 'Delhi', NULL, NULL,
  '"[{\"city\":\"Pune\",\"questionIndex\":1},{\"city\":\"Delhi\",\"questionIndex\":5}]"'::jsonb,
  false, NULL, now() - interval '1 day', now()),
 ('legacy_gone', 'pub_gone', 'oldgone1', 'Chennai', 'Deleted', 'x@example.com',
  '[{"city":"Kochi","questionIndex":0}]'::jsonb, false, now() - interval '2 hours', now() - interval '1 day', now());
INSERT INTO "Vouch" (id, "mapId", "entryIndex", "voucherEmailHash", "voucherName", note, status, "verifiedAt", "createdAt") VALUES
 ('v_ok1', 'legacy_live', 0, 'habc', 'Meera', 'love you', 'verified', now(), now() - interval '3 hours'),
 ('v_dup', 'legacy_live', 0, 'hdef', 'Someone', NULL, 'verified', now(), now() - interval '2 hours'),
 ('v_pend', 'legacy_live', 1, 'hghi', NULL, NULL, 'pending', NULL, now()),
 ('v_badidx', 'legacy_live', 40, 'hjkl', NULL, NULL, 'verified', now(), now()),
 ('v_gone', 'legacy_gone', 0, 'hmno', NULL, NULL, 'verified', now(), now());
INSERT INTO "EmailVerification" (id, email, code, purpose, "mapId", "expiresAt") VALUES
 ('ev1', 'meera@example.com', '123456', 'vouch', 'legacy_live', now() + interval '10 minutes');
INSERT INTO "AnalyticsEvent" (id, "mapId", event, metadata) VALUES
 ('ae1', 'legacy_live', 'create', '{"entries":6}'),
 ('ae2', 'legacy_gone', 'play', '{}'),
 ('ae3', NULL, 'page_view', '{"path":"/"}');
