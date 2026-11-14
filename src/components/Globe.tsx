"use client";

import { useId, useMemo, type ReactNode } from "react";
import { citiesByName, type City } from "@/lib/cities";
import { placeOnGlobe, CX, CY } from "@/lib/geo";

export interface GlobeEntry {
  name?: string;
  city: string;
  /** Tied back: one gold (#F2C230), 1.5x larger, with a ring, so it never relies on colour alone. */
  gold?: boolean;
}

export const GOLD = "#F2C230";

interface GlobeProps {
  homeCity: string;
  entries: GlobeEntry[];
  width?: number;
  height?: number;
  className?: string;
  animateLast?: boolean;
}

function safeCity(name: string): City {
  return citiesByName[name] ?? citiesByName["Bengaluru"]!;
}

export function Globe({
  homeCity,
  entries,
  width = 600,
  height = 600,
  className = "globe",
  animateLast = true,
}: GlobeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const home = safeCity(homeCity);

  const { threads, lanterns } = useMemo(() => {
    const labels: [number, number][] = [[CX, CY + 30]];
    const threads: ReactNode[] = [];
    const lanterns: ReactNode[] = [];

    entries.forEach((entry, index) => {
      const city = citiesByName[entry.city];
      if (!city) return;

      const q = placeOnGlobe(home, city);
      const dx = q.x - CX;
      const dy = q.y - CY;
      const mx = (CX + q.x) / 2 - dy * 0.22;
      const my = (CY + q.y) / 2 + dx * 0.22;
      const fresh = animateLast && index === entries.length - 1;

      threads.push(
        <path
          key={`t-${index}`}
          d={`M${CX} ${CY} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(
            1
          )} ${q.y.toFixed(1)}`}
          className={fresh ? "thread" : undefined}
          opacity="0.85"
          stroke={entry.gold ? GOLD : undefined}
          strokeWidth={entry.gold ? 3 : undefined}
        />
      );

      const left = q.x > 430;
      const lx = q.x + (left ? -10 : 10);
      let ly = q.y - 10;
      let tries = 0;
      while (
        tries < 6 &&
        labels.some((b) => Math.abs(b[0] - lx) < 70 && Math.abs(b[1] - ly) < 20)
      ) {
        ly -= 20;
        tries++;
      }
      labels.push([lx, ly]);

      const label = entry.name || entry.city;

      lanterns.push(
        <g
          key={`l-${index}`}
          className={fresh ? "lantern-new" : undefined}
          style={{ transformOrigin: `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px` }}
        >
          <circle cx={q.x} cy={q.y} r={18} fill={`url(#${uid}-lamp)`} />
          <circle
            cx={q.x}
            cy={q.y}
            r={entry.gold ? 7.5 : 5}
            fill={entry.gold ? GOLD : "#B9741F"}
            stroke="#2E2219"
            strokeWidth={1.2}
          />
          {entry.gold && (
            <circle cx={q.x} cy={q.y} r={13} fill="none" stroke="#2E2219" strokeWidth={1.4} />
          )}
          <text
            x={lx}
            y={ly}
            textAnchor={left ? "end" : "start"}
            fontFamily="var(--font-display)"
            fontSize={19}
            fill="#2E2219"
            stroke="#EBDDBF"
            strokeWidth={4}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {label}
          </text>
        </g>
      );
    });

    return { threads, lanterns };
  }, [entries, home, uid, animateLast]);

  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      width={width}
      height={height}
      role="img"
      aria-label="An engraved globe where each person you name lights a lantern in their city, joined to you by a golden thread"
    >
      <defs>
        <radialGradient id={`${uid}-lamp`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8A84A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E8A84A" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-sphere`}>
          <circle cx={CX} cy={CY} r={260} />
        </clipPath>
      </defs>

      <circle
        cx={CX}
        cy={CY}
        r={262}
        fill="#EBDDBF"
        stroke="#2E2219"
        strokeWidth={2.2}
      />

      <g
        clipPath={`url(#${uid}-sphere)`}
        fill="none"
        stroke="#6A5641"
        strokeWidth={1}
        opacity={0.55}
      >
        <ellipse cx={CX} cy={CY} rx={60} ry={260} />
        <ellipse cx={CX} cy={CY} rx={130} ry={260} />
        <ellipse cx={CX} cy={CY} rx={200} ry={260} />
        <path d={`M${CX} 40 V560`} />
        <path d={`M40 ${CY} H560`} />
        <ellipse cx={CX} cy={CY} rx={260} ry={60} />
        <path d="M60 190 Q300 160 540 190 M60 410 Q300 440 540 410 M110 110 Q300 90 490 110 M110 490 Q300 510 490 490" />
      </g>

      <circle
        cx={CX}
        cy={CY}
        r={276}
        fill="none"
        stroke="#2E2219"
        strokeWidth={1}
        opacity={0.5}
      />

      <g fill="none" stroke="#B9741F" strokeWidth={2} strokeLinecap="round">
        {threads}
      </g>

      <g>{lanterns}</g>

      <g>
        <circle cx={CX} cy={CY} r={24} fill={`url(#${uid}-lamp)`} />
        <circle
          cx={CX}
          cy={CY}
          r={7}
          fill="#9C3324"
          stroke="#2E2219"
          strokeWidth={1.2}
        />
        <text
          x={CX}
          y={CY + 32}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={19}
          fill="#2E2219"
          stroke="#EBDDBF"
          strokeWidth={4}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          you
        </text>
      </g>
    </svg>
  );
}
