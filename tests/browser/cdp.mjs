// Minimal Chrome DevTools Protocol driver, no packages: launches an already
// installed headless Chromium (CHROME env, else Playwright's cached
// headless shell) and talks to it over Node's built-in WebSocket.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = path.join(homedir(), ".cache/ms-playwright");
  if (!existsSync(root)) return null;
  for (const d of readdirSync(root).sort().reverse()) {
    if (d.startsWith("chromium_headless_shell-")) {
      const p = path.join(root, d, "chrome-headless-shell-linux64/chrome-headless-shell");
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 390, height = 844, mobile = true, reducedMotion = false } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error("no Chromium found (set CHROME)");
  const dir = mkdtempSync(path.join(tmpdir(), "wm-cdp-"));
  const proc = spawn(bin, ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    const f = path.join(dir, "DevToolsActivePort");
    if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0];
  }
  if (!port) throw new Error("chrome did not start");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
    } else if (m.method) listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  if (reducedMotion) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const requests = [];
  listeners.push((m) => {
    if (m.method === "Network.requestWillBeSent") requests.push({ url: m.params.request.url, method: m.params.request.method, body: m.params.request.postData ?? "", headers: m.params.request.headers });
  });
  const errors = [];
  listeners.push((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  const api = {
    send, requests, errors,
    async goto(url, waitMs = 1500) {
      const loaded = new Promise((r) => listeners.push(function l(m) { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }));
      await send("Page.navigate", { url });
      await Promise.race([loaded, sleep(15000)]);
      await sleep(waitMs);
    },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async shot(file, clip) {
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: !!clip });
      writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    async click(selector) {
      return api.eval(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('no '+${JSON.stringify(selector)});el.click();return true})()`);
    },
    sleep,
    async close() { try { ws.close(); } catch {} proc.kill(); await sleep(300); rmSync(dir, { recursive: true, force: true }); },
  };
  return api;
}
