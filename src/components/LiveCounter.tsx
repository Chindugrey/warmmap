"use client";

import { useEffect, useState } from "react";
import { LanternGlyph } from "@/components/Globe";

/** "1,204 lanterns lit so far": the exact count, shown only once past the floor. */
export function LiveCounter() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/counter")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.show && setN(d.lanterns))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (n === null) return <p className="wm-count" aria-hidden="true" />;
  return (
    <p className="wm-count">
      <svg viewBox="-9 -15 18 24" aria-hidden="true">
        <LanternGlyph state="lit" />
      </svg>
      {n.toLocaleString("en-IN")} lanterns lit so far
    </p>
  );
}
