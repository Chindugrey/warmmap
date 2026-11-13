"use client";

import { useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import { findCity, citiesByName } from "@/lib/cities";
import { mapStats } from "@/lib/geo";
import { Globe } from "@/components/Globe";
import { ShareCard } from "@/components/ShareCard";
import { generateSharePicture } from "@/components/SharePicture";
import { CityAutocomplete } from "@/components/CityAutocomplete";

interface Entry {
  name: string;
  city: string;
  questionIndex: number;
}

interface Draft {
  ownerName: string;
  homeCity: string;
  entries: Entry[];
  currentQuestionIndex: number;
}

const DRAFT_KEY = "warmmap-draft";

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function WarmMapGame() {
  const draft = readDraft();

  const [ownerName, setOwnerName] = useState(() => draft?.ownerName ?? "");
  const [homeCityValue, setHomeCityValue] = useState(
    () => draft?.homeCity ?? "Bengaluru, India"
  );
  const [homeCityName, setHomeCityName] = useState(
    () => findCity(draft?.homeCity ?? "Bengaluru, India")?.name ?? "Bengaluru"
  );
  const [entries, setEntries] = useState<Entry[]>(() => draft?.entries ?? []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    Math.min(draft?.currentQuestionIndex ?? 0, questions.length)
  );

  const [name, setName] = useState("");
  const [cityValue, setCityValue] = useState("");
  const [cityHint, setCityHint] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy text");
  const [copyImgLabel, setCopyImgLabel] = useState("Copy picture");
  const [canNativeShare] = useState(() =>
    typeof navigator !== "undefined" && !!navigator.share
  );

  // Persist draft.
  useEffect(() => {
    const draft: Draft = {
      ownerName,
      homeCity: homeCityValue,
      entries,
      currentQuestionIndex,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [ownerName, homeCityValue, entries, currentQuestionIndex]);

  const stats = useMemo(
    () => mapStats(entries.map((e) => ({ city: e.city })), homeCityName),
    [entries, homeCityName]
  );

  function setHomeCity(name: string) {
    const city = citiesByName[name];
    if (!city) return;
    setHomeCityName(city.name);
    setHomeCityValue(`${city.name}, ${city.country}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCityHint("");
    const city = findCity(cityValue);
    if (!name.trim()) {
      document.getElementById("friend-name")?.focus();
      return;
    }
    if (!city) {
      setCityHint("We couldn't find that city. Try a nearby big city.");
      document.getElementById("friend-city")?.focus();
      return;
    }

    const entry: Entry = {
      name: name.trim(),
      city: city.name,
      questionIndex: Math.min(currentQuestionIndex, questions.length - 1),
    };

    if (editingIndex !== null) {
      setEntries((prev) =>
        prev.map((p, i) => (i === editingIndex ? entry : p))
      );
      setEditingIndex(null);
    } else {
      setEntries((prev) => [...prev, entry]);
      if (currentQuestionIndex < questions.length) {
        setCurrentQuestionIndex((i) => i + 1);
      }
    }

    setName("");
    setCityValue("");
    document.getElementById("friend-name")?.focus();
  }

  function skip() {
    if (currentQuestionIndex < questions.length) {
      setCurrentQuestionIndex((i) => i + 1);
    }
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setName("");
      setCityValue("");
    }
  }

  function editEntry(index: number) {
    const entry = entries[index];
    if (!entry) return;
    setName(entry.name);
    const city = citiesByName[entry.city];
    setCityValue(city ? `${city.name}, ${city.country}` : entry.city);
    setEditingIndex(index);
    document.getElementById("friend-name")?.focus();
  }

  function shareMessage() {
    return (
      "This is my Warm Map.\n" +
      `${plural(stats.people, "person", "people")} in my corner, ${plural(
        stats.cities,
        "city",
        "cities"
      )}, ${plural(stats.countries, "country", "countries")}, ${stats.km.toLocaleString(
        "en-IN"
      )} km of threads.\n` +
      "If you're on it, you know why. Thank you." +
      (ownerName.trim() ? `\n— ${ownerName.trim()}` : "") +
      "\n\nWho's in your corner? https://warmmap.world"
    );
  }

  async function openShare() {
    setShareOpen(true);
    try {
      const { dataUrl, blob } = await generateSharePicture({
        ownerName,
        homeCity: homeCityName,
        entries: entries.map((e) => ({ city: e.city })),
      });
      setShareImage(dataUrl);
      setShareBlob(blob);
    } catch (err) {
      console.error("Failed to generate share picture", err);
    }
  }

  function copyText() {
    const text = shareMessage();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyLabel("Copied");
        setTimeout(() => setCopyLabel("Copy text"), 1600);
      })
      .catch(() => setCopyLabel("Select the text"));
  }

  function copyPicture() {
    if (!shareBlob) {
      setCopyImgLabel("Save the picture instead");
      return;
    }
    if (!window.ClipboardItem) {
      setCopyImgLabel("Save the picture instead");
      return;
    }
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": shareBlob })])
      .then(() => {
        setCopyImgLabel("Picture copied");
        setTimeout(() => setCopyImgLabel("Copy picture"), 1600);
      })
      .catch(() => setCopyImgLabel("Save the picture instead"));
  }

  async function nativeShare() {
    const text = shareMessage();
    const files: File[] = [];
    if (shareBlob) {
      files.push(
        new File([shareBlob], "warm-map.png", { type: "image/png" })
      );
    }
    if (navigator.canShare && navigator.canShare({ files, text })) {
      try {
        await navigator.share({
          title: ownerName
            ? `${ownerName}'s Warm Map`
            : "My Warm Map",
          text,
          files,
        });
      } catch {
        // user cancelled
      }
    }
  }

  async function saveAndGetLink() {
    setSaving(true);
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeCity: homeCityName,
          ownerName: ownerName.trim() || undefined,
          entries: entries.map((e) => ({
            city: e.city,
            questionIndex: e.questionIndex,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      const slug = data.shortSlug || data.publicId;
      const link = `${window.location.origin}/m/${slug}`;
      setSavedLink(link);
    } catch (err) {
      console.error(err);
      alert("Could not save your Warm Map. The server may be unavailable.");
    } finally {
      setSaving(false);
    }
  }

  const doneQuestions = currentQuestionIndex >= questions.length;
  const questionLabel = doneQuestions
    ? "All twelve asked"
    : `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  const questionText = doneQuestions
    ? "Your corner is lit. Add another lantern if you'd like."
    : questions[currentQuestionIndex];

  return (
    <div className="game" id="corner">
      <div className="mobile-header mobile-only">
        <div className="pair">
          <div className="field">
            <label htmlFor="owner-name-mobile">Your first name</label>
            <input
              id="owner-name-mobile"
              type="text"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              placeholder="Arjun"
              maxLength={24}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
          <CityAutocomplete
            id="home-city-mobile"
            label="You live in"
            value={homeCityValue}
            placeholder="Start typing your city"
            onChange={setHomeCityValue}
            onSelectCity={setHomeCity}
          />
        </div>
      </div>

      <div className="mapcard-wrapper">
        <ShareCard
          ownerName={ownerName}
          stats={stats}
          globe={
            <Globe
              homeCity={homeCityName}
              entries={entries}
              width={520}
              height={520}
            />
          }
        />
      </div>

      <div className="question-card-wrapper card" aria-live="polite">
        <div className="desktop-only">
          <div className="pair">
            <div className="field">
              <label htmlFor="owner-name">Your first name</label>
              <input
                id="owner-name"
                type="text"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Arjun"
                maxLength={24}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
            <CityAutocomplete
              id="home-city"
              label="You live in"
              value={homeCityValue}
              placeholder="Start typing your city"
              onChange={setHomeCityValue}
              onSelectCity={setHomeCity}
            />
          </div>
        </div>

        <p className="qn">{questionLabel}</p>
        <p className="q">{questionText}</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="pair">
            <div className="field">
              <label htmlFor="friend-name">Their first name</label>
              <input
                id="friend-name"
                type="text"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Priya"
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <CityAutocomplete
              id="friend-city"
              label="Their city"
              value={cityValue}
              placeholder="Start typing a city"
              onChange={(v) => {
                setCityValue(v);
                setCityHint("");
              }}
              onSelectCity={() => setCityHint("")}
            />
          </div>
          <div className="row">
            <button className="btn" type="submit">
              {editingIndex !== null ? "Update lantern" : "Light a lantern"}
            </button>
            {!editingIndex && (
              <button className="btn ghost" type="button" onClick={skip}>
                Skip
              </button>
            )}
            {editingIndex !== null && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setName("");
                  setCityValue("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {cityHint && (
          <p className="note" role="status">
            {cityHint}
          </p>
        )}

        <p className="tally">
          {entries.length === 0
            ? "No lanterns yet. Your corner is waiting."
            : `${plural(entries.length, "lantern", "lanterns")} lit across ${plural(
                stats.cities,
                "city.",
                "cities."
              )}`}
        </p>

        {entries.length > 0 && (
          <ul className="games">
            {entries.map((entry, idx) => (
              <li key={idx}>
                <time>{citiesByName[entry.city]?.name ?? entry.city}</time>
                <span>
                  <b>{entry.name}</b> — {questions[entry.questionIndex]}
                </span>
                <span className="row" style={{ marginLeft: "auto" }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => editEntry(idx)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => removeEntry(idx)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="sharewrap">
          <button
            className="btn"
            type="button"
            disabled={entries.length === 0}
            onClick={openShare}
            aria-expanded={shareOpen}
          >
            Share my Warm Map
          </button>

          {shareOpen && (
            <div className="sharemenu">
              {shareImage ? (
                <img
                  src={shareImage}
                  alt="Your Warm Map as a share picture: globe, threads and numbers, with no names"
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: 12,
                    border: "1px solid #D6C39C",
                    background: "#FBF4E4",
                  }}
                />
              ) : (
                <p className="note">Generating picture…</p>
              )}
              <p className="note">
                Your friends&apos; names never appear in the shared picture.
                Long-press or right-click it to save, then add it to your post.
              </p>
              <p className="msg">{shareMessage()}</p>
              <div className="shareactions">
                <a
                  className="btn"
                  href={`https://wa.me/?text=${encodeURIComponent(
                    shareMessage()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="btn ghost"
                  href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
                    shareMessage()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
                <button className="btn ghost" type="button" onClick={copyText}>
                  {copyLabel}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={copyPicture}
                >
                  {copyImgLabel}
                </button>
              </div>
              {canNativeShare && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={nativeShare}
                  style={{ width: "100%" }}
                >
                  Share with your phone&apos;s apps
                </button>
              )}
              <p className="note">
                LinkedIn fills in the text on desktop. In the live app, the link
                itself shows this picture as its preview.
              </p>
            </div>
          )}
        </div>

        <button
          className="btn ghost"
          type="button"
          disabled={entries.length === 0 || saving}
          onClick={saveAndGetLink}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Save & get link"}
        </button>

        {savedLink && (
          <p className="note" role="status">
            Your link:{" "}
            <a href={savedLink} target="_blank" rel="noopener noreferrer">
              {savedLink}
            </a>
          </p>
        )}

        <p className="note">Names stay on this page. Nothing is saved until you choose to share.</p>
      </div>
    </div>
  );
}
