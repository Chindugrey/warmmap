"use client";

import { useEffect, useState } from "react";

export function FinalCTA() {
  const [hasMap, setHasMap] = useState(false);

  useEffect(() => {
    try {
      const draft = localStorage.getItem("warmmap-draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        setHasMap((parsed.entries?.length || 0) > 0);
      }
    } catch {
      // ignore
    }
  }, []);

  async function shareMap() {
    const url = window.location.href;
    const text = "I just made my Warm Map. Who's in your corner?";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Warm Map", text, url });
      } catch {
        // cancelled
      }
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
    }
  }

  return (
    <section className="page chapter final-cta">
      <h2>{hasMap ? "Your corner is lit" : "Missed Warm Map?"}</h2>
      <p className="quiet">
        {hasMap
          ? "Tell the people you named. One share is worth a hundred campaigns."
          : "Take two minutes. Name the people who'd pick up."}
      </p>
      <div className="final-actions">
        {hasMap ? (
          <button className="btn" type="button" onClick={shareMap}>
            Share my Warm Map
          </button>
        ) : (
          <a className="btn" href="#corner">
            Make my Warm Map
          </a>
        )}
        <a className="btn ghost" href="#corner">
          {hasMap ? "Add another lantern" : "Light my corner"}
        </a>
      </div>
    </section>
  );
}
