import test from "node:test";
import assert from "node:assert/strict";
import { makeLanternToken, hashLanternToken, prepareThank, readFriendName } from "@/lib/lantern-token";
import { sha256Hex, isWellFormedToken, newOwnerKey, hmacHex, dayStamp } from "@/lib/server-crypto";

test("lantern token: 12 base62 characters (~71 bits), no - or _, unique", () => {
  const a = makeLanternToken();
  const b = makeLanternToken();
  assert.match(a, /^[A-Za-z0-9]{12}$/);
  assert.notEqual(a, b);
  assert.equal(isWellFormedToken(a), true);
  const seen = new Set(Array.from({ length: 2000 }, () => makeLanternToken()));
  assert.equal(seen.size, 2000);
  for (const t of seen) assert.match(t, /^[A-Za-z0-9]{12}$/);
});

test("lantern token: base62 is unbiased (every symbol turns up about equally)", () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 4000; i++) for (const ch of makeLanternToken()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  assert.equal(counts.size, 62);
  const mean = (4000 * 12) / 62;
  for (const [ch, n] of counts) assert.ok(n > mean * 0.85 && n < mean * 1.15, `${ch} appeared ${n} times (mean ${mean.toFixed(0)})`);
});

test("old 32-character tokens (already shared on the preview) are still well-formed; junk is not", () => {
  assert.equal(isWellFormedToken("8p57BbddugAjEbnpn8iTzOTApr-WAXurh"), false, "33 chars");
  assert.equal(isWellFormedToken("8p57BbddugAjEbnpn8iTzOTApr-WAXur"), true, "32 chars, base64url");
  assert.equal(isWellFormedToken("A".repeat(32)), true);
  assert.equal(isWellFormedToken("short"), false);
  assert.equal(isWellFormedToken("a".repeat(11)), false);
  assert.equal(isWellFormedToken("a".repeat(13)), false);
  assert.equal(isWellFormedToken("a".repeat(11) + "-"), false, "12 chars must be base62 only");
  assert.equal(isWellFormedToken("a".repeat(11) + "_"), false);
  assert.equal(isWellFormedToken("a".repeat(31) + "/"), false);
});

test("client hash equals server hash (server stores only this)", async () => {
  const t = makeLanternToken();
  assert.equal(await hashLanternToken(t), sha256Hex(t));
});

test("PRIVACY: the name lives only after # and is never in what the server receives", async () => {
  const p = await prepareThank({ base: "https://warmmap.world", mapId: "k7q2x9ab", entryIndex: 0, friendName: "Meera Nair" });
  const [beforeHash, hash] = p.url.split("#");
  assert.ok(!beforeHash.includes("Meera"));
  assert.equal(decodeURIComponent(hash), "Meera Nair");
  const sent = JSON.stringify(p.body);
  assert.ok(!sent.includes("Meera"));
  const token = beforeHash.split("/t/")[1];
  assert.match(token, /^[A-Za-z0-9]{12}$/);
  assert.ok(p.url.length <= "https://warmmap.world/t/".length + 12 + 1 + 12, "short enough for one line");
  assert.ok(!sent.includes(token), "the raw token must not be posted, only its hash");
  assert.deepEqual(Object.keys(p.body).sort(), ["entryIndex", "mapId", "tokenHash"]);
  assert.equal(p.body.tokenHash, sha256Hex(token));
});

test("readFriendName never throws on a malformed hash and caps length", () => {
  assert.equal(readFriendName("#%"), null);
  assert.equal(readFriendName(""), null);
  assert.equal(readFriendName("#Meera%20Nair"), "Meera Nair");
  assert.equal(readFriendName("#" + "x".repeat(60))!.length, 24);
  assert.equal(readFriendName("#k=abc"), null, "a keeper-link hash is not a name");
});

test("owner key: 256 bits base64url; hmac depends on secret; day stamp is UTC date", () => {
  assert.match(newOwnerKey(), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(hmacHex("s1", "x"), hmacHex("s2", "x"));
  assert.equal(dayStamp(new Date("2026-11-19T23:59:00Z")), "2026-11-19");
});

test("copy counts follow the question set, never a typed-in 12", async () => {
  const { numberWord, questionCountFor, QUESTION_COUNT } = await import("@/lib/questions");
  assert.equal(questionCountFor(2), QUESTION_COUNT);
  assert.equal(questionCountFor(1), 12);
  assert.equal(numberWord(12), "twelve");
  assert.equal(numberWord(8), "eight");
  assert.equal(numberWord(40), "40");
});

test("channel tag: only wa / li / cp / st survive, nothing else, no values that could carry a person", async () => {
  const { cleanMetadata, channelTag } = await import("@/lib/analytics");
  for (const s of ["wa", "li", "cp", "st"]) assert.deepEqual(cleanMetadata({ s }), { s });
  for (const bad of ["WA", "whatsapp", "wa ", "wa&x=1", "Meera", "", "x".repeat(300), 5, null, ["wa"], { a: 1 }]) assert.deepEqual(cleanMetadata({ s: bad }), {}, JSON.stringify(bad));
  assert.deepEqual(cleanMetadata({ s: "wa", name: "Meera", url: "/t/abc#Meera" }), { s: "wa" });
  assert.equal(channelTag("li"), "li");
  assert.equal(channelTag("javascript:alert(1)"), undefined);
  assert.equal(channelTag(null), undefined);
  assert.equal(channelTag(undefined), undefined);
});

test("thank link carries the channel tag before the # and still keeps the name after it", async () => {
  const p = await prepareThank({ base: "https://warmmap.world", mapId: "k7q2x9ab", entryIndex: 0, friendName: "Vijin", channel: "wa" });
  assert.match(p.url, /^https:\/\/warmmap\.world\/t\/[A-Za-z0-9]{12}\?s=wa#Vijin$/);
  assert.ok(p.url.length <= 52);
  const plain = await prepareThank({ base: "https://warmmap.world", mapId: "k7q2x9ab", entryIndex: 0, friendName: "Vijin" });
  assert.match(plain.url, /^https:\/\/warmmap\.world\/t\/[A-Za-z0-9]{12}#Vijin$/);
});
