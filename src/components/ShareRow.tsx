"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/device";
import { linkedInShareUrl } from "@/lib/flow";

const track = (channel: string) =>
  apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "share", metadata: { channel } }) }).catch(() => {});

/** Secondary "Share on LinkedIn" and tertiary "Copy link", both with the person's own map link. */
export function ShareRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
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
      <a className="wm-btn two" href={linkedInShareUrl(url)} target="_blank" rel="noopener noreferrer" onClick={() => track("linkedin")}>
        Share on LinkedIn
      </a>
      <button className="wm-lnk" type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
