import test from "node:test";
import assert from "node:assert/strict";
import { windowStart } from "@/lib/rate-limit-window";
import { connectorScore } from "@/lib/connector";
import { counterPayload } from "@/lib/counter";
import { questionFor, QUESTIONS, LEGACY_QUESTIONS } from "@/lib/questions";

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

test("12 questions in 3 chapters; legacy maps keep their old wording", () => {
  assert.equal(QUESTIONS.length, 12);
  assert.deepEqual([...new Set(QUESTIONS.map((q) => q.chapter))], [1, 2, 3]);
  assert.equal(questionFor(2, 0), "Who would you call at 2am?");
  assert.equal(questionFor(1, 3), LEGACY_QUESTIONS[3]);
  assert.equal(questionFor(2, 12), null);
});
