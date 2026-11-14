"use client";

import { useId, useMemo } from "react";
import { CENTER, SPHERE_R, layoutGlobe, threadPath } from "@/lib/globe-layout";

export const GOLD = "#F2C230";
const AMBER = "#E8A84A";
const HAND = "M-5-8h10l1.6 3v7.6L5 5.6H-5l-1.6-3V-5z";

export interface GlobeLantern {
  city: string;
  /** Tied back: gold, 1.5x larger, with a ring, so it never relies on colour alone. */
  gold?: boolean;
}

interface GlobeProps {
  homeCity: string;
  lanterns: GlobeLantern[];
  /** Which lantern cities get a written label. */
  labels?: "all" | "none" | string[];
  homeLabel?: string;
  /** still: no motion. live: halos breathe. reveal: threads draw and lanterns warm in turn. last: only the newest one. */
  motion?: "still" | "live" | "reveal" | "last";
  /** Glyph scale (the question screen uses larger lanterns). */
  scale?: number;
  /** Zoom the camera on one lantern (the owner's return). */
  focus?: number;
  /** Lantern that turns gold on screen. */
  turn?: number;
  label?: string;
  className?: string;
}

export function LanternGlyph({ state, i = 0, s = 1 }: { state: "lit" | "off" | "gold"; i?: number; s?: number }) {
  const off = state === "off", g = state === "gold";
  return (
    <g transform={`scale(${s})`}>
      <g className="wm-ln" style={{ ["--i" as string]: i }}>
        {!off && <circle className="wm-halo" style={{ ["--i" as string]: i }} r={g ? 30 : 21} fill={g ? "url(#wm-gG)" : "url(#wm-gA)"} />}
        {g && (
          <>
            <circle r={15.5} fill="none" stroke={GOLD} strokeWidth={2.6} />
            <circle r={17.4} fill="none" stroke="#2E2219" strokeWidth={0.8} opacity={0.85} />
          </>
        )}
        <path d="M0-13.5a2.6 2.6 0 0 1 0 5.2M-3.6-8.3h7.2" fill="none" stroke="#2E2219" strokeWidth={1.1} />
        <path d={HAND} fill={off ? "#E6D6B5" : g ? GOLD : AMBER} stroke="#2E2219" strokeWidth={1.15} strokeLinejoin="round" />
        <path d="M-6 6.6h12" stroke="#2E2219" strokeWidth={1.6} strokeLinecap="round" />
        {!off && <path d="M0-4.6v6.6" stroke="#2E2219" strokeWidth={0.8} opacity={0.45} />}
      </g>
    </g>
  );
}

/** Shared gradients; render once per page that shows lantern glyphs outside a globe. */
export function GlyphDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <radialGradient id="wm-gA"><stop offset="0%" stopColor={AMBER} stopOpacity={0.75} /><stop offset="100%" stopColor={AMBER} stopOpacity={0} /></radialGradient>
        <radialGradient id="wm-gG"><stop offset="0%" stopColor={GOLD} stopOpacity={0.9} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></radialGradient>
      </defs>
    </svg>
  );
}

const GRAT = "M300 40V560M40 300H560M60 190Q300 160 540 190M60 410Q300 440 540 410M110 110Q300 90 490 110M110 490Q300 510 490 490";

interface Box { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

export function Globe({
  homeCity,
  lanterns,
  labels = "all",
  homeLabel = "you",
  motion = "live",
  scale = 1,
  focus,
  turn,
  label,
  className = "",
}: GlobeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { points } = useMemo(() => layoutGlobe(homeCity, lanterns.map((l) => l.city)), [homeCity, lanterns]);

  // City labels with collision handling: try the outer side, then the inner, above, below.
  const placedLabels = useMemo(() => {
    const want = (c: string) => labels === "all" || (Array.isArray(labels) && labels.includes(c));
    const fs0 = 19 * Math.max(1, scale * 0.95);
    const boxes: Box[] = [{ x: 282, y: 282, w: 36, h: 36 }];
    if (homeLabel) {
      const w = homeLabel.length * fs0 * 0.52 + 4;
      boxes.push({ x: CENTER - w / 2, y: CENTER + 36 - fs0 * 0.8, w, h: fs0 });
    }
    points.forEach((p, i) => {
      const g = (lanterns[i]?.gold ? 1.5 : 1) * scale;
      boxes.push({ x: p.x - 9 * g, y: p.y - 15 * g, w: 18 * g, h: 23 * g });
    });
    const out: { text: string; x: number; y: number; anchor: "start" | "end" | "middle" }[] = [];
    const fs = fs0;
    const done = new Set<string>();
    points.forEach((p, i) => {
      if (labels === "none" || !want(p.city) || done.has(p.city)) return;
      const g = (lanterns[i]?.gold ? 1.5 : 1) * scale;
      const w = p.city.length * fs * 0.52 + 4, h = fs, left = p.x < CENTER, gx = 13 * g;
      const cands: ["r" | "l" | "t" | "b", Box][] = (left ? ["l", "r", "t", "b"] : ["r", "l", "t", "b"]).map((k) => [
        k as "r" | "l" | "t" | "b",
        k === "r" ? { x: p.x + gx, y: p.y - h * 0.62, w, h }
          : k === "l" ? { x: p.x - gx - w, y: p.y - h * 0.62, w, h }
          : k === "t" ? { x: p.x - w / 2, y: p.y - 17 * g - h, w, h }
          : { x: p.x - w / 2, y: p.y + 12 * g, w, h },
      ]);
      for (const [k, b] of cands) {
        if (b.x < -2 || b.x + b.w > 602) continue;
        if (boxes.some((o) => overlaps(o, b))) continue;
        boxes.push(b);
        done.add(p.city);
        out.push({ text: p.city, x: k === "r" ? b.x : k === "l" ? b.x + b.w : b.x + b.w / 2, y: b.y + b.h * 0.8, anchor: k === "r" ? "start" : k === "l" ? "end" : "middle" });
        break;
      }
    });
    return { out, fs };
  }, [points, lanterns, labels, scale, homeLabel]);

  let viewBox = "-6 -6 612 612";
  if (focus !== undefined && points[focus]) {
    const p = points[focus];
    const mx = (CENTER + p.x) / 2, my = (CENTER + p.y) / 2;
    const h = Math.max(150, Math.hypot(p.x - CENTER, p.y - CENTER) * 0.62 + 70);
    viewBox = `${(mx - h).toFixed(0)} ${(my - h).toFixed(0)} ${(2 * h).toFixed(0)} ${(2 * h).toFixed(0)}`;
  }

  const lit = lanterns.filter((l) => l.gold).length;
  const aria =
    label ??
    `A globe with ${lanterns.length} ${lanterns.length === 1 ? "lantern" : "lanterns"}${lit ? `, ${lit} gold` : ""}, joined to home in ${homeCity}${
      lanterns.length ? `: ${[...new Set(lanterns.map((l) => l.city))].join(", ")}` : ""
    }.`;

  return (
    <svg className={`wm-globe wm-m-${motion} ${className}`} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={aria}>
      <defs>
        <radialGradient id="wm-gA"><stop offset="0%" stopColor={AMBER} stopOpacity={0.75} /><stop offset="100%" stopColor={AMBER} stopOpacity={0} /></radialGradient>
        <radialGradient id="wm-gG"><stop offset="0%" stopColor={GOLD} stopOpacity={0.9} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></radialGradient>
        <radialGradient id={`${uid}-home`}><stop offset="0%" stopColor={AMBER} stopOpacity={0.6} /><stop offset="100%" stopColor={AMBER} stopOpacity={0} /></radialGradient>
        <clipPath id={`${uid}-clip`}><circle cx={CENTER} cy={CENTER} r={SPHERE_R} /></clipPath>
      </defs>
      <g className="wm-gr">
        <circle cx={CENTER} cy={CENTER} r={SPHERE_R} fill="#EBDDBF" stroke="#2E2219" strokeWidth={2.2} />
        <g clipPath={`url(#${uid}-clip)`} fill="none" stroke="#6A5641" strokeWidth={1} opacity={0.5}>
          <ellipse cx={CENTER} cy={CENTER} rx={60} ry={260} />
          <ellipse cx={CENTER} cy={CENTER} rx={130} ry={260} />
          <ellipse cx={CENTER} cy={CENTER} rx={200} ry={260} />
          <ellipse cx={CENTER} cy={CENTER} rx={260} ry={60} />
          <path d={GRAT} />
        </g>
        <circle cx={CENTER} cy={CENTER} r={270} fill="none" stroke="#2E2219" strokeWidth={5} strokeDasharray="1 8.42" opacity={0.4} />
        <circle cx={CENTER} cy={CENTER} r={277} fill="none" stroke="#2E2219" strokeWidth={1} opacity={0.55} />
      </g>
      <g className="wm-ths">
        {points.map((p, i) => (
          <path
            key={`t${i}`}
            className={`wm-th${motion === "last" && i === points.length - 1 ? " wm-new" : ""}`}
            style={{ ["--i" as string]: i }}
            pathLength={1}
            d={threadPath(p)}
            fill="none"
            stroke={lanterns[i]?.gold ? GOLD : "#B9741F"}
            strokeWidth={lanterns[i]?.gold ? 2.8 : 2}
          />
        ))}
      </g>
      <g className="wm-hm">
        <circle cx={CENTER} cy={CENTER} r={24} fill={`url(#${uid}-home)`} />
        <circle cx={CENTER} cy={CENTER} r={6.5} fill="#9C3324" stroke="#2E2219" strokeWidth={1.2} />
        {homeLabel && (
          <text className="wm-cl" x={CENTER} y={CENTER + 36} textAnchor="middle" fontSize={placedLabels.fs}>
            {homeLabel}
          </text>
        )}
      </g>
      {points.map((p, i) => (
        <g key={`l${i}`} transform={`translate(${p.x} ${p.y})`} className={motion === "last" && i === points.length - 1 ? "wm-new" : undefined}>
          <LanternGlyph state={lanterns[i]?.gold && turn !== i ? "gold" : "lit"} i={i} s={scale * (lanterns[i]?.gold && turn !== i ? 1.5 : 1)} />
          {turn === i && (
            <g className="wm-turn">
              <LanternGlyph state="gold" i={i} s={scale * 1.5} />
            </g>
          )}
        </g>
      ))}
      {placedLabels.out.map((l) => (
        <text key={l.text} className="wm-cl" x={l.x.toFixed(1)} y={l.y.toFixed(1)} textAnchor={l.anchor} fontSize={placedLabels.fs}>
          {l.text}
        </text>
      ))}
    </svg>
  );
}
