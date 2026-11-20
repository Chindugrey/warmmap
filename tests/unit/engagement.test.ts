import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, istToday, parseEngagement, COUNT_MAX, NOTE_MAX } from "@/lib/engagement";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const good = { map: "abc123", platform: "linkedin", campaign: "Launch-Week", postUrl: "https://www.linkedin.com/posts/x?y=1#frag", likes: "12", comments: "", reshares: 3, occurredOn: "2026-11-19", note: "  first post " };

test("a good entry parses: trimmed, campaign lower-cased, fragment dropped, blank count is 0", () => {
  const r = parseEngagement(good, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value, { mapRef: "abc123", platform: "linkedin", campaign: "launch-week", postUrl: "https://www.linkedin.com/posts/x?y=1", likes: 12, comments: 0, reshares: 3, occurredOn: "2026-11-19", note: "first post" });
  }
});

test("optional fields may be empty or missing", () => {
  const r = parseEngagement({ platform: "other", occurredOn: "2026-11-20" }, NOW);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.value.mapRef, r.value.campaign, r.value.postUrl, r.value.note, r.value.likes], [null, null, null, null, 0]);
});

test("each bad field is named in the errors", () => {
  const bad = (patch: Record<string, unknown>, field: string) => {
    const r = parseEngagement({ ...good, ...patch }, NOW);
    assert.ok(!r.ok, field + " " + JSON.stringify(patch));
    if (!r.ok) assert.ok(field in r.errors, `${field}: ${JSON.stringify(r.errors)}`);
  };
  bad({ platform: "tiktok" }, "platform");
  bad({ platform: "" }, "platform");
  bad({ campaign: "has/slash" }, "campaign");
  bad({ campaign: "x".repeat(41) }, "campaign");
  bad({ postUrl: "javascript:alert(1)" }, "postUrl");
  bad({ postUrl: "https://user:pw@example.com/x" }, "postUrl");
  bad({ postUrl: "not a url" }, "postUrl");
  bad({ postUrl: "https://example.com/" + "a".repeat(300) }, "postUrl");
  bad({ likes: "-1" }, "likes");
  bad({ likes: "1.5" }, "likes");
  bad({ comments: "abc" }, "comments");
  bad({ reshares: String(COUNT_MAX + 1) }, "reshares");
  bad({ likes: { a: 1 } }, "likes");
  bad({ occurredOn: "2026-02-30" }, "occurredOn");
  bad({ occurredOn: "2026-11-22" }, "occurredOn"); // the future
  bad({ occurredOn: "20 Nov" }, "occurredOn");
  bad({ occurredOn: "" }, "occurredOn");
  bad({ note: "n".repeat(NOTE_MAX + 1) }, "note");
  bad({ map: "m".repeat(81) }, "map");
});

test("today in IST rolls over at 18:30 UTC; control characters leave the note", () => {
  assert.equal(istToday(Date.parse("2026-11-20T18:29:00Z")), "2026-11-20");
  assert.equal(istToday(Date.parse("2026-11-20T18:30:00Z")), "2026-11-21");
  const r = parseEngagement({ ...good, note: "a\u0000b\nc" }, NOW);
  assert.ok(r.ok && r.value.note === "a b c");
});

test("aggregate: totals and per map / platform / campaign, biggest first", () => {
  const a = aggregate([
    { mapId: "m1", platform: "linkedin", campaign: "launch", likes: 10, comments: 2, reshares: 1 },
    { mapId: "m1", platform: "instagram", campaign: "launch", likes: 1, comments: 0, reshares: 0 },
    { mapId: "m2", platform: "linkedin", campaign: null, likes: 5, comments: 5, reshares: 5 },
    { mapId: null, platform: "linkedin", campaign: "diwali", likes: 100, comments: 0, reshares: 0 },
  ]);
  assert.deepEqual(a.totals, { posts: 4, likes: 116, comments: 7, reshares: 6, total: 129 });
  assert.deepEqual(a.byPlatform.map((g) => [g.key, g.posts, g.total]), [["linkedin", 3, 128], ["instagram", 1, 1]]);
  assert.deepEqual(a.byMap.map((g) => [g.key, g.total]), [[null, 100], ["m2", 15], ["m1", 14]]);
  assert.deepEqual(a.byCampaign.map((g) => [g.key, g.posts, g.total]), [["diwali", 1, 100], [null, 1, 15], ["launch", 2, 14]]);
  const tie = aggregate([
    { mapId: null, platform: "other", campaign: null, likes: 1, comments: 0, reshares: 0 },
    { mapId: "z", platform: "other", campaign: "z", likes: 1, comments: 0, reshares: 0 },
  ]);
  assert.deepEqual(tie.byCampaign.map((g) => g.key), ["z", null]); // a tie puts the unlabelled bucket last
});

test("aggregate of nothing is zeros and empty lists", () => {
  const a = aggregate([]);
  assert.deepEqual(a.totals, { posts: 0, likes: 0, comments: 0, reshares: 0, total: 0 });
  assert.deepEqual([a.byMap, a.byPlatform, a.byCampaign], [[], [], []]);
});
