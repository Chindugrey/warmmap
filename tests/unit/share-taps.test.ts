// The pure parts of the per-map share-tap counts: the 30 IST-day window and how rows fold into it.
import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_TAP_DAYS, foldShareTaps, istDay, shareTapsSince } from "@/lib/share-taps";

// 23:59 IST on 19 Nov = 18:29 UTC; 00:01 IST on 20 Nov = 18:31 UTC.
test("IST day boundary: 23:59 is still the 19th, 00:01 is the 20th", () => {
  assert.equal(istDay(new Date("2026-11-19T18:29:00Z")), "2026-11-19");
  assert.equal(istDay(new Date("2026-11-19T18:31:00Z")), "2026-11-20");
});

test("the window is today and the 29 IST days before it, newest day first", () => {
  const now = new Date("2026-11-19T18:31:00Z"); // 00:01 IST on 20 Nov
  assert.equal(shareTapsSince(now).toISOString(), "2026-10-21T18:30:00.000Z"); // 00:00 IST on 22 Oct
  const { days } = foldShareTaps([], now);
  assert.equal(days.length, SHARE_TAP_DAYS);
  assert.equal(days[0].day, "2026-11-20");
  assert.equal(days[days.length - 1].day, "2026-10-22");
});

test("channels land in their column; missing or unknown channels are Other; the total counts every tap", () => {
  const now = new Date("2026-11-20T06:00:00Z");
  const { days, totals } = foldShareTaps(
    [
      { day: "2026-11-20", channel: "whatsapp", count: 2 }, { day: "2026-11-20", channel: "story", count: 1 },
      { day: "2026-11-20", channel: null, count: 3 }, { day: "2026-11-20", channel: "fax", count: 1 },
      { day: "2026-11-19", channel: "copy", count: 4 }, { day: "2026-01-01", channel: "copy", count: 9 }, // outside the window
    ],
    now
  );
  const today = days.find((d) => d.day === "2026-11-20")!;
  assert.deepEqual(today, { day: "2026-11-20", whatsapp: 2, linkedin: 0, copy: 0, story: 1, native: 0, other: 4, total: 7 });
  assert.equal(days.find((d) => d.day === "2026-11-19")!.copy, 4);
  assert.deepEqual(totals, { whatsapp: 2, linkedin: 0, copy: 4, story: 1, native: 0, other: 4, total: 11 });
});
