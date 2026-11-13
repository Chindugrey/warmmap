"use client";

import { useState } from "react";

const CONSENT_KEY = "warmmap-consent";

function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === null;
  } catch {
    return false;
  }
}

export function ConsentBanner() {
  const [show, setShow] = useState(shouldShowBanner);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "yes");
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="consent" role="region" aria-label="Cookie consent">
      <div className="consent-inner">
        <p>
          Warm Map only stores the cities you choose and a count of visitors.
          Names stay on your device until a friend vouches. We don’t use
          third-party cookies.
        </p>
        <button type="button" className="btn" onClick={accept}>
          Got it
        </button>
      </div>
    </div>
  );
}
