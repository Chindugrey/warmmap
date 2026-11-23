// The map's key goes to /api/analytics with a share tap only (src/lib/track-share.ts), never with any other event,
// and never in a body: every other client call to /api/analytics is sent without it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

test("only trackShare sends the owner key to /api/analytics", () => {
  const callers: string[] = [];
  for (const f of files(SRC)) {
    const rel = path.relative(SRC, f);
    if (rel.startsWith(path.join("app", "api"))) continue; // the route itself
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (!line.includes("/api/analytics")) return;
      callers.push(`${rel}:${i + 1}`);
      if (rel !== path.join("lib", "track-share.ts")) assert.doesNotMatch(line, /ownerKey|x-owner-key/i, `${rel}:${i + 1} sends the owner key with a non-share event`);
    });
  }
  assert.ok(callers.some((c) => c.startsWith(path.join("lib", "track-share.ts"))), `no trackShare caller found in ${callers}`);
  assert.ok(callers.length >= 3, `expected the share, flow and friend-page callers, got ${callers}`);
});
