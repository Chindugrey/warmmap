"use client";

import { useState } from "react";
import { trackShare } from "@/lib/track-share";
import { linkedInShareUrl } from "@/lib/flow";

/** Secondary "Share on LinkedIn" and tertiary "Copy link", both with the person's own map link. */
export function ShareRow({ url, slug, onLinkedIn }: { url: string; slug: string; onLinkedIn?: () => void }) {
  const track = (channel: string) => trackShare(channel, slug);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${url}?s=cp`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = `${url}?s=cp`;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    track("copy");
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="wm-r2">
      {onLinkedIn ? (
        <button className="wm-btn two" type="button" onClick={onLinkedIn}>
          Share on LinkedIn
        </button>
      ) : (
        <a className="wm-btn two" href={linkedInShareUrl(`${url}?s=li`)} target="_blank" rel="noopener noreferrer" onClick={() => track("linkedin")}>
          Share on LinkedIn
        </a>
      )}
      <button className="wm-lnk" type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
