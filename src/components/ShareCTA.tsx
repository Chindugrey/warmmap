"use client";

import { useState } from "react";

export function ShareCTA() {
  const [copied, setCopied] = useState(false);
  const url = "https://warmmap.world";
  const text =
    "Who's in your corner? I just lit my Warm Map. https://warmmap.world";

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Warm Map",
          text,
          url,
        });
      } catch {
        // user cancelled
      }
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <section className="page chapter share-cta">
      <h2>Share the warmth</h2>
      <p className="quiet">
        If this made you think of someone, tell them. Warmth spreads when we
        name it.
      </p>
      <div className="share-actions-row">
        <a
          className="btn"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <a
          className="btn ghost"
          href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
            text
          )}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button className="btn ghost" type="button" onClick={nativeShare}>
            Share
          </button>
        )}
        <button className="btn ghost" type="button" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
