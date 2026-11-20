"use client";

import { useEffect, useRef, useState } from "react";
import { trackShare } from "@/lib/track-share";

/** Fetches the 9:16 Status/Story picture once, so a later tap can share it straight away. */
export function useStoryFile(slug: string | null) {
  const file = useRef<File | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    fetch(`/api/og?id=${encodeURIComponent(slug)}&f=story`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) file.current = new File([b], "warm-map-story.png", { type: "image/png" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);
  return file;
}

/** Share the picture through the phone's own sheet when it can; returns false when it can't. */
export async function sharePicture(file: File | null, text?: string, url?: string): Promise<boolean> {
  if (!file || !navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], ...(text ? { text } : {}), ...(url ? { url } : {}) });
  } catch {
    /* cancelled is still handled */
  }
  return true;
}

/**
 * "Save the picture for Status and Story": the phone's share sheet with the
 * 1080x1920 picture where it can (WhatsApp Status, Instagram Story); else a
 * plain link to the picture, because in-app browsers drop generated downloads.
 */
export function StoryPictureLink({ slug }: { slug: string }) {
  const file = useStoryFile(slug);
  const [busy, setBusy] = useState(false);
  const href = `/api/og?id=${encodeURIComponent(slug)}&f=story&dl=1`;
  return (
    <a
      className="wm-lnk"
      href={href}
      onClick={async (e) => {
        if (busy || !file.current || !navigator.canShare?.({ files: [file.current] })) return; // plain link
        e.preventDefault();
        setBusy(true);
        await sharePicture(file.current);
        setBusy(false);
        trackShare("story", slug);
      }}
    >
      Save the picture for Status and Story
    </a>
  );
}
