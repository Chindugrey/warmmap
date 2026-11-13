"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Globe } from "@/components/Globe";
import { ShareCard } from "@/components/ShareCard";
import { mapStats } from "@/lib/geo";
import { citiesByName } from "@/lib/cities";

interface Entry {
  city: string;
  questionIndex: number;
}

interface MapData {
  id: string;
  publicId: string;
  shortSlug: string;
  homeCity: string;
  ownerName?: string | null;
  entries: any;
  vouchCount?: number;
}

export default function VouchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const selectedCity = searchParams.get("city");

  const [map, setMap] = useState<MapData | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetch(`/api/maps/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Map not found");
        const data = (await res.json()) as MapData;
        setMap(data);
        const parsed: Entry[] = Array.isArray(data.entries)
          ? data.entries
          : JSON.parse(data.entries || "[]");
        setEntries(parsed);
        if (selectedCity) {
          const idx = parsed.findIndex((e) => e.city === selectedCity);
          if (idx >= 0) setSelectedIndex(idx);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, selectedCity]);

  const stats = map ? mapStats(entries, map.homeCity) : null;

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIndex === null || !email) return;
    setSubmitting(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/vouch?action=request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: id,
          entryIndex: selectedIndex,
          email,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not send code");
      }
      setCodeSent(true);
      setStatusMsg("Code sent. Check your inbox (and spam folder).");
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIndex === null || !email || !code) return;
    setSubmitting(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/vouch?action=confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: id,
          entryIndex: selectedIndex,
          email,
          code,
          name: name.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not confirm");
      }
      setSuccess(true);
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="page chapter">
        <p className="quiet">Loading map…</p>
      </main>
    );
  }

  if (error || !map) {
    return (
      <main className="page chapter">
        <h2>Map not found</h2>
        <p className="quiet">That Warm Map doesn&apos;t exist or was deleted.</p>
        <Link className="btn" href="/">
          Make yours
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="page chapter epilogue">
        <h2>You vouched.</h2>
        <p>
          Thank you. {map.ownerName || "Someone"} will know their corner
          reached them.
        </p>
        <Link className="btn" href={`/?invitedBy=${map.shortSlug}`}>
          Make your own Warm Map
        </Link>
      </main>
    );
  }

  return (
    <section className="plate chapter" style={{ paddingTop: 40 }}>
      <div className="game">
        <ShareCard
          ownerName={map.ownerName || "Someone"}
          stats={stats!}
          globe={
            <Globe
              homeCity={map.homeCity}
              entries={entries}
              width={520}
              height={520}
              animateLast={false}
            />
          }
        />

        <div className="card" aria-live="polite">
          <h2 style={{ fontSize: 34 }}>Is one of these you?</h2>
          <p className="quiet">
            Pick the city where {map.ownerName || "someone"} lit a lantern for
            you. We&apos;ll send a quick code to your email to make sure you&apos;re a
            real person.
          </p>

          <div className="field">
            <label>Which city are you in?</label>
            <select
              value={selectedIndex ?? ""}
              onChange={(e) =>
                setSelectedIndex(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Choose a city</option>
              {entries.map((entry, idx) => (
                <option key={idx} value={idx}>
                  {citiesByName[entry.city]?.name ?? entry.city}
                </option>
              ))}
            </select>
          </div>

          {!codeSent ? (
            <form onSubmit={requestCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label htmlFor="vouch-email">Your email</label>
                <input
                  id="vouch-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                className="btn"
                type="submit"
                disabled={selectedIndex === null || submitting}
              >
                {submitting ? "Sending…" : "Send me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={confirm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label htmlFor="vouch-code">6-digit code</label>
                <input
                  id="vouch-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="vouch-name">Your first name (optional)</label>
                <input
                  id="vouch-name"
                  type="text"
                  maxLength={24}
                  placeholder="Priya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="vouch-note">
                  One line about {map.ownerName || "them"} (optional)
                </label>
                <input
                  id="vouch-note"
                  type="text"
                  maxLength={280}
                  placeholder="They'd pick up at 2 a.m."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <button
                className="btn"
                type="submit"
                disabled={submitting || code.length !== 6}
              >
                {submitting ? "Vouching…" : "Vouch"}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                }}
              >
                Use a different email
              </button>
            </form>
          )}

          {statusMsg && <p className="note" role="status">{statusMsg}</p>}

          <p className="note">
            Your email is only used for this one check. We never message anyone
            for {map.ownerName || "the map owner"}.
          </p>
        </div>
      </div>
    </section>
  );
}
