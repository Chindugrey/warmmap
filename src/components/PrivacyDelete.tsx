"use client";
// On /privacy#delete: if this browser holds a keeper key, link straight to that map's owner view,
// where "Delete my map" (with its confirmation) lives. Reads storage; sends nothing.
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const readSlugs = () => {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith("wm:key:")).map((k) => k.slice(7)).sort().join(",");
  } catch {
    return "";
  }
};

export function PrivacyDelete() {
  const slugs = useSyncExternalStore(noSubscribe, readSlugs, () => "").split(",").filter(Boolean);
  if (!slugs.length) return null;
  return (
    <p>
      {slugs.map((s, i) => (
        <a key={s} className="wm-btn two" href={`/m/${s}`} data-testid="delete-my-map-link" style={{ marginRight: 8, marginTop: i ? 8 : 0 }}>
          Open my map to delete it{slugs.length > 1 ? ` (${i + 1} of ${slugs.length})` : ""}
        </a>
      ))}
    </p>
  );
}
