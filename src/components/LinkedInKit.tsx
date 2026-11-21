"use client";

// v2.1a LinkedIn kit (behind V21A): "Thank them in public". Names are OUT by default; the consent line comes first and
// the post with names, the copy / share buttons and the tag checklist exist only once it is ticked. Everything happens
// on this phone: the post is built here, copied or handed to the share sheet by the owner, and never sent to us.
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/device";
import { linkedInShareUrl } from "@/lib/flow";
import { sharePicture } from "@/components/StoryPicture";
import { KIT_COPY, LINKEDIN_COMPOSE_URL, findProfileUrl, linkedInPost, tagRows, type Friend } from "@/lib/v21a";

const track = (channel: string) =>
  apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event: "share", metadata: { channel } }) }).catch(() => {});

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

const isPhone = () => window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 900;

interface Props {
  slug: string;
  url: string; // the owner's map link, no ?s=
  friends: Friend[];
  cities: number;
  people: number; // the reveal's number, so the post says the same
  wish: string[]; // the 2027 list, already filtered to "add it to my post"
  onClose: () => void;
}

export function LinkedInKit({ slug, url, friends, cities, people, wish, onClose }: Props) {
  const [names, setNames] = useState(false);
  const [consent, setConsent] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [phone] = useState(isPhone);
  const rows = useMemo(() => tagRows(friends), [friends]);
  const [tagged, setTagged] = useState<number[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(`wm:li:${slug}`) ?? "[]");
      return Array.isArray(v) ? v.filter((i) => Number.isInteger(i)) : [];
    } catch {
      return [];
    }
  });
  // Names only ever reach the text after the consent line is ticked.
  const named = names && consent;
  const generated = useMemo(() => linkedInPost({ friends, cities, people, names: named, wish, url: `${url}?s=li` }), [friends, cities, people, named, wish, url]);
  const post = edited ?? generated;
  // The picture is fetched before the tap: Safari rejects share calls that wait on a network round trip.
  const file = useRef<File | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/og?id=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) file.current = new File([b], "warm-map-card.png", { type: "image/png" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  function pickNames(on: boolean) {
    setNames(on);
    if (!on) setConsent(false);
    setEdited(null);
    setStatus("");
  }
  function tick(on: boolean) {
    setConsent(on);
    setEdited(null);
  }
  function toggleTag(i: number) {
    const next = tagged.includes(i) ? tagged.filter((x) => x !== i) : [...tagged, i];
    setTagged(next);
    try {
      localStorage.setItem(`wm:li:${slug}`, JSON.stringify(next));
    } catch {}
  }
  async function justCopy() {
    await copyText(post);
    setStatus("Copied");
    track("copy");
  }
  async function shareToLinkedIn() {
    await copyText(post);
    const ok = await sharePicture(file.current);
    setStatus(ok ? "Post copied. Pick LinkedIn and paste it." : "Post copied. Open LinkedIn and paste it.");
    track("native");
  }
  async function openLinkedIn() {
    await copyText(post);
    window.open(LINKEDIN_COMPOSE_URL, "_blank", "noopener,noreferrer");
    setStatus("Post copied. Paste it in LinkedIn.");
    track("linkedin");
  }

  const gated = names && !consent;
  return (
    <div className="wm-sheet wm-kit" role="dialog" aria-modal="true" aria-labelledby="wm-kit-h" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="in">
        <div className="wm-row" style={{ justifyContent: "space-between" }}>
          <h2 id="wm-kit-h">{KIT_COPY.title}</h2>
          <button className="wm-lnk" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="wm-note">{KIT_COPY.assure}</p>

        <fieldset className="wm-seg">
          <legend className="wm-kick">Names in the post</legend>
          <label>
            <input type="radio" name="wm-kit-names" checked={!names} onChange={() => pickNames(false)} />
            {KIT_COPY.keepOut}
          </label>
          <label>
            <input type="radio" name="wm-kit-names" checked={names} onChange={() => pickNames(true)} />
            {KIT_COPY.byName}
          </label>
        </fieldset>
        {names && (
          <label className="wm-consent">
            <input type="checkbox" checked={consent} onChange={(e) => tick(e.target.checked)} />
            <span>{KIT_COPY.consent}</span>
          </label>
        )}

        {gated ? (
          <p className="wm-hint" style={{ textAlign: "left" }}>
            {KIT_COPY.tickFirst}
          </p>
        ) : (
          <>
            <label className="wm-kick" htmlFor="wm-kit-post">
              Your post (edit anything)
            </label>
            <textarea id="wm-kit-post" className="wm-kit-post" rows={named ? 10 : 7} value={post} onChange={(e) => setEdited(e.target.value)} />
            {phone ? (
              <>
                <button className="wm-btn" type="button" onClick={shareToLinkedIn}>
                  {KIT_COPY.share}
                </button>
                <p className="wm-hint" style={{ textAlign: "left" }}>
                  Copies your post, then opens your phone&apos;s share sheet with the picture. Pick LinkedIn and paste the post.
                </p>
                <button className="wm-lnk" type="button" onClick={justCopy} style={{ alignSelf: "flex-start" }}>
                  {KIT_COPY.justCopy}
                </button>
              </>
            ) : (
              <>
                <div className="wm-r2">
                  <button className="wm-btn" type="button" onClick={justCopy}>
                    {KIT_COPY.copyPost}
                  </button>
                  <button className="wm-btn two" type="button" onClick={openLinkedIn}>
                    {KIT_COPY.openLinkedIn}
                  </button>
                </div>
                <p className="wm-hint" style={{ textAlign: "left" }}>
                  Open LinkedIn copies the post and opens a new LinkedIn post in a new tab. Paste, add the picture if you like, then tag.
                </p>
              </>
            )}
            <p className="wm-hint" role="status" aria-live="polite" style={{ textAlign: "left" }}>
              {status}
            </p>
          </>
        )}

        <p className="wm-hint" style={{ textAlign: "left" }}>
          The picture is your map card: cities and numbers, no names. Your link already shows it on LinkedIn, so adding it is optional.{" "}
          <a href={`/api/og?id=${encodeURIComponent(slug)}&dl=1`}>Download the picture</a>
        </p>

        {named && rows.length > 0 && (
          <section aria-label="Tag checklist">
            <div className="wm-row" style={{ justifyContent: "space-between" }}>
              <h3>Tag checklist</h3>
              <b className="wm-kick" aria-live="polite">
                {tagged.filter((i) => i < rows.length).length} of {rows.length} tagged
              </b>
            </div>
            <p className="wm-howto">{KIT_COPY.howTag}</p>
            <ul className="wm-tags">
              {rows.map((r, i) => (
                <li key={r.key} className={tagged.includes(i) ? "wm-tag done" : "wm-tag"}>
                  <label>
                    <input type="checkbox" checked={tagged.includes(i)} onChange={() => toggleTag(i)} />
                    <span>
                      <b>{r.name}</b> · {r.city}
                    </span>
                  </label>
                  <a href={findProfileUrl(r.name, r.city)} target="_blank" rel="noopener noreferrer" aria-label={`Find ${r.name}'s profile on LinkedIn (opens a new tab)`}>
                    {KIT_COPY.find} ↗
                  </a>
                </li>
              ))}
            </ul>
            <p className="wm-hint" style={{ textAlign: "left" }}>
              “find profile” searches LinkedIn for the name and city, in your own LinkedIn. Only when you tap it.
            </p>
          </section>
        )}

        <a className="wm-lnk" href={linkedInShareUrl(`${url}?s=li`)} target="_blank" rel="noopener noreferrer" onClick={() => track("linkedin")}>
          Or just share the link
        </a>
      </div>
    </div>
  );
}
