// GET /api/og?id=<map>[&v=<version>][&f=story][&dl=1]: the share cards, Storybook dusk.
//   link  (default) 1200x627: link preview for /m/ and /t/, LinkedIn, WhatsApp
//   story 1080x1920: WhatsApp Status and Instagram Story
// Without an id: the home page card. Only id, v, f and dl are read; the picture
// is drawn from the cities-only public payload, so it can never hold a
// friend's name.
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findMap } from "@/lib/owner";
import { toPublicMap } from "@/lib/public-map";
import { cardCache, cardModel, cardVersion, parseCardParams, CARD_CACHE, CARD_SIZES, CARD_THREAD, type CardModel } from "@/lib/card";
import { threadPath, CENTER, SPHERE_R } from "@/lib/globe-layout";
import { limitRequest, HOUR } from "@/lib/limits";

export const runtime = "nodejs";

const INK = "#2E2219";
const SOFT = "#4E3B2A";
const HAND = "M-5-8h10l1.6 3v7.6L5 5.6H-5l-1.6-3V-5z";

type FontStyle = "normal" | "italic";
const FONT_FILES: [string, string, FontStyle][] = [
  ["IM Fell English", "IMFellEnglish-Regular.woff", "normal"],
  ["IM Fell English", "IMFellEnglish-Italic.woff", "italic"],
  ["IM Fell English SC", "IMFellEnglishSC-Regular.woff", "normal"],
  ["EB Garamond", "EBGaramond-Regular.woff", "normal"],
  ["EB Garamond", "EBGaramond-Italic.woff", "italic"],
  ["Courier Prime", "CourierPrime-Regular.woff", "normal"],
];
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400; style: FontStyle }[]> | null = null;
function fonts() {
  if (!fontsPromise) {
    const p = Promise.all(
      FONT_FILES.map(async ([name, file, style]) => {
        const buf = await readFile(path.join(process.cwd(), "assets/fonts", file));
        return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight: 400 as const, style };
      })
    );
    fontsPromise = p;
    p.catch(() => {
      if (fontsPromise === p) fontsPromise = null; // a failed read is tried again next time, not kept
    });
  }
  return fontsPromise;
}

/** The lit hand lantern at dusk (deck "ak"). */
function duskLantern(x: number, y: number, s: number, key?: string) {
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={31} fill="url(#gN)" />
      <path d="M0-13.5a2.6 2.6 0 0 1 0 5.2M-3.6-8.3h7.2" fill="none" stroke="#D9B27A" strokeWidth={1.1} />
      <path d={HAND} fill="url(#gNL)" stroke="#2A1D12" strokeWidth={1.1} strokeLinejoin="round" />
      <ellipse cy={-0.9} rx={1.8} ry={2.9} fill="#FFF9EA" opacity={0.95} />
      <path d="M-6 6.6h12" stroke="#2A1D12" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

function DuskGlobe({ m, size }: { m: CardModel; size: number }) {
  const { points, glyphScale } = m.globe;
  return (
    <svg width={size} height={size} viewBox="-6 -6 612 612">
      <defs>
        <radialGradient id="gN">
          <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
          <stop offset="0.32" stopColor="#E8A84A" stopOpacity="0.42" />
          <stop offset="1" stopColor="#E8A84A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gNL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFEBC0" />
          <stop offset="1" stopColor="#EFAE52" />
        </linearGradient>
        <radialGradient id="gAK">
          <stop offset="0" stopColor="#FFE3A8" stopOpacity="1" />
          <stop offset="0.36" stopColor="#E8A84A" stopOpacity="0.6" />
          <stop offset="1" stopColor="#E8A84A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sphK" cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#6E5038" />
          <stop offset="0.58" stopColor="#3E2C1F" />
          <stop offset="1" stopColor="#22180F" />
        </radialGradient>
        <radialGradient id="atK">
          <stop offset="0.8" stopColor="#F3B75E" stopOpacity="0" />
          <stop offset="0.88" stopColor="#F3B75E" stopOpacity="0.42" />
          <stop offset="1" stopColor="#F3B75E" stopOpacity="0" />
        </radialGradient>
        <clipPath id="clipG">
          <circle cx={CENTER} cy={CENTER} r={SPHERE_R} />
        </clipPath>
      </defs>
      <circle cx={CENTER} cy={CENTER} r={300} fill="url(#atK)" />
      <circle cx={CENTER} cy={CENTER} r={SPHERE_R} fill="url(#sphK)" />
      <g clipPath="url(#clipG)" fill="none" stroke="#EBDDBF" strokeWidth={1} opacity={0.17}>
        <ellipse cx={CENTER} cy={CENTER} rx={60} ry={260} />
        <ellipse cx={CENTER} cy={CENTER} rx={130} ry={260} />
        <ellipse cx={CENTER} cy={CENTER} rx={200} ry={260} />
        <ellipse cx={CENTER} cy={CENTER} rx={260} ry={60} />
        <path d="M300 40V560M40 300H560M60 190Q300 160 540 190M60 410Q300 440 540 410M110 110Q300 90 490 110M110 490Q300 510 490 490" />
      </g>
      <circle cx={CENTER} cy={CENTER} r={SPHERE_R} fill="none" stroke={INK} strokeWidth={2.6} />
      <circle cx={CENTER} cy={CENTER} r={270} fill="none" stroke={INK} strokeWidth={5} strokeDasharray="1 8.42" opacity={0.4} />
      <circle cx={CENTER} cy={CENTER} r={277} fill="none" stroke={INK} strokeWidth={1} opacity={0.55} />
      {points.map((p, i) => (
        <path key={`t${i}`} d={threadPath(p)} fill="none" stroke={CARD_THREAD} strokeWidth={1.9} opacity={0.95} />
      ))}
      <circle cx={CENTER} cy={CENTER} r={22} fill="url(#gAK)" opacity={0.75} />
      <circle cx={CENTER} cy={CENTER} r={4.6} fill="#FFF3D6" />
      <circle cx={CENTER} cy={CENTER} r={9} fill="none" stroke="#F4EAD5" strokeWidth={1.1} opacity={0.75} />
      {points.map((p, i) => (
        duskLantern(p.x, p.y, glyphScale, `l${i}`)
      ))}
    </svg>
  );
}

/** City labels as text over the globe (SVG text is not drawn by the renderer). */
function Labels({ m, size }: { m: CardModel; size: number }) {
  const left = 0, top = 0;
  const k = size / 612;
  const fs = m.globe.labelSize * k * 1.05;
  return (
    <>
      {m.globe.labels.map((l) => {
        const x = left + (l.x + 6) * k;
        const y = top + (l.y + 6) * k - fs * 0.85;
        const w = 320;
        const box = l.anchor === "start" ? x : l.anchor === "end" ? x - w : x - w / 2;
        return (
          <div
            key={l.text}
            style={{
              position: "absolute",
              left: box,
              top: y,
              width: w,
              display: "flex",
              justifyContent: l.anchor === "start" ? "flex-start" : l.anchor === "end" ? "flex-end" : "center",
              fontFamily: "IM Fell English",
              fontStyle: "italic",
              fontSize: fs,
              color: "#F4EAD5",
              textShadow: `0 0 ${Math.max(2, fs * 0.18)}px ${INK}, 0 0 ${Math.max(2, fs * 0.1)}px ${INK}`,
            }}
          >
            {l.text}
          </div>
        );
      })}
    </>
  );
}

/**
 * Globe plus labels. Every child is absolute: the renderer adds an absolute
 * element's static position to its left/top, so nothing in flow may precede
 * the labels.
 */
function GlobeBox({ m, size, style }: { m: CardModel; size: number; style: Record<string, string | number> }) {
  return (
    <div style={{ ...style, width: size, height: size, display: "flex" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, display: "flex" }}>
        <DuskGlobe m={m} size={size} />
      </div>
      <Labels m={m} size={size} />
    </div>
  );
}

function Rail({ width, height, railY, lanternX, scale }: { width: number; height: number; railY: number; lanternX: number; scale: number }) {
  const posts = Array.from({ length: Math.ceil(width / 22) }, (_, i) => i);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, bottom: 0 }}>
      <defs>
        <radialGradient id="ember" cx="0.5" cy="1" r="0.9">
          <stop offset="0" stopColor="#E8A84A" stopOpacity="0.34" />
          <stop offset="1" stopColor="#E8A84A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gN">
          <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
          <stop offset="0.32" stopColor="#E8A84A" stopOpacity="0.42" />
          <stop offset="1" stopColor="#E8A84A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gNL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFEBC0" />
          <stop offset="1" stopColor="#EFAE52" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ember)" />
      <g fill={INK}>
        <rect x={0} y={railY} width={width} height={7} rx={1} />
        <rect x={0} y={height - 9} width={width} height={9} />
        {posts.map((i) => (
          <rect key={i} x={6 + i * 22} y={railY + 7} width={5} height={height - railY - 16} />
        ))}
      </g>
      {duskLantern(lanternX, railY - 14 * scale, scale)}
    </svg>
  );
}

// Lamp-lit paper: a vertical wash only. Full-picture radial washes doubled the
// PNG weight; WhatsApp drops previews much over 300 KB.
const PAPER = "linear-gradient(180deg, #D3A07A 0%, #E2BE92 40%, #EED7AE 100%)";

function LinkCard({ m }: { m: CardModel }) {
  const G = 580, GX = 34, GY = 26;
  return (
    <div style={{ width: 1200, height: 627, display: "flex", position: "relative", backgroundImage: PAPER, color: INK, fontFamily: "EB Garamond" }}>
      <GlobeBox m={m} size={G} style={{ position: "absolute", left: GX, top: GY }} />
      <div style={{ position: "absolute", left: 640, top: 56, width: 524, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Courier Prime", fontSize: 19, color: INK }}>
          <span>Warm Map</span>
          <span>{m.site}</span>
        </div>
        <div style={{ fontFamily: "IM Fell English", fontSize: m.titleSize, lineHeight: 1, marginTop: 24 }}>{m.title}</div>
        <div style={{ fontFamily: "EB Garamond", fontStyle: "italic", fontSize: 28, color: SOFT, marginTop: 10 }}>{m.sub}</div>
        {m.nums.length > 0 && (
          <div style={{ display: "flex", marginTop: 34 }}>
            {m.nums.map((n) => (
              <div key={n.label} style={{ display: "flex", flexDirection: "column", marginRight: 46 }}>
                <span style={{ fontFamily: "IM Fell English", fontSize: 62, lineHeight: 1 }}>{n.value}</span>
                <span style={{ fontFamily: "Courier Prime", fontSize: 18, color: SOFT, marginTop: 4 }}>{n.label}</span>
              </div>
            ))}
          </div>
        )}
        {m.kindTitle && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", marginTop: 26, fontSize: 25, lineHeight: 1.3 }}>
            <span style={{ fontFamily: "IM Fell English", fontStyle: "italic", fontSize: 31, marginRight: 8 }}>{m.kindTitle}.</span>
            {m.kindShort && <span>{m.kindShort}</span>}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 640, bottom: 100, display: "flex", alignItems: "baseline" }}>
        <span style={{ fontFamily: "IM Fell English", fontStyle: "italic", fontSize: 28 }}>{m.ask}</span>
        <span style={{ fontFamily: "Courier Prime", fontSize: 18, color: SOFT, marginLeft: 14 }}>{m.site}</span>
      </div>
      <Rail width={1200} height={130} railY={76} lanternX={1106} scale={1.6} />
    </div>
  );
}

function StoryCard({ m }: { m: CardModel }) {
  const G = 840;
  return (
    <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", backgroundImage: PAPER, color: INK, fontFamily: "EB Garamond" }}>
      <div style={{ marginTop: 66, fontFamily: "IM Fell English SC", fontSize: 42, letterSpacing: 3 }}>Warm Map</div>
      <div style={{ marginTop: 40, fontFamily: "IM Fell English", fontSize: m.titleSize, lineHeight: 1 }}>{m.title}</div>
      <div style={{ marginTop: 18, fontStyle: "italic", fontSize: 51, color: SOFT }}>{m.sub}</div>
      <GlobeBox m={m} size={G} style={{ position: "relative", marginTop: 20 }} />
      {m.nums.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          {m.nums.map((n) => (
            <div key={n.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 45px" }}>
              <span style={{ fontFamily: "IM Fell English", fontSize: 93, lineHeight: 1 }}>{n.value}</span>
              <span style={{ fontFamily: "Courier Prime", fontSize: 34, color: SOFT, marginTop: 6 }}>{n.label}</span>
            </div>
          ))}
        </div>
      )}
      {m.kindTitle && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", marginTop: 40, padding: "0 78px", fontSize: 45, lineHeight: 1.3 }}>
          <span style={{ fontFamily: "IM Fell English", fontStyle: "italic", fontSize: 60, marginRight: 14 }}>{m.kindTitle}.</span>
          {m.kindShort && <span>{m.kindShort}</span>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 46 }}>
        <span style={{ fontFamily: "IM Fell English", fontStyle: "italic", fontSize: 57 }}>{m.ask}</span>
        <span style={{ fontFamily: "Courier Prime", fontSize: 36, color: SOFT, marginTop: 12 }}>{m.site}</span>
      </div>
      <Rail width={1080} height={300} railY={174} lanternX={900} scale={3.4} />
    </div>
  );
}

// Drawn pictures kept in this server instance, by map, version and size. Requests that arrive together for the same
// picture share one drawing (a launch burst on a cold CDN edge draws it once, not once per request). A map's version
// is its last change, so a changed map is drawn afresh; the map is still looked up every time, so a deleted map's
// picture is never served from here.
const DRAWN = new Map<string, Promise<ArrayBuffer>>();
const DRAWN_MAX = 24;
const DRAW_TIMEOUT_MS = 10_000;
function drawOnce(key: string, draw: () => Promise<ArrayBuffer>): { png: Promise<ArrayBuffer>; fresh: boolean } {
  const kept = DRAWN.get(key);
  if (kept) {
    DRAWN.delete(key);
    DRAWN.set(key, kept);
    return { png: kept, fresh: false };
  }
  // A drawing that never settles would hold its key (and every later request for it) for the life of the instance.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("drawing timed out")), DRAW_TIMEOUT_MS);
  });
  const png = Promise.race([draw(), timeout]).finally(() => clearTimeout(timer));
  DRAWN.set(key, png);
  png.catch(() => {
    if (DRAWN.get(key) === png) DRAWN.delete(key); // a failed drawing is never kept (and never removes a newer one)
  });
  while (DRAWN.size > DRAWN_MAX) DRAWN.delete(DRAWN.keys().next().value!);
  return { png, fresh: true };
}

const noStore = { "Cache-Control": CARD_CACHE.error };

export async function GET(req: NextRequest): Promise<Response> {
  const limited = await limitRequest(req, "og", { device: [600, HOUR], ip: [2400, HOUR] });
  if (limited) {
    limited.headers.set("Cache-Control", CARD_CACHE.error);
    return limited;
  }
  const { id, format, download, version } = parseCardParams(req.nextUrl.searchParams);
  try {
    const row = id ? await findMap(id) : null;
    const current = row ? cardVersion(row) : null;
    const cache = cardCache({ id, found: !!row, asked: version, current });
    const size = CARD_SIZES[format];
    const { png, fresh } = drawOnce(row ? `${row.id}:${current}:${format}` : `home:${format}`, async () => {
      const m = cardModel(row ? toPublicMap(row) : null, format);
      const image = new ImageResponse(format === "story" ? <StoryCard m={m} /> : <LinkCard m={m} />, { ...size, fonts: await fonts() });
      // Drawn to the end before any header goes out, so a picture that fails half way is a 500 that is never cached.
      return (image as unknown as Response).arrayBuffer();
    });
    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "Cache-Control": CARD_CACHE[cache],
      "X-Robots-Tag": "noindex",
      "X-Card": fresh ? "drawn" : "kept",
    };
    if (download) headers["Content-Disposition"] = `attachment; filename="warm-map-${format === "story" ? "story" : "card"}.png"`;
    return new Response(await png, { headers });
  } catch (e) {
    console.error("og error:", (e as Error).message);
    return new Response("The picture isn't ready. Try again in a moment.", { status: 500, headers: noStore });
  }
}
