// Launch asks (Thanksgiving): the LinkedIn follow line, the thank-you link's channel tag, the friend page's S1.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ZEYHI_LINKEDIN_URL } from "@/lib/site";

test("Follow Zeyhi on LinkedIn: one constant, a plain external link, no tracking", () => {
  assert.equal(ZEYHI_LINKEDIN_URL, "https://www.linkedin.com/company/zeyhi/");
  const src = readFileSync("src/components/FollowZeyhi.tsx", "utf8");
  assert.match(src, /href=\{ZEYHI_LINKEDIN_URL\}/);
  assert.match(src, /rel="noopener noreferrer"/);
  assert.ok(!/onClick|trackShare|apiFetch|fetch\(|\?s=|utm_/.test(src), "the follow link sends nothing and carries no tag");
  for (const f of ["src/components/CornerFlow.tsx", "src/components/PublicMap.tsx", "src/components/FollowZeyhi.tsx"]) {
    assert.ok(!readFileSync(f, "utf8").includes("linkedin.com/company"), `${f}: the URL lives only in site.ts`);
  }
});
