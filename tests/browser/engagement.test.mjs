// The admin engagement log in a real browser at 1440 and 390: sign in, fill the form, see the row in the
// views; no sideways scroll at either width.   BASE=http://localhost:3106 ADMIN_TOKEN=… npm run test:browser
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { launch, findChrome } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`refusing non-local BASE ${BASE}`);
const ADMIN = process.env.ADMIN_TOKEN ?? "local-admin-token";
const skip = !findChrome() && "no Chromium installed";
const open = [];
after(async () => { for (const b of open) await b.close(); });
const tag = Date.now().toString(36);

for (const [width, mobile] of [[1440, false], [390, true]]) {
  test(`engagement log at ${width}px: sign in, log an entry, see it in the views`, { skip }, async () => {
    const b = await launch({ width, height: 900, mobile });
    open.push(b);
    await b.goto(`${BASE}/admin/dashboard/engagement`);
    assert.ok(await b.eval("!!document.querySelector('input[name=token]')"), "the token form first");
    await b.eval(`document.querySelector('input[name=token]').value=${JSON.stringify(ADMIN)};document.querySelector('form').submit()`);
    await b.sleep(1500);
    await b.goto(`${BASE}/admin/dashboard/engagement`);
    assert.ok(await b.eval("!!document.querySelector('form.log')"), "the log form");
    const camp = `br-${tag}-${width}`;
    await b.eval(`(()=>{const f=document.querySelector('form.log');
      f.platform.value='instagram';f.campaign.value=${JSON.stringify(camp)};f.likes.value='21';f.comments.value='4';f.reshares.value='2';
      f.note.value='browser test';f.postUrl.value='https://example.com/p/1';f.requestSubmit();})()`);
    await b.sleep(2000);
    const text = await b.eval("document.querySelector('main').innerText");
    assert.match(text, /Logged\./);
    await b.goto(`${BASE}/admin/dashboard/engagement?campaign=${camp}`);
    const t = await b.eval("document.querySelector('main').innerText");
    assert.match(t, /Per map/);
    assert.match(t, /Per platform/);
    assert.match(t, /Per campaign/);
    assert.match(t, new RegExp(camp));
    assert.match(t, /Instagram/);
    assert.match(t, /\b27\b/); // 21 + 4 + 2
    const overflow = await b.eval("document.documentElement.scrollWidth - window.innerWidth");
    assert.ok(overflow <= 1, `page scrolls sideways by ${overflow}px`);
    assert.deepEqual(b.errors, []);
    // clean up through the page's own delete button
    await b.eval("document.querySelector('form.del button').click()");
    await b.sleep(1500);
    await b.goto(`${BASE}/admin/dashboard/engagement?campaign=${camp}`);
    assert.match(await b.eval("document.querySelector('main').innerText"), /Nothing logged yet/);
  });
}
