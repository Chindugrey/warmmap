"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "@/components/Globe";
import { ShareCard } from "@/components/ShareCard";

interface PublicMapEntry {
  city: string;
  questionIndex: number;
}

interface PublicMapProps {
  mapId: string;
  ownerName: string | null;
  homeCity: string;
  entries: PublicMapEntry[];
  stats: {
    people: number;
    cities: number;
    countries: number;
    km: number;
  };
  vouchCount: number;
}

function readHashName(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  return decodeURIComponent(raw).replace(/[-_]/g, " ").slice(0, 24);
}

export function PublicMap({
  mapId,
  ownerName,
  homeCity,
  entries,
  stats,
  vouchCount,
}: PublicMapProps) {
  const [hashName] = useState(readHashName);

  const displayName = ownerName || "Someone";

  return (
    <section className="plate chapter" style={{ paddingTop: 40 }}>
      {hashName && (
        <div className="personal-banner">
          {hashName}, you&apos;re on {displayName}&apos;s map.
        </div>
      )}

      <div className="game">
        <ShareCard
          ownerName={displayName}
          stats={stats}
          globe={
            <Globe
              homeCity={homeCity}
              entries={entries.map((e) => ({ city: e.city }))}
              width={520}
              height={520}
              animateLast={false}
            />
          }
        />

        <div className="vouch-cta">
          <h2 style={{ color: "var(--night-ink)" }}>
            Is one of these you?
          </h2>
          <p>
            {displayName} lit a lantern for someone in your city. If it&apos;s
            you, tap below to vouch and make your own Warm Map.
          </p>
          <div className="row">
            <Link className="btn" href={`/?invitedBy=${mapId}`}>
              Make yours
            </Link>
            <Link className="btn ghost" href={`/m/${mapId}/vouch`}>
              That&apos;s me
            </Link>
          </div>
          <p className="note" style={{ color: "#A99C82" }}>
            {vouchCount}{" "}
            {vouchCount === 1 ? "person has" : "people have"} vouched so far.
          </p>
        </div>
      </div>
    </section>
  );
}
