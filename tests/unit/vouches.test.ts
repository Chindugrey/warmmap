import test from "node:test";
import assert from "node:assert/strict";
import { isDisplayableVouch } from "@/lib/vouches";

test("only one-tap vouches from a thank-you link are ever shown; pre-v2 verified vouches stay hidden", () => {
  assert.equal(isDisplayableVouch({ tier: "tap", thankLinkId: "tl_1" }), true);
  assert.equal(isDisplayableVouch({ tier: "tap", thankLinkId: null }), false, "migrated e-mail vouch (no link)");
  assert.equal(isDisplayableVouch({ tier: "verified", thankLinkId: "tl_1" }), false);
});
