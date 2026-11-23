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

test("send another way / copy: the same token (so the same server row), only the ?s= tag changes; the name stays after #", async () => {
  const { prepareThank, withChannelTag } = await import("@/lib/lantern-token");
  const t = await prepareThank({ base: "https://warmmap.world", mapId: "k7q2x9ab", entryIndex: 3, friendName: "Meera Nair", channel: "wa" });
  const token = t.url.match(/\/t\/([A-Za-z0-9]{12})/)![1];
  assert.equal(withChannelTag(t.url, "cp"), `https://warmmap.world/t/${token}?s=cp#Meera%20Nair`);
  assert.equal(withChannelTag(t.url, null), `https://warmmap.world/t/${token}#Meera%20Nair`);
  assert.equal(withChannelTag(t.url, "wa"), t.url);
  assert.equal(withChannelTag(`https://warmmap.world/t/${token}`, "cp"), `https://warmmap.world/t/${token}?s=cp`);
  assert.equal(withChannelTag(`https://warmmap.world/t/${token}#s=wa`, null), `https://warmmap.world/t/${token}#s=wa`, "a name is never touched");
  for (const u of [withChannelTag(t.url, "cp"), withChannelTag(t.url, null)]) {
    assert.ok(!u.split("#")[0].includes("Meera"), "the name never moves before #");
  }
});

test("thank-you sheet: WhatsApp, Send another way and Copy link share one link-making path and count as whatsapp / native / copy", () => {
  const src = readFileSync("src/components/ThankSheet.tsx", "utf8");
  assert.equal((src.match(/apiFetch\("\/api\/thanks"/g) ?? []).length, 1, "one place registers a link");
  for (const fn of ["send", "shareAnotherWay", "copyLink"]) {
    const body = src.slice(src.indexOf(`async function ${fn}(`), src.indexOf("\n  }\n", src.indexOf(`async function ${fn}(`)));
    assert.match(body, /await linkFor\(p\)/, `${fn} uses the one link per lantern`);
  }
  assert.match(src, /trackShare\("native", slug, "thanks"\)/);
  assert.match(src, /trackShare\("copy", slug, "thanks"\)/);
  assert.match(src, /typeof navigator\.share === "function"/, "Send another way only where the phone has a share sheet");
  assert.match(src, /Send it however you talk to them\./);
});
