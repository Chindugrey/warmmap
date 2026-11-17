"use client";

import Link from "next/link";
// /m/[id]. Three faces:
// - a visitor: the map, cities only, then "Make yours";
// - the owner coming back to new gold: "Kochi answered." [Share your gratitude map];
// - the owner otherwise: the map with its gold lanterns, the thank-yous, delete.
// The owner is whoever holds the map's key (from the keeper link's #k=…).

import { useEffect, useState } from "react";
import { Globe, type GlobeLantern } from "@/components/Globe";
import { ThankSheet, type Named } from "@/components/ThankSheet";
import { CURRENT_SET } from "@/lib/questions";
import { ShareRow } from "@/components/ShareRow";
import { LiveCounter } from "@/components/LiveCounter";
import { StoryPictureLink, sharePicture, useStoryFile } from "@/components/StoryPicture";
import type { PublicMap as PublicMapData } from "@/lib/public-map";
import { KIND_LINES } from "@/lib/kinds";
import { absorbKeeperHash, apiFetch, forgetOwnerKey, ownerKeyFor, rememberOwnerKey } from "@/lib/device";
import { makeYoursHref, mapShareText, whatsAppUrl } from "@/lib/flow";

interface OwnerView {
  questionSet: number;
  answers: ({ city: string; questionIndex: number; question: string | null } | { city: string; carried: true })[];
  gold: { entryIndex: number; city: string; isNew: boolean }[];
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export function PublicMap({ map }: { map: PublicMapData }) {
  const owner = map.ownerName || "Someone";
  const [view, setView] = useState<OwnerView | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [newKeeper, setNewKeeper] = useState<string | null>(null);
  const [names, setNames] = useState<Named[]>([]);
  const [url, setUrl] = useState(`/m/${map.id}`);
  const [channel, setChannel] = useState<string | null>(null);
  const storyFile = useStoryFile(view ? map.id : null);

  useEffect(() => {
    // Move #k=… into storage and out of the address bar before anything else.
    absorbKeeperHash(map.id);
    const k = ownerKeyFor(map.id);
    let stored: Named[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(`wm:names:${map.id}`) || "[]");
    } catch {}
    queueMicrotask(() => {
      setUrl(`${window.location.origin}/m/${map.id}`);
      setNames(stored);
      setChannel(new URLSearchParams(window.location.search).get("s"));
    });
    if (!k) {
      // A visitor (not the owner) opened the map: count one view, with the share channel if the link had one.
      const s = new URLSearchParams(window.location.search).get("s");
      apiFetch(`/api/maps/${map.id}${s ? `?s=${encodeURIComponent(s)}` : ""}`).catch(() => {});
      return;
    }
    apiFetch(`/api/maps/${map.id}/owner`, { ownerKey: k }).then(async (res) => {
      if (res.status === 403) return forgetOwnerKey(map.id);
      if (!res.ok) return;
      const v: OwnerView = await res.json();
      setKey(k);
      setView(v);
      if (v.gold.some((g) => g.isNew)) {
        setReturning(true);
        apiFetch(`/api/maps/${map.id}/seen`, { method: "POST", ownerKey: k }).catch(() => {});
      }
    });
  }, [map.id]);

  async function deleteMap() {
    const res = await apiFetch(`/api/maps/${map.id}`, { method: "DELETE", ownerKey: key });
    if (res.ok) {
      forgetOwnerKey(map.id);
      try {
        localStorage.removeItem(`wm:names:${map.id}`);
        const d = JSON.parse(localStorage.getItem("wm:draft") || "null");
        if (d?.saved?.slug === map.id) localStorage.removeItem("wm:draft");
      } catch {}
      setDeleted(true);
    }
  }

  async function newKey() {
    const res = await apiFetch(`/api/maps/${map.id}/key`, { method: "POST", ownerKey: key });
    if (!res.ok) return;
    const d = await res.json();
    rememberOwnerKey(map.id, d.ownerKey);
    setKey(d.ownerKey);
    setNewKeeper(`${window.location.origin}/m/${map.id}#k=${d.ownerKey}`);
  }

  // "Share your gratitude map": the Status/Story picture with the map link where
  // the phone can share files; else the link alone; else WhatsApp.
  async function shareGratitude() {
    const text = mapShareText(map.stats.cities, `${url}?s=wa`);
    if (await sharePicture(storyFile.current, text.replace(` ${url}?s=wa`, ""), `${url}?s=st`)) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${owner}'s Warm Map`, text: text.replace(` ${url}?s=wa`, ""), url: `${url}?s=st` });
        return;
      } catch {
        /* cancelled */
      }
    }
    window.open(whatsAppUrl(text), "_blank", "noopener,noreferrer");
  }

  if (deleted) {
    return (
      <div className="wm">
        <main className="wm-scr wm-public">
          <h1>It&apos;s gone. Every lantern, every thread.</h1>
          <div className="wm-body">
            <Link className="wm-btn" href="/">
              Make a new one
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // The owner sees their own order and gold; a visitor sees the public, sorted cities, all amber.
  let lanterns: GlobeLantern[] = map.lanterns.map((city) => ({ city }));
  if (view) {
    const goldSet = new Set(view.gold.map((g) => g.entryIndex));
    lanterns = view.answers.map((a, i) => {
      const idx = "questionIndex" in a ? (view.questionSet === 1 ? i : a.questionIndex) : -1;
      return { city: a.city, gold: idx >= 0 && goldSet.has(idx) };
    });
  }
  const kindTitle = map.kind ? KIND_LINES[map.kind].title : null;
  const fresh = view?.gold.filter((g) => g.isNew) ?? [];

  if (view && returning && fresh.length) {
    const first = fresh[0];
    const focus = view.answers.findIndex((a, i) =>
      "questionIndex" in a ? (view.questionSet === 1 ? i : a.questionIndex) === first.entryIndex : false
    );
    return (
      <div className="wm">
        <main className="wm-scr wm-return">
          <div className="wm-top">
            <span className="wm-wm">Warm Map</span>
            <span>{owner}&apos;s map</span>
          </div>
          <div className="wm-mapw">
            <Globe
              homeCity={map.homeCity}
              lanterns={lanterns}
              labels={[first.city]}
              homeLabel=""
              focus={focus >= 0 ? focus : undefined}
              turn={focus >= 0 ? focus : undefined}
              scale={1.15}
              label={`${owner}'s globe, close on ${first.city}, where the lantern has turned gold`}
            />
          </div>
          <div className="wm-txt">
            <p className="wm-kick">A lantern answered back</p>
            <h1>{first.city} answered.</h1>
            <p className="wm-sub">
              The thread to {first.city} is tied at both ends now.
              {fresh.length > 1 && ` And ${plural(fresh.length - 1, "more lantern", "more lanterns")} turned gold.`}
            </p>
          </div>
          <div className="wm-body">
            <button className="wm-btn" type="button" onClick={shareGratitude}>
              Share your gratitude map
            </button>
            <ShareRow url={url} />
            <StoryPictureLink slug={map.id} />
            <p className="wm-note" style={{ textAlign: "center" }}>
              Only you can see which lanterns are gold. On the map you share, every lantern looks the same.
            </p>
            <button className="wm-lnk" type="button" onClick={() => setReturning(false)}>
              See my whole map
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="wm">
      <main className="wm-scr wm-public">
        <div className="wm-top">
          <Link className="wm-wm" href="/">
            Warm Map
          </Link>
          <span>{view ? "Your map" : "Names hidden"}</span>
        </div>
        <h1>{owner}&apos;s Warm Map</h1>
        <div className="wm-mapw">
          <Globe homeCity={map.homeCity} lanterns={lanterns} homeLabel={view ? "you" : ""} />
        </div>
        <div className="wm-body">
          <p className="wm-stats">
            {plural(map.stats.lanterns, "lantern", "lanterns")} · {plural(map.stats.cities, "city", "cities")} ·{" "}
            {map.stats.km.toLocaleString("en-IN")} km of thread
          </p>
          {kindTitle && (
            <p className="wm-kindline">
              <b style={{ fontFamily: "var(--fd)", fontWeight: 400, fontStyle: "normal", fontSize: 22 }}>{kindTitle}.</b>{" "}
              {KIND_LINES[map.kind!].line}
            </p>
          )}
          {map.because && <p className="wm-bec">{map.because}</p>}

          {view ? (
            <>
              {view.gold.length > 0 && (
                <p className="wm-note" style={{ textAlign: "center" }}>
                  Only you can see which lanterns are gold. On the map you share, every lantern looks the same.
                </p>
              )}
              {view.questionSet >= 2 && (
                <button className="wm-btn" type="button" onClick={() => setSheet(true)}>
                  Tell them on WhatsApp
                </button>
              )}
              <ShareRow url={url} />
              <StoryPictureLink slug={map.id} />
              <LiveCounter />
              {newKeeper && (
                <p className="wm-keeper">
                  Your new key. The old one no longer works.{" "}
                  <a href={whatsAppUrl(`My Warm Map key. Keep it to yourself: ${newKeeper}`)} target="_blank" rel="noopener noreferrer">
                    Send it to myself on WhatsApp
                  </a>
                </p>
              )}
              <div className="wm-owner-bar">
                <button type="button" onClick={newKey}>
                  Make a new key
                </button>
                {!confirm ? (
                  <button type="button" onClick={() => setConfirm(true)}>
                    Delete my map
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={deleteMap}>
                      Yes, delete it for good
                    </button>
                    <button type="button" onClick={() => setConfirm(false)}>
                      Keep it
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <a className="wm-btn" href={makeYoursHref(map.id, channel)}>
                Make yours
              </a>
              <p className="wm-note" style={{ textAlign: "center" }}>
                Who&apos;s in your corner? A name and a city at a time. Names never leave your phone.
              </p>
            </>
          )}
        </div>
      </main>
      {sheet && (
        <ThankSheet slug={map.id} questionSet={view?.questionSet ?? CURRENT_SET} people={names} goldQuestions={view?.gold.map((g) => g.entryIndex) ?? []} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}
