"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, type GlobeEntry } from "@/components/Globe";
import { ShareCard } from "@/components/ShareCard";
import type { PublicMap as PublicMapData } from "@/lib/public-map";
import { absorbKeeperHash, apiFetch, forgetOwnerKey, ownerKeyFor } from "@/lib/device";

interface OwnerView {
  answers: ({ city: string; questionIndex: number; question: string | null } | { city: string; carried: true })[];
  gold: { entryIndex: number; city: string; isNew: boolean }[];
}

const linkedInShare = (url: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

export function PublicMap({ map }: { map: PublicMapData }) {
  const displayName = map.ownerName || "Someone";
  const [owner, setOwner] = useState<OwnerView | null>(null);
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/m/${map.id}`;

  useEffect(() => {
    // Keeper link: move #k=… into storage and out of the address bar first.
    absorbKeeperHash(map.id);
    const key = ownerKeyFor(map.id);
    if (!key) return;
    apiFetch(`/api/maps/${map.id}/owner`, { ownerKey: key }).then(async (res) => {
      if (res.status === 403) return forgetOwnerKey(map.id);
      if (!res.ok) return;
      setOwnerKey(key);
      setOwner(await res.json());
    });
  }, [map.id]);

  const fresh = owner?.gold.filter((g) => g.isNew) ?? [];

  useEffect(() => {
    if (ownerKey && fresh.length) {
      apiFetch(`/api/maps/${map.id}/seen`, { method: "POST", ownerKey });
    }
  }, [ownerKey, fresh.length, map.id]);

  async function deleteMap() {
    const res = await apiFetch(`/api/maps/${map.id}`, { method: "DELETE", ownerKey });
    if (res.ok) {
      forgetOwnerKey(map.id);
      setDeleted(true);
    }
  }

  if (deleted) {
    return (
      <section className="plate chapter" style={{ paddingTop: 40 }}>
        <h2>It&apos;s gone. Every lantern, every thread.</h2>
        <Link className="btn" href="/">Make a new one</Link>
      </section>
    );
  }

  // The owner sees gold; everyone else sees the same amber map, cities only.
  const goldCities = new Map<string, number>();
  owner?.gold.forEach((g) => goldCities.set(g.city, (goldCities.get(g.city) ?? 0) + 1));
  const entries: GlobeEntry[] = map.lanterns.map((city) => {
    const left = goldCities.get(city) ?? 0;
    if (left > 0) goldCities.set(city, left - 1);
    return { city, gold: left > 0 };
  });

  return (
    <section className="plate chapter" style={{ paddingTop: 40 }}>
      {fresh.length > 0 && (
        <div className="personal-banner" role="status">
          <strong>{fresh[0].city} answered.</strong>
          {fresh.length > 1 && <> And {fresh.length - 1} more.</>}{" "}
          <a href={linkedInShare(url)} target="_blank" rel="noopener noreferrer">
            Share your gratitude map
          </a>
        </div>
      )}

      <div className="game">
        <ShareCard
          ownerName={displayName}
          stats={{ people: map.stats.lanterns, cities: map.stats.cities, countries: map.stats.countries, km: map.stats.km }}
          globe={<Globe homeCity={map.homeCity} entries={entries} width={520} height={520} animateLast={false} />}
        />

        <div className="vouch-cta">
          {owner ? (
            <>
              <h2>Your map</h2>
              <p className="note">Only you can see which lanterns are gold. On the map you share, every lantern looks the same.</p>
              {!confirming ? (
                <button className="btn ghost" type="button" onClick={() => setConfirming(true)}>
                  Delete my map
                </button>
              ) : (
                <div className="row">
                  <button className="btn" type="button" onClick={deleteMap}>Yes, delete it for good</button>
                  <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>Keep it</button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Who&apos;s in your corner?</h2>
              <p>{displayName} lit a lantern for everyone who has their back.</p>
              <div className="row">
                <Link className="btn" href={`/?invitedBy=${map.id}&via=map`}>Make yours</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
