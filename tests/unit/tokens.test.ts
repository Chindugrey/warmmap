import test from "node:test";
import assert from "node:assert/strict";
import { makeLanternToken, hashLanternToken, prepareThank, readFriendName } from "@/lib/lantern-token";
import { sha256Hex, isWellFormedToken, newOwnerKey, hmacHex, dayStamp } from "@/lib/server-crypto";

test("lantern token: 192 bits of randomness, base64url, unique", () => {
  const a = makeLanternToken();
  const b = makeLanternToken();
  assert.match(a, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a, b);
  assert.equal(isWellFormedToken(a), true);
  assert.equal(isWellFormedToken("short"), false);
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
