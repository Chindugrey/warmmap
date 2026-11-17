"use client";

import { useEffect, useState } from "react";
import { apiFetch, ownerKeyFor } from "@/lib/device";
import { prepareThank, type PreparedThank } from "@/lib/lantern-token";
import { thankOrderFor, thankMessage, whatsAppUrl } from "@/lib/flow";
import { questionFor } from "@/lib/questions";

export interface Named {
  questionIndex: number;
  name: string;
  city: string;
}

interface Props {
  slug: string;
  questionSet: number;
  people: Named[]; // names come from this device only
  goldQuestions?: number[];
  onClose: () => void;
}

/**
 * "Tell them on WhatsApp": one lantern, one person. The phone makes the link,
 * tells the server only its hash and the lantern, and opens the owner's own
 * WhatsApp in the same tap. We never send anything.
 */
export function ThankSheet({ slug, questionSet, people, goldQuestions = [], onClose }: Props) {
  const rows = thankOrderFor(questionSet).map((q) => people.find((p) => p.questionIndex === q)).filter((p): p is Named => !!p);
  const [open, setOpen] = useState<number>(rows.find((r) => !goldQuestions.includes(r.questionIndex))?.questionIndex ?? -1);
  const [texts, setTexts] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.questionIndex, thankMessage(r.name, "").trim()]))
  );
  const [sent, setSent] = useState<Record<number, boolean>>({});
  // The link is made on this phone as soon as a row opens, so the message can be shown with the real short link.
  const [links, setLinks] = useState<Record<number, PreparedThank>>({});
  useEffect(() => {
    const p = rows.find((r) => r.questionIndex === open);
    if (!p || links[p.questionIndex]) return;
    prepareThank({ base: window.location.origin, mapId: slug, entryIndex: p.questionIndex, friendName: p.name, channel: "wa" }).then((t) =>
      setLinks((l) => (l[p.questionIndex] ? l : { ...l, [p.questionIndex]: t }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [error, setError] = useState<string | null>(null);

  async function send(p: Named) {
    setError(null);
    const win = window.open("", "_blank"); // in the same tap, so the browser allows it
    try {
      const t = links[p.questionIndex] ?? (await prepareThank({ base: window.location.origin, mapId: slug, entryIndex: p.questionIndex, friendName: p.name, channel: "wa" }));
      const res = await apiFetch("/api/thanks", { method: "POST", ownerKey: ownerKeyFor(slug), body: JSON.stringify(t.body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "That didn't go through. Try once more.");
      const wa = whatsAppUrl(`${texts[p.questionIndex]} ${t.url}`);
      if (win) win.location.href = wa;
      else window.location.assign(wa);
      setSent((s) => ({ ...s, [p.questionIndex]: true }));
      apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "share", metadata: { channel: "whatsapp" } }) }).catch(() => {});
    } catch (e) {
      win?.close();
      setError((e as Error).message);
    }
  }

  return (
    <div className="wm-sheet" role="dialog" aria-modal="true" aria-labelledby="wm-thank-h" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="in">
        <div className="wm-row" style={{ justifyContent: "space-between" }}>
          <h2 id="wm-thank-h">Five people. Two minutes.</h2>
          <button className="wm-lnk" type="button" onClick={onClose}>Close</button>
        </div>
        <p className="wm-note">They&apos;ll remember it longer than you think.</p>
        {rows.length === 0 && <p className="wm-note" style={{ marginTop: 12 }}>Names stay on the phone you made this map on. Open it there to tell them.</p>}
        {rows.map((p) => {
          const gold = goldQuestions.includes(p.questionIndex);
          return (
            <div className="wm-thank" key={p.questionIndex}>
              <button className="wm-lnk" type="button" style={{ justifyContent: "space-between", textDecoration: "none" }} onClick={() => setOpen(p.questionIndex)} aria-expanded={open === p.questionIndex}>
                <b style={{ fontFamily: "var(--fd)", fontWeight: 400, fontSize: 22 }}>{p.name}</b>
                <span className="wm-kick">{gold ? "tied, gold" : sent[p.questionIndex] ? "sent" : p.city}</span>
              </button>
              {open === p.questionIndex && !gold && (
                <>
                  <p className="q">{questionFor(questionSet, p.questionIndex)}</p>
                  <label className="wm-kick" htmlFor={`wm-msg-${p.questionIndex}`}>Your message</label>
                  <textarea
                    id={`wm-msg-${p.questionIndex}`}
                    value={texts[p.questionIndex]}
                    maxLength={600}
                    onChange={(e) => setTexts((t) => ({ ...t, [p.questionIndex]: e.target.value }))}
                  />
                  {links[p.questionIndex] && (
                    <p className="wm-kick wm-sends" aria-label="What will be sent">
                      {texts[p.questionIndex]} {links[p.questionIndex].url}
                    </p>
                  )}
                  <button className="wm-btn" type="button" onClick={() => send(p)}>
                    {sent[p.questionIndex] ? "Send again on WhatsApp" : "Send on WhatsApp"}
                  </button>
                  <p className="wm-note">Opens your WhatsApp with this ready. You pick the chat and press send. A private link goes with it; it knows the question, not the name.</p>
                </>
              )}
            </div>
          );
        })}
        {error && <p className="wm-err" role="alert">{error}</p>}
        <p className="wm-kick" style={{ textAlign: "center", marginTop: 12 }}>We never message anyone for you.</p>
      </div>
    </div>
  );
}
