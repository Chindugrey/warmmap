"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Globe } from "@/components/Globe";
import { apiFetch, ownerKeyFor } from "@/lib/device";
import { readFriendName } from "@/lib/lantern-token";
import type { LinkState } from "@/lib/thank-link";

interface View {
  mapSlug: string;
  ownerName: string;
  ownerHome: string;
  city: string | null;
  question: string | null;
}

interface Props {
  token: string;
  state: LinkState;
  view: View | null;
}

const noSubscribe = () => () => {};

export function FriendPage({ token, state: initial, view }: Props) {
  const [linkState, setState] = useState<LinkState | "own" | "tied">(initial);
  // Read from the browser only (never rendered on the server): the name after #,
  // and whether this phone holds the map's key (then it is the owner's own lantern).
  const friendName = useSyncExternalStore(noSubscribe, () => readFriendName(window.location.hash), () => null);
  const isOwn = useSyncExternalStore(noSubscribe, () => !!view && !!ownerKeyFor(view.mapSlug), () => false);
  const state = isOwn && linkState === "ok" ? "own" : linkState;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "t_open", metadata: { via: "thanks" } }) }).catch(() => {});
  }, []);

  async function tie() {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/vouch", {
        method: "POST",
        body: JSON.stringify({ token }),
        ownerKey: ownerKeyFor(view.mapSlug),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMapUrl(data.mapUrl);
        setState("tied");
      } else if (data.state) {
        setState(data.state);
      } else {
        setError(data.error || "That didn't go through. Try once more.");
      }
    } catch {
      setError("You seem to be offline. Try once more.");
    } finally {
      setBusy(false);
    }
  }

  if (!view || state === "missing") {
    return (
      <section className="plate chapter" style={{ paddingTop: 40 }}>
        <h2>We couldn&apos;t find this lantern.</h2>
        <Link className="btn" href="/">Make yours</Link>
      </section>
    );
  }

  const owner = view.ownerName;
  const tellBack = `https://wa.me/?text=${encodeURIComponent(`I'm in your corner. Always was. ${mapUrl ?? ""}`.trim())}`;
  const makeYours = `/?invitedBy=${view.mapSlug}&via=thanks`;

  return (
    <section className="plate chapter" style={{ paddingTop: 40 }}>
      <div className="game">
        <Globe
          homeCity={view.ownerHome}
          entries={view.city ? [{ city: view.city, gold: state === "tied" || state === "used" }] : []}
          width={360}
          height={360}
          animateLast={false}
        />
        <div className="vouch-cta">
          <p className="note">{friendName ? `${friendName}, someone lit a lantern for you` : "Someone lit a lantern for you"}</p>
          <p>{owner} was asked:</p>
          <h2>{view.question}</h2>

          {state === "ok" && (
            <>
              <p><em>The answer was you.</em></p>
              <button className="btn" type="button" onClick={tie} disabled={busy}>
                {busy ? "Tying…" : "Tie it back"}
              </button>
              <p className="note">One tap. No sign-up. {owner} will see a gold lantern.</p>
              {error && <p className="note" role="alert">{error}</p>}
            </>
          )}

          {state === "tied" && (
            <>
              <h2 role="status">Tied at both ends.</h2>
              <div className="row">
                <a className="btn" href={tellBack} target="_blank" rel="noopener noreferrer">
                  Tell {owner} yourself
                </a>
                <Link className="btn ghost" href={makeYours}>Make yours</Link>
              </div>
            </>
          )}

          {state === "used" && (
            <>
              <p>This lantern has already been answered. You can still make your own map.</p>
              <Link className="btn" href={makeYours}>Make yours</Link>
            </>
          )}

          {state === "expired" && (
            <>
              <p>This link has gone quiet. Ask {owner} for a new one, or make your own map.</p>
              <Link className="btn" href={makeYours}>Make yours</Link>
            </>
          )}

          {state === "own" && <p>This is your own lantern. It&apos;s waiting for someone else.</p>}
        </div>
      </div>
    </section>
  );
}
