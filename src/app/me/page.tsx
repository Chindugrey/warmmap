"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface MapItem {
  id: string;
  publicId: string;
  shortSlug?: string | null;
  homeCity: string;
  ownerName?: string | null;
  createdAt: string;
  stats?: {
    people: number;
    cities: number;
    countries: number;
  };
}

export default function MePage() {
  const { status } = useSession();
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMaps() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load maps");
      const data = await res.json();
      setMaps(data.maps || []);
    } catch {
      setError("Could not load your maps. Are you signed in?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMaps();
    } else if (status === "unauthenticated") {
      setLoading(false);
      setError("Please sign in to view your maps.");
    }
  }, [status]);

  async function deleteMap(id: string) {
    if (!confirm("Delete this Warm Map? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/me/maps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMaps((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Could not delete the map.");
    }
  }

  if (loading) {
    return (
      <main className="dashboard">
        <p className="note">Loading your maps…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <p className="note">{error}</p>
        <Link className="btn" href="/auth/signin">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <h1>Your Warm Maps</h1>
      {maps.length === 0 ? (
        <p className="note">No maps yet.</p>
      ) : (
        maps.map((map) => {
          const slug = map.shortSlug || map.publicId;
          return (
            <div key={map.id} className="maprow">
              <div>
                <strong>
                  {map.ownerName ? `${map.ownerName}'s Warm Map` : "My Warm Map"}
                </strong>
                <p className="note">
                  Home: {map.homeCity} · Created:{" "}
                  {new Date(map.createdAt).toLocaleDateString("en-IN")}
                  {map.stats
                    ? ` · ${map.stats.people} people, ${map.stats.cities} cities`
                    : null}
                </p>
              </div>
              <div className="row">
                <Link className="btn ghost" href={`/m/${slug}`}>
                  View
                </Link>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => deleteMap(map.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
      <Link className="btn" href="/#corner" style={{ alignSelf: "flex-start" }}>
        Make a new map
      </Link>
    </main>
  );
}
