"use client";

// v2.1a optional 2027 card (behind V21A). A role or a company, up to three. It lives in this phone's localStorage and
// goes into the LinkedIn post only when the owner ticks "Add it to my LinkedIn post". It is never sent to us.
import { useEffect, useState } from "react";
import { KIT_COPY, WISH_LEN, WISH_MAX, cleanWish } from "@/lib/v21a";

export interface Wish {
  items: string[];
  inPost: boolean;
  skipped: boolean;
}

const EMPTY: Wish = { items: [], inPost: false, skipped: false };

export function useWish(slug: string | null): [Wish, (f: (w: Wish) => Wish) => void] {
  const [wish, setWish] = useState<Wish>(EMPTY);
  const key = slug ? `wm:wish:${slug}` : null;
  useEffect(() => {
    if (!key) return;
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null");
      if (v && Array.isArray(v.items)) queueMicrotask(() => setWish({ items: v.items.filter((s: unknown) => typeof s === "string").slice(0, WISH_MAX), inPost: !!v.inPost, skipped: !!v.skipped }));
    } catch {}
  }, [key]);
  const update = (f: (w: Wish) => Wish) =>
    setWish((w) => {
      const next = f(w);
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  return [wish, update];
}

export function Wish2027({ wish, update, onSeePost }: { wish: Wish; update: (f: (w: Wish) => Wish) => void; onSeePost: () => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (wish.skipped)
    return (
      <p className="wm-hint">
        Wish list skipped.{" "}
        <button className="wm-lnk" type="button" onClick={() => update((w) => ({ ...w, skipped: false }))}>
          Undo
        </button>
      </p>
    );
  function add() {
    const t = cleanWish(draft);
    if (!t) return setErr("A role or a company, a few words.");
    setErr(null);
    setDraft("");
    update((w) => ({ ...w, items: [...w.items, t].slice(0, WISH_MAX) }));
  }
  return (
    <section className="wm-27" aria-labelledby="wm-27h">
      <p className="wm-kick">{KIT_COPY.wishKicker}</p>
      <h2 id="wm-27h">{KIT_COPY.wishTitle}</h2>
      <p className="wm-note">{KIT_COPY.wishSub}</p>
      {wish.items.length > 0 && (
        <ul className="wm-ppl">
          {wish.items.map((t, i) => (
            <li key={`${t}-${i}`}>
              {t}
              <button type="button" className="wm-x" aria-label={`Remove ${t}`} onClick={() => update((w) => ({ ...w, items: w.items.filter((_, j) => j !== i) }))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {wish.items.length < WISH_MAX && (
        <div className="wm-r2">
          <label className="wm-fld" style={{ flex: 1 }}>
            <span>A role or a company</span>
            <input
              id="wm-27in"
              value={draft}
              maxLength={WISH_LEN}
              autoComplete="off"
              aria-describedby="wm-27help"
              placeholder="a Head of Design at a fintech"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </label>
          <button className="wm-btn two" type="button" style={{ flex: "none", width: 72 }} onClick={add}>
            Add
          </button>
        </div>
      )}
      {err && (
        <p className="wm-err" role="alert">
          {err}
        </p>
      )}
      <p className="wm-hint" id="wm-27help" style={{ textAlign: "left" }}>
        {KIT_COPY.wishHint}
      </p>
      <label className="wm-consent wm-solid">
        <input type="checkbox" checked={wish.inPost} onChange={(e) => update((w) => ({ ...w, inPost: e.target.checked }))} />
        <span>{KIT_COPY.wishInPost}</span>
      </label>
      <div className="wm-row" style={{ justifyContent: "space-between" }}>
        <button className="wm-lnk" type="button" onClick={() => update((w) => ({ ...w, skipped: true }))}>
          Not now
        </button>
        {wish.items.length > 0 && (
          <button className="wm-lnk" type="button" onClick={onSeePost}>
            See it in my post
          </button>
        )}
      </div>
    </section>
  );
}
