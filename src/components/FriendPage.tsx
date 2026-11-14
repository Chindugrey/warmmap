"use client";

import Link from "next/link";
// /t/[token]: "The answer was you." [Tie it back] → "Tied at both ends."
// The friend's name (if the owner put one after #) is read here, in the
// browser, and is never sent anywhere.

import { useEffect, useState, useSyncExternalStore } from "react";
import { LanternGlyph, GlyphDefs } from "@/components/Globe";
import { apiFetch, ownerKeyFor } from "@/lib/device";
import { readFriendName } from "@/lib/lantern-token";
import { whatsAppUrl } from "@/lib/flow";
import type { LinkState } from "@/lib/thank-link";

interface View {
  mapSlug: string;
  ownerName: string;
  ownerHome: string;
  city: string | null;
  question: string | null;
}

const noSubscribe = () => () => {};
const PATH = "M118 196 Q 170 40 316 66";

export function FriendPage({ token, state: initial, view }: { token: string; state: LinkState; view: View | null }) {
  const [linkState, setState] = useState<LinkState | "tied">(initial);
  const friendName = useSyncExternalStore(noSubscribe, () => readFriendName(window.location.hash), () => null);
  const isOwn = useSyncExternalStore(noSubscribe, () => !!view && !!ownerKeyFor(view.mapSlug), () => false);
  const state = isOwn && linkState === "ok" ? "own" : linkState;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "t_open", metadata: { via: "thanks" } }) }).catch(() => {});
  }, []);

  async function tie() {
    if (!view || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/vouch", { method: "POST", body: JSON.stringify({ token }), ownerKey: ownerKeyFor(view.mapSlug) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMapUrl(data.mapUrl);
        setState("tied");
        navigator.vibrate?.(12);
      } else if (data.state) setState(data.state);
      else setError(data.error || "That didn't go through. Try once more.");
    } catch {
      setError("You seem to be offline. Try once more.");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    setReported(true);
    apiFetch("/api/report", { method: "POST", body: JSON.stringify({ token }) }).catch(() => {});
  }

  if (!view || state === "missing") {
    return (
      <div className="wm">
        <main className="wm-scr wm-friend">
          <div className="wm-pad">
            <p className="wm-kick">Warm Map</p>
            <h1>We couldn&apos;t find this lantern.</h1>
          </div>
          <div className="wm-foot2" style={{ marginTop: 24 }}>
            <Link className="wm-btn" href="/">
              Make yours
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const owner = view.ownerName;
  const city = view.city ?? "your city";
  const tied = state === "tied";
  const makeYours = `/?invitedBy=${view.mapSlug}&via=thanks`;
  const tellBack = whatsAppUrl(`I'm in your corner. Always was.${mapUrl ? ` ${mapUrl}` : ""}`);

  return (
    <div className="wm">
      <GlyphDefs />
      <main className={`wm-scr wm-friend${tied || state === "used" ? " wm-tied" : ""}`}>
        {tied ? (
          <div className="wm-pad" role="status">
            <p className="wm-kick">It&apos;s gold now</p>
            <h1>Tied at both ends.</h1>
            <p className="wm-asked">
              {owner} will see a gold lantern in {city}.
            </p>
          </div>
        ) : (
          <div className="wm-pad">
            <p className="wm-kick">Someone lit a lantern for you</p>
            <p className="wm-asked">{owner} was asked:</p>
            <h2 className="wm-q">{view.question}</h2>
            <h1>The answer was you.</h1>
          </div>
        )}

        <div className="wm-art" aria-hidden="true">
          <svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMax meet">
            <g fill="none" stroke="#6A5641" strokeWidth={1} opacity={0.35}>
              <path d="M-10 232Q195 180 400 232M-10 262Q195 214 400 262M70 300Q120 150 90 -10M300 300Q260 150 330 -10" />
            </g>
            <path d={PATH} fill="none" stroke="#B9741F" strokeWidth={2} />
            <path className="wm-back" d={PATH} pathLength={1} fill="none" stroke="#F2C230" strokeWidth={3} />
            <circle cx={316} cy={66} r={6} fill="#9C3324" stroke="#2E2219" strokeWidth={1.2} />
            <text x={366} y={44} textAnchor="end">
              {owner}, in {view.ownerHome}
            </text>
            <g transform="translate(118 196)">
              <g className="wm-live">
                <LanternGlyph state="lit" s={4.4} />
              </g>
              <g className="wm-goldg">
                <LanternGlyph state="gold" s={4.4} />
              </g>
            </g>
            <text x={118} y={294} textAnchor="middle">
              {friendName ? `${friendName}, in ${city}` : `you, in ${city}`}
            </text>
          </svg>
        </div>

        <div className="wm-foot2">
          {state === "ok" && (
            <>
              <button className="wm-btn" type="button" onClick={tie} disabled={busy}>
                Tie it back
              </button>
              <p className="wm-note">One tap. No sign-up. {owner} will see that you tied it.</p>
              {error && (
                <p className="wm-err" role="alert">
                  {error}
                </p>
              )}
              <div className="wm-rrow">
                {reported ? <span>Thank you. We&apos;ll look at it.</span> : <button type="button" onClick={report}>Not you? Report this link</button>}
                <span>warmmap.world</span>
              </div>
            </>
          )}
          {tied && (
            <>
              <a className="wm-btn" href={tellBack} target="_blank" rel="noopener noreferrer">
                Tell {owner} yourself
              </a>
              <a className="wm-btn two" href={makeYours}>
                Make yours
              </a>
              <p className="wm-note">Opens WhatsApp, so you can send it straight back to {owner}.</p>
            </>
          )}
          {state === "used" && (
            <>
              <p>This lantern has already been answered. You can still make your own map.</p>
              <a className="wm-btn" href={makeYours}>
                Make yours
              </a>
            </>
          )}
          {state === "expired" && (
            <>
              <p>This link has gone quiet. Ask {owner} for a new one, or make your own map.</p>
              <a className="wm-btn" href={makeYours}>
                Make yours
              </a>
            </>
          )}
          {state === "own" && (
            <>
              <p>This is your own lantern. It&apos;s waiting for someone else.</p>
              <a className="wm-btn two" href={`/m/${view.mapSlug}`}>
                Open my map
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
