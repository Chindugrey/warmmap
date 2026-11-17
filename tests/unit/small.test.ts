import test from "node:test";
import assert from "node:assert/strict";
import { windowStart } from "@/lib/rate-limit-window";
import { connectorScore } from "@/lib/connector";
import { counterPayload } from "@/lib/counter";
import { questionFor, QUESTIONS, QUESTIONS_V2, LEGACY_QUESTIONS, CURRENT_SET, UNLOCK_AT, questionCountFor, numberWord } from "@/lib/questions";

test("rate-limit windows are fixed buckets", () => {
  const h = 3_600_000;
  assert.equal(windowStart(Date.UTC(2026, 10, 19, 10, 59), h).toISOString(), "2026-11-19T10:00:00.000Z");
});

test("connector score = distinct vouchers + maps brought in + cities", () => {
  assert.equal(connectorScore({ distinctVouchers: 3, mapsBroughtIn: 2, cities: 5 }), 10);
});

test("live counter: exact count from the first lantern (never rounded up)", () => {
  assert.deepEqual(counterPayload(0), { show: false, lanterns: null });
  assert.deepEqual(counterPayload(1), { show: true, lanterns: 1 });
  // The old rule hid everything below 15; it is gone from the server.
  for (let n = 1; n < 15; n++) assert.deepEqual(counterPayload(n), { show: true, lanterns: n });
  assert.deepEqual(counterPayload(1234), { show: true, lanterns: 1234 });
});

test("set 3: 8 questions in 3 chapters (3 / 3 / 2), the confirmed wording; unlock stays at 5", () => {
  assert.equal(QUESTIONS.length, 8);
  assert.equal(CURRENT_SET, 3);
  assert.deepEqual(QUESTIONS.map((q) => q.chapter), [1, 1, 1, 2, 2, 2, 3, 3]);
  assert.deepEqual(QUESTIONS.map((q) => q.text), [
    "Who would you call at 2am?",
    "Who knew you before you were anyone?",
    "Who showed up when things went wrong?",
    "Who gave you your first real break?",
    "Who opened a door you couldn't open yourself?",
    "Who told you the truth when it was hard to hear?",
    "Who would you start something with tomorrow?",
    "Who haven't you thanked properly yet?",
  ]);
  assert.equal(UNLOCK_AT, 5);
  assert.equal(questionFor(3, 7), "Who haven't you thanked properly yet?");
  assert.equal(questionFor(3, 8), null);
  assert.equal(questionCountFor(3), 8);
});

test("set 2 (maps saved on the preview) keeps all 12 questions so old thank links still resolve", () => {
  assert.equal(QUESTIONS_V2.length, 12);
  assert.equal(questionCountFor(2), 12);
  assert.equal(questionFor(2, 0), "Who would you call at 2am?");
  assert.equal(questionFor(2, 3), "Who still makes you laugh at the worst times?");
  assert.equal(questionFor(2, 11), "Who haven't you thanked properly yet?");
  assert.equal(questionFor(2, 12), null);
});

test("legacy maps keep their old wording", () => {
  assert.equal(questionFor(1, 3), LEGACY_QUESTIONS[3]);
  assert.equal(questionCountFor(1), 12);
});

test("'one of eight' is derived: the count word follows the set", () => {
  assert.equal(`one of ${numberWord(questionCountFor(3))} questions`, "one of eight questions");
  assert.equal(`one of ${numberWord(questionCountFor(2))} questions`, "one of twelve questions");
});
