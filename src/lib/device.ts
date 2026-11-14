"use client";
// Browser-side helpers: the device mark used for per-device limits, and the
// keeper key store. Keys live in localStorage only, never in the URL bar.

const DEVICE_KEY = "wm:device";

function randomId(bytes = 18): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deviceMark(): string {
  try {
    let m = localStorage.getItem(DEVICE_KEY);
    if (!m) {
      m = randomId();
      localStorage.setItem(DEVICE_KEY, m);
    }
    return m;
  } catch {
    return randomId();
  }
}

export const ownerKeyFor = (slug: string): string | null => {
  try {
    return localStorage.getItem(`wm:key:${slug}`);
  } catch {
    return null;
  }
};

export const rememberOwnerKey = (slug: string, key: string) => {
  try {
    localStorage.setItem(`wm:key:${slug}`, key);
  } catch {
    // private mode: the keeper link still works
  }
};

export const forgetOwnerKey = (slug: string) => {
  try {
    localStorage.removeItem(`wm:key:${slug}`);
  } catch {}
};

/** fetch() with the device mark, and the owner key when given. */
export function apiFetch(url: string, init: RequestInit & { ownerKey?: string | null } = {}) {
  const { ownerKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("x-wm-device", deviceMark());
  if (ownerKey) headers.set("x-owner-key", ownerKey);
  if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(url, { ...rest, headers });
}

/**
 * Keeper link handling on /m/[id]: move "#k=…" into storage and strip it from
 * the address bar at once, so a copied address never carries the key.
 */
export function absorbKeeperHash(slug: string): void {
  if (typeof window === "undefined") return;
  const m = window.location.hash.match(/^#k=([A-Za-z0-9_-]{20,128})$/);
  if (!m) return;
  rememberOwnerKey(slug, m[1]);
  history.replaceState(null, "", window.location.pathname + window.location.search);
}
