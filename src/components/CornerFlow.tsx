"use client";

// The whole making of a map, on one card at a time:
// hero → home-city chips → questions (5 unlock the reveal, 12 complete it) →
// reveal (dusk, threads, warm, three cards; 3.4 s, tap to skip) → name at
// "Show me", which saves → "Your corner is glowing." and the three CTAs.
// Friends' names live only in this browser (localStorage) and in the
// WhatsApp messages the owner sends; the server never gets them.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Globe, LanternGlyph, type GlobeLantern } from "@/components/Globe";
import { LiveCounter } from "@/components/LiveCounter";
import { ThankSheet } from "@/components/ThankSheet";
import { ShareRow } from "@/components/ShareRow";
import { StoryPictureLink } from "@/components/StoryPicture";
import { CHAPTERS, QUESTIONS, QUESTION_COUNT, UNLOCK_AT } from "@/lib/questions";
import { citiesByName, countryOf, findCity, matchCities } from "@/lib/cities";
import { mapStats } from "@/lib/geo";
import { computeKind, KIND_LINES } from "@/lib/kinds";
import { compareKm } from "@/lib/compare";
import { nextQuestion, whatsAppUrl } from "@/lib/flow";
import { rewardLine } from "@/lib/reward";
import { apiFetch, ownerKeyFor, rememberOwnerKey } from "@/lib/device";

type Stage = "hero" | "home" | "ask" | "reveal";

interface Answer {
  q: number;
  name: string;
  city: string;
}

interface Carried {
  slug: string;
  ownerName: string;
  city: string;
  kept: boolean;
}

interface Draft {
  v: 2;
  home: string | null;
  answers: Answer[];
  skipped: number[];
  current: number;
  invitedBy: string | null;
  via: "cold" | "map" | "thanks";
  carried: Carried | null;
  saved: { slug: string; ownerName: string } | null;
}

const DRAFT_KEY = "wm:draft";
const HOME_CHIPS = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kochi"];
const HERO_SAMPLE: GlobeLantern[] = ["Kochi", "Mysuru", "Chennai", "Hyderabad", "Pune", "Delhi", "London", "Singapore"].map((city) => ({ city }));
const ROMAN = ["I", "II", "III"];
const REVEAL_MS = 3400;
const REWARD_MS = 1200;

const emptyDraft = (): Draft => ({ v: 2, home: null, answers: [], skipped: [], current: 0, invitedBy: null, via: "cold", carried: null, saved: null });

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return d && d.v === 2 ? (d as Draft) : null;
  } catch {
    return null;
  }
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
const track = (event: string, metadata?: object) =>
  apiFetch("/api/analytics", { method: "POST", body: JSON.stringify({ event, metadata }) }).catch(() => {});

export function CornerFlow({ below }: { below?: ReactNode }) {
  const [stage, setStage] = useState<Stage>("hero");
  const [d, setD] = useState<Draft>(emptyDraft);
  const [resume, setResume] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Restore a draft and read where this visit came from.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const invitedBy = q.get("invitedBy");
    const via = q.get("via") === "thanks" ? "thanks" : q.get("via") === "map" ? "map" : "cold";
    const saved = readDraft();
    queueMicrotask(() => {
      if (invitedBy && /^[a-z0-9]{6,32}$/i.test(invitedBy) && (!saved || saved.invitedBy !== invitedBy)) {
        const fresh = { ...emptyDraft(), invitedBy, via: via as Draft["via"] };
        setD(fresh);
        if (via === "thanks") {
          fetch(`/api/maps/${invitedBy}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((m) => m && setD((x) => ({ ...x, carried: { slug: invitedBy, ownerName: m.ownerName || "Someone", city: m.homeCity, kept: true } })))
            .catch(() => {});
        }
        if (saved && saved.answers.length > 0 && !saved.saved) setResume(saved);
      } else if (saved && (saved.answers.length > 0 || saved.saved)) {
        setResume(saved);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || stage === "hero") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [d, stage, loaded]);

  // Each new page moves focus to its heading (not on the first paint of the hero).
  useEffect(() => {
    if (stage === "hero" || stage === "ask") return;
    const h = document.querySelector<HTMLElement>(".wm main h1, .wm main h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [stage]);

  const start = () => {
    track("start", { via: d.via });
    setStage(d.home ? "ask" : "home");
  };

  const keepGoing = () => {
    if (!resume) return;
    setD(resume);
    setResume(null);
    setStage(resume.saved || resume.answers.length >= QUESTION_COUNT ? "reveal" : resume.home ? "ask" : "home");
  };

  const startAgain = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setResume(null);
    setD((x) => ({ ...emptyDraft(), invitedBy: x.invitedBy, via: x.via, carried: x.carried }));
    setStage("home");
  };

  if (stage === "hero") return <Hero onStart={start} resume={resume} onResume={keepGoing} onRestart={startAgain} carried={d.carried} below={below} />;
  if (stage === "home")
    return (
      <HomeScreen
        onPick={(home) => {
          setD((x) => ({ ...x, home }));
          setStage("ask");
        }}
      />
    );
  if (stage === "ask") return <AskScreen d={d} setD={setD} onReveal={() => setStage("reveal")} />;
  return <RevealScreen d={d} setD={setD} onKeepGoing={() => setStage("ask")} />;
}

/* ───────── hero (landing hero 1, the frontispiece) ───────── */

function Ornament() {
  return (
    <svg className="wm-orn" width="150" height="14" viewBox="0 0 150 14" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M4 7h54M92 7h54M75 2l5 5-5 5-5-5zM62 7q4-5 8 0M88 7q-4 5-8 0" />
    </svg>
  );
}

function Hero({
  onStart,
  resume,
  onResume,
  onRestart,
  carried,
  below,
}: {
  onStart: () => void;
  resume: Draft | null;
  onResume: () => void;
  onRestart: () => void;
  carried: Carried | null;
  below?: ReactNode;
}) {
  const n = resume ? resume.answers.length + (resume.carried?.kept ? 1 : 0) : 0;
  return (
    <div className="wm">
      <main className="wm-scr wm-hero">
        <div className="wm-top">
          <span className="wm-wm">Warm Map</span>
          <a href="#never">What we never do</a>
        </div>
        <p className="wm-kick">A small map of the people who have your back</p>
        <h1>Who&apos;s in your corner?</h1>
        <Ornament />
        <div className="wm-mapw">
          <Globe homeCity="Bengaluru" lanterns={HERO_SAMPLE} labels={["London", "Delhi", "Singapore"]} homeLabel="" label="An example map: a globe with eight lanterns, each joined to home by a thread." />
        </div>
        <LiveCounter />
        <p className="wm-lead">
          {carried
            ? `${carried.ownerName} lit a lantern for you. Your map starts with one already lit, pointing back.`
            : "Answer a few small questions with a name and a city. Each one lights a lantern. In three minutes, you'll see how far your warmth reaches."}
        </p>
        <div className="wm-cta">
          {resume ? (
            <>
              <p className="wm-lead" style={{ marginBottom: 12 }}>
                {resume.saved ? "Welcome back. Your map is saved." : `Welcome back. ${plural(n, "lantern is", "lanterns are")} still glowing. Keep going?`}
              </p>
              <button className="wm-btn" type="button" onClick={onResume}>
                {resume.saved ? "Open my map" : "Keep going"}
              </button>
              <button className="wm-lnk" type="button" onClick={onRestart} style={{ marginTop: 6 }}>
                Start a new map
              </button>
            </>
          ) : (
            <button className="wm-btn" type="button" onClick={onStart}>
              Light my first lantern
            </button>
          )}
          <p className="wm-note">No sign-up. Your friends&apos; names stay on your device.</p>
        </div>
      </main>
      {below}
    </div>
  );
}

/* ───────── home city ───────── */

const THE = new Set(["USA", "UK", "UAE", "Netherlands", "Philippines", "Maldives"]);
const withThe = (c: string) => (THE.has(c) ? `the ${c}` : c);

function HomeScreen({ onPick }: { onPick: (city: string) => void }) {
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string>("Bengaluru");
  const matches = text.trim() ? matchCities(text, 6) : [];
  return (
    <div className="wm">
      <main className="wm-scr wm-ask">
        <div className="wm-mapw">
          <Globe homeCity={preview} lanterns={[]} homeLabel={preview} motion="still" />
        </div>
        <div className="wm-card">
          <h2>Where&apos;s home?</h2>
          <div className="wm-chips">
            {HOME_CHIPS.map((c) => (
              <button key={c} className="wm-chip" type="button" onClick={() => onPick(c)} onPointerEnter={() => setPreview(c)} onFocus={() => setPreview(c)}>
                {c}
              </button>
            ))}
            <button className={`wm-chip${other ? " pri" : ""}`} type="button" onClick={() => setOther(true)} aria-expanded={other}>
              Other
            </button>
          </div>
          {other && (
            <>
              <label className="wm-fld">
                <span>Your city</span>
                <input
                  autoFocus
                  value={text}
                  autoComplete="off"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const c = findCity(text);
                      if (c) onPick(c.name);
                    }
                  }}
                  placeholder="Start typing"
                />
              </label>
              <div className="wm-chips small">
                {matches.map((c) => (
                  <button key={c} className="wm-chip" type="button" onClick={() => onPick(c)}>
                    {c}
                  </button>
                ))}
              </div>
              {countryOf(text) && <p className="wm-hint">{`Which city in ${withThe(countryOf(text)!)}?`}</p>}
              {text.trim().length > 2 && matches.length === 0 && (
                <p className="wm-hint">We couldn&apos;t place that. Pick the nearest big city above.</p>
              )}
            </>
          )}
          <p className="wm-note">Your home is the centre of your map.</p>
        </div>
      </main>
    </div>
  );
}

/* ───────── a question ───────── */

/**
 * The on-screen keyboard. iOS keeps the layout viewport at full height and
 * only shrinks (and pans) the visual viewport, so the page is laid out from
 * visualViewport: --vvh is its height, --vvt how far it has panned. While the
 * keyboard is open the question screen is pinned to exactly that window
 * (see .wm-kbd in storybook.css), so nothing jumps and the card sits right
 * above the keys.
 */
function useKeyboard(ref: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    // Compare with the tallest height seen: some browsers shrink innerHeight
    // with the keyboard too, others only the visual viewport.
    let tallest = Math.max(window.innerHeight, vv.height);
    const onRotate = () => (tallest = Math.max(window.innerHeight, vv.height));
    const sync = () => {
      tallest = Math.max(tallest, vv.height);
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vvt", `${Math.round(vv.offsetTop)}px`);
      setOpen(vv.height < tallest * 0.78);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", onRotate);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvt");
    };
  }, [ref]);
  return open;
}

function ProgressLanterns({ answered }: { answered: Set<number> }) {
  return (
    <div className="wm-prog" role="img" aria-label={`${answered.size} of ${QUESTION_COUNT} lanterns lit`}>
      {QUESTIONS.map((_, i) => (
        <svg key={i} viewBox="-9 -15 18 24" aria-hidden="true">
          <LanternGlyph state={answered.has(i) ? "lit" : "off"} />
        </svg>
      ))}
    </div>
  );
}

function lanternsOf(d: Draft, gold: number[] = []): GlobeLantern[] {
  const out: GlobeLantern[] = [];
  if (d.carried?.kept) out.push({ city: d.carried.city });
  d.answers.forEach((a) => out.push({ city: a.city, gold: gold.includes(a.q) }));
  return out;
}

function AskScreen({ d, setD, onReveal }: { d: Draft; setD: (f: (x: Draft) => Draft) => void; onReveal: () => void }) {
  const home = d.home ?? "Bengaluru";
  const answered = useMemo(() => new Set(d.answers.map((a) => a.q)), [d.answers]);
  const [name, setName] = useState("");
  const [cityText, setCityText] = useState("");
  const [cityPick, setCityPick] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [reward, setReward] = useState<{ line: string; key: number } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const lightRef = useRef<HTMLButtonElement>(null);
  const kbd = useKeyboard(mainRef);
  const current = answered.has(d.current) ? nextQuestion(answered, new Set(d.skipped), d.current) ?? d.current : d.current;
  const q = QUESTIONS[current];
  const unlocked = d.answers.length >= UNLOCK_AT;
  const recent = [...new Set(d.answers.map((a) => a.city).reverse())].slice(0, 3);
  const suggestions = cityText.trim() && !cityPick ? matchCities(cityText, 4, home) : [];

  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) nameRef.current?.focus();
  }, [current]);

  // Saved maps keep themselves up to date as lanterns are added.
  const patchSaved = useCallback(
    (next: Draft) => {
      if (!next.saved) return;
      const slug = next.saved.slug;
      const counts = new Map<string, number>();
      next.answers.forEach((a) => counts.set(a.name.toLowerCase(), (counts.get(a.name.toLowerCase()) ?? 0) + 1));
      apiFetch(`/api/maps/${slug}`, {
        method: "PATCH",
        ownerKey: ownerKeyFor(slug),
        body: JSON.stringify({
          entries: [
            ...(next.carried?.kept ? [{ city: next.carried.city, carried: true }] : []),
            ...next.answers.map((a) => ({ city: a.city, questionIndex: a.q })),
          ],
          repeatMax: Math.max(1, ...counts.values()),
        }),
      }).catch(() => {});
      try {
        localStorage.setItem(`wm:names:${slug}`, JSON.stringify(next.answers.map((a) => ({ questionIndex: a.q, name: a.name, city: a.city }))));
      } catch {}
    },
    []
  );

  function advance(next: Draft, line: string) {
    const after = nextQuestion(new Set(next.answers.map((a) => a.q)), new Set(next.skipped), current);
    setReward({ line, key: Date.now() });
    setAnimKey((k) => k + 1);
    setD(() => ({ ...next, current: after ?? current }));
    if (after === null) setTimeout(onReveal, reduced() ? 0 : REWARD_MS);
  }

  function lightIt() {
    setHint(null);
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) {
      nameRef.current?.focus();
      return;
    }
    const city = cityPick ? citiesByName[cityPick] : findCity(cityText);
    if (!city) {
      const country = countryOf(cityText);
      const near = matchCities(cityText, 3, home);
      setHint(
        country ? `Which city in ${withThe(country)}? Tap one.`
        : near.length ? `Not sure of that one. Did you mean ${near.join(", ")}?`
        : "We couldn't place that. Pick the nearest big city."
      );
      cityRef.current?.focus();
      return;
    }
    const prev = d.answers;
    const ans: Answer = { q: current, name: n.slice(0, 24), city: city.name };
    const next: Draft = { ...d, answers: [...prev, ans], skipped: d.skipped.filter((s) => s !== current) };
    const line = rewardLine({
      count: next.answers.length,
      questionIndex: current,
      city: city.name,
      name: n,
      homeCity: home,
      prevCities: prev.map((a) => a.city),
      prevNames: prev.map((a) => a.name.toLowerCase()),
    });
    track("lantern", { n: next.answers.length });
    setName("");
    setCityText("");
    setCityPick(null);
    advance(next, line);
    patchSaved(next);
  }

  function skip() {
    const next: Draft = { ...d, skipped: [...new Set([...d.skipped, current])] };
    advance(next, rewardLine({ count: d.answers.length, questionIndex: current, city: "", name: "", homeCity: home, prevCities: [], prevNames: [], skipped: true }));
  }

  const lanterns = lanternsOf(d);
  const newest = d.answers[d.answers.length - 1]?.city ?? (d.carried?.kept ? d.carried.city : undefined);

  return (
    <div className="wm">
      <main className={`wm-scr wm-ask${kbd ? " wm-kbd" : ""}`} ref={mainRef}>
        <ProgressLanterns answered={answered} />
        <div className="wm-mapw">
          <Globe key={animKey} homeCity={home} lanterns={lanterns} labels={newest ? [newest] : "none"} motion="last" scale={1.4} />
        </div>
        <p className={`wm-reward${reward ? " on" : ""}`} key={reward?.key ?? 0} aria-live="polite">
          {reward?.line ?? ""}
        </p>
        {d.carried && d.answers.length === 0 && (
          <div className="wm-carried">
            {d.carried.kept ? (
              <>
                <b>Your first lantern is already lit.</b> {d.carried.ownerName}, in {d.carried.city}. It points back.{" "}
                <button className="wm-lnk" type="button" onClick={() => setD((x) => ({ ...x, carried: x.carried && { ...x.carried, kept: false } }))}>
                  Take this one off
                </button>
              </>
            ) : (
              <>
                Taken off. Your map still remembers who brought you here.{" "}
                <button className="wm-lnk" type="button" onClick={() => setD((x) => ({ ...x, carried: x.carried && { ...x.carried, kept: true } }))}>
                  Put it back
                </button>
              </>
            )}
          </div>
        )}
        <form
          className="wm-card"
          onSubmit={(e) => {
            e.preventDefault();
            lightIt();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") skip();
          }}
        >
          <p className="wm-chap">
            Chapter {ROMAN[q.chapter - 1]} · {CHAPTERS[q.chapter]}
          </p>
          <h2 id="wm-q">{q.text}</h2>
          <div className="wm-flds">
            <label className="wm-fld">
              <span>First name</span>
              <input
                ref={nameRef}
                value={name}
                maxLength={24}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                enterKeyHint="next"
                aria-describedby="wm-q"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    cityRef.current?.focus();
                  }
                }}
              />
            </label>
            <label className="wm-fld">
              <span>City</span>
              <input
                ref={cityRef}
                value={cityText}
                autoComplete="off"
                enterKeyHint="go"
                onChange={(e) => {
                  setCityText(e.target.value);
                  setCityPick(null);
                  setHint(null);
                }}
              />
            </label>
          </div>
          <div className="wm-chips small" aria-label="Cities">
            {(suggestions.length ? suggestions : cityPick ? [] : [home, ...recent.filter((c) => c !== home)].slice(0, 4)).map((c, i) => (
              <button
                key={c}
                type="button"
                className="wm-chip"
                onClick={() => {
                  setCityPick(c);
                  setCityText(c);
                  setHint(null);
                }}
              >
                {!suggestions.length && i === 0 && c === home ? "Same as me" : c}
              </button>
            ))}
          </div>
          {hint && (
            <p className="wm-hint" role="status">
              {hint}
            </p>
          )}
          <button className="wm-btn" type="submit" ref={lightRef}>
            Light it
          </button>
          <p className="wm-note">This name stays on your device.</p>
          <div className="wm-row" style={{ justifyContent: "space-between" }}>
            <button className="wm-lnk" type="button" onClick={skip}>
              Skip this one
            </button>
            {unlocked && (
              <button className="wm-lnk" type="button" onClick={onReveal}>
                See my map
              </button>
            )}
          </div>
          {!unlocked && (
            <p className="wm-hint">
              {UNLOCK_AT - d.answers.length} more {UNLOCK_AT - d.answers.length === 1 ? "lantern unlocks" : "lanterns unlock"} your map.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

/* ───────── the reveal ───────── */

function RevealScreen({ d, setD, onKeepGoing }: { d: Draft; setD: (f: (x: Draft) => Draft) => void; onKeepGoing: () => void }) {
  const home = d.home ?? "Bengaluru";
  const lanterns = lanternsOf(d);
  const [playing, setPlaying] = useState(true);
  const [ownerName, setOwnerName] = useState(d.saved?.ownerName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [keeper, setKeeper] = useState<string | null>(null);

  useEffect(() => {
    track("reveal", { n: lanterns.length });
    if (reduced()) {
      queueMicrotask(() => setPlaying(false));
      return;
    }
    const t = setTimeout(() => setPlaying(false), REVEAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = mapStats(lanterns, home);
  const counts = new Map<string, number>();
  d.answers.forEach((a) => counts.set(a.name.toLowerCase(), (counts.get(a.name.toLowerCase()) ?? 0) + 1));
  const repeatMax = Math.max(1, ...counts.values());
  const kind = computeKind({ homeCity: home, lanterns, repeatMax });
  const cmp = compareKm(stats.km);
  const kindTitle = kind.kind ? KIND_LINES[kind.kind].title : null;
  const saved = d.saved;
  const url = saved ? `${window.location.origin}/m/${saved.slug}` : "";

  async function showMe() {
    const n = ownerName.trim();
    if (!n) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/maps", {
        method: "POST",
        body: JSON.stringify({
          homeCity: home,
          ownerName: n,
          entries: [
            ...(d.carried?.kept ? [{ city: d.carried.city, carried: true }] : []),
            ...d.answers.map((a) => ({ city: a.city, questionIndex: a.q })),
          ],
          repeatMax,
          ...(d.invitedBy ? { invitedBy: d.invitedBy, via: d.via } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't save your map. Try once more.");
      rememberOwnerKey(data.id, data.ownerKey);
      try {
        localStorage.setItem(`wm:names:${data.id}`, JSON.stringify(d.answers.map((a) => ({ questionIndex: a.q, name: a.name, city: a.city }))));
      } catch {}
      setKeeper(`${window.location.origin}/m/${data.id}#k=${data.ownerKey}`);
      setD((x) => ({ ...x, saved: { slug: data.id, ownerName: n } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wm">
      <main
        className={`wm-scr wm-reveal ${playing ? "wm-play" : "wm-done"}`}
        onClick={() => playing && setPlaying(false)}
        aria-busy={playing}
      >
        <p className="wm-skip" aria-hidden="true">
          Tap to skip
        </p>
        <div className="wm-mapw">
          <Globe homeCity={home} lanterns={lanterns} motion="reveal" homeLabel={home} />
        </div>
        <div className="wm-txt">
          <h1 className="wm-here">{saved ? "Your corner is glowing." : "Here's who's in your corner."}</h1>
          <div className="wm-c3">
            <div className="wm-fc">
              <b>{lanterns.length}</b>
              <small>{lanterns.length === 1 ? "person" : "people"}</small>
              <i>
                {plural(stats.cities, "city", "cities")} · {plural(stats.countries, "country", "countries")}
              </i>
            </div>
            <div className="wm-fc">
              <b>{stats.km.toLocaleString("en-IN")}</b>
              <small>km of thread</small>
              {cmp && <i>{cmp.short}</i>}
            </div>
            <div className="wm-fc k">
              <b>{kindTitle ?? "Your map"}</b>
              <small>{kindTitle ? "your kind of map" : "one of a kind"}</small>
            </div>
          </div>
          {kind.kind && <p className="wm-kindline">{KIND_LINES[kind.kind].line}</p>}
          {kind.because && <p className="wm-bec">{kind.because}</p>}

          {!saved ? (
            <>
              <div className="wm-sign">
                <label htmlFor="wm-owner">Whose map is this?</label>
                <input
                  id="wm-owner"
                  value={ownerName}
                  maxLength={24}
                  autoComplete="given-name"
                  enterKeyHint="go"
                  onChange={(e) => setOwnerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && showMe()}
                />
              </div>
              <div className="wm-ctas">
                <button className="wm-btn" type="button" disabled={!ownerName.trim() || saving} onClick={showMe}>
                  {saving ? "Saving…" : "Show me"}
                </button>
                <p className="wm-note" style={{ textAlign: "center" }}>
                  Showing your map saves it: cities and your first name, never your friends&apos; names.
                </p>
                {error && (
                  <p className="wm-err" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="wm-ctas">
              <button className="wm-btn" type="button" onClick={() => setSheet(true)}>
                Tell them on WhatsApp
              </button>
              <ShareRow url={url} />
              <StoryPictureLink slug={saved.slug} />
              <LiveCounter />
              {keeper && (
                <p className="wm-keeper">
                  Keep your key. It&apos;s how you change or delete this map from another phone.{" "}
                  <a href={whatsAppUrl(`My Warm Map key. Keep it to yourself: ${keeper}`)} target="_blank" rel="noopener noreferrer">
                    Send it to myself on WhatsApp
                  </a>
                </p>
              )}
              {d.answers.length < QUESTION_COUNT && (
                <p className="wm-hint">
                  {d.answers.length} of {QUESTION_COUNT} lanterns lit. You can add more anytime.{" "}
                  <button className="wm-lnk" type="button" onClick={onKeepGoing}>
                    Light the next one
                  </button>
                </p>
              )}
              <a className="wm-lnk" href={`/m/${saved.slug}`}>
                Open my map
              </a>
            </div>
          )}
        </div>
      </main>
      {sheet && saved && (
        <ThankSheet slug={saved.slug} people={d.answers.map((a) => ({ questionIndex: a.q, name: a.name, city: a.city }))} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}
