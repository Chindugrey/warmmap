"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CENTER, SPHERE_R, layoutGlobe, placeLabels, threadPath } from "@/lib/globe-layout";

/** Smallest label text on a phone, in rendered CSS px. */
export const MIN_LABEL_PX = 12;
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
  // The globe is scaled to fit its box (600 units across), so a label's rendered size is its font size
  // times boxPx / 612. Measure the box and size the labels up to MIN_LABEL_PX; the collision pass then drops what no longer fits.
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxPx, setBoxPx] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const read = () => setBoxPx(Math.min(el.clientWidth, el.clientHeight));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { points } = useMemo(() => layoutGlobe(homeCity, lanterns.map((l) => l.city)), [homeCity, lanterns]);

  const placedLabels = useMemo(() => {
    const r = placeLabels({
      points,
      gold: lanterns.map((l) => !!l.gold),
      want: (c) => labels === "all" || (Array.isArray(labels) && labels.includes(c)),
      scale,
      homeLabel,
      fontSize: boxPx > 0 ? Math.max(19 * Math.max(1, scale * 0.95), (MIN_LABEL_PX * 612) / boxPx) : undefined,
    });
    return { out: labels === "none" ? [] : r.labels, fs: r.fontSize };
  }, [points, lanterns, labels, scale, homeLabel, boxPx]);

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
    <svg ref={svgRef} className={`wm-globe wm-m-${motion} ${className}`} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={aria}>
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
