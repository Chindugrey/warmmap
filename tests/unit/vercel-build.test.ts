import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Production builds must never migrate (Jai migrates prod by hand, after the
// backup). Previews migrate their own database first. Any failure fails the build.
const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
const cmd: string = vercel.buildCommand;
const shells = ["/bin/sh", "/bin/bash", "/bin/dash"].filter((s) => existsSync(s));

function run(shell: string, env: Record<string, string>, fail: { prisma?: boolean; next?: boolean } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "wm-vercel-"));
  const log = path.join(dir, "log");
  for (const [bin, bad] of [["prisma", fail.prisma], ["next", fail.next]] as const) {
    const f = path.join(dir, bin);
    writeFileSync(f, `#!/bin/sh\necho "${bin} $*" >> "${log}"\nexit ${bad ? 3 : 0}\n`);
    chmodSync(f, 0o755);
  }
  const r = spawnSync(shell, ["-c", cmd], { env: { PATH: `${dir}:/usr/bin:/bin`, ...env }, encoding: "utf8" });
  const ran = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, ran };
}

test("vercel.json buildCommand is the guarded form", () => {
  assert.equal(cmd, 'if [ "$VERCEL_ENV" != "production" ]; then prisma migrate deploy || exit 1; fi; next build');
});

for (const sh of shells) {
  test(`${sh}: production builds never migrate`, () => {
    assert.deepEqual(run(sh, { VERCEL_ENV: "production" }), { code: 0, ran: ["next build"] });
  });
  test(`${sh}: previews (and unset env) migrate their own database, then build`, () => {
    assert.deepEqual(run(sh, { VERCEL_ENV: "preview" }), { code: 0, ran: ["prisma migrate deploy", "next build"] });
    assert.deepEqual(run(sh, {}), { code: 0, ran: ["prisma migrate deploy", "next build"] });
  });
  test(`${sh}: a failed preview migration fails the build and skips next build`, () => {
    const r = run(sh, { VERCEL_ENV: "preview" }, { prisma: true });
    assert.notEqual(r.code, 0);
    assert.deepEqual(r.ran, ["prisma migrate deploy"]);
  });
  test(`${sh}: a failed next build fails the build, in production and preview`, () => {
    assert.notEqual(run(sh, { VERCEL_ENV: "production" }, { next: true }).code, 0);
    assert.notEqual(run(sh, { VERCEL_ENV: "preview" }, { next: true }).code, 0);
  });
}
