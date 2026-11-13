"use client";

import { citiesByName, type City } from "@/lib/cities";
import { placeOnGlobe, haversineKm, CX, CY } from "@/lib/geo";

export interface SharePictureInput {
  ownerName: string;
  homeCity: string;
  entries: { city: string }[];
}

export interface SharePictureResult {
  dataUrl: string;
  blob: Blob;
}

function safeCity(name: string): City {
  return citiesByName[name] ?? citiesByName["Bengaluru"]!;
}

function getCssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function waitForFonts() {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.ready;
  } catch {
    // ignore
  }
}

export async function generateSharePicture(
  input: SharePictureInput
): Promise<SharePictureResult> {
  const { ownerName, homeCity, entries } = input;
  const home = safeCity(homeCity);

  const stats = {
    people: entries.length,
    cities: new Set(entries.map((e) => e.city)).size,
    countries: new Set(
      entries.map((e) => citiesByName[e.city]?.country).filter(Boolean)
    ).size,
    km: Math.round(
      entries.reduce((sum, e) => {
        const c = citiesByName[e.city];
        return c ? sum + haversineKm(home.lat, home.lon, c.lat, c.lon) : sum;
      }, 0)
    ),
  };

  await waitForFonts();

  const displayFont = getCssVar("--font-warm-display") || "'IM Fell English', Georgia, serif";
  const bodyFont = getCssVar("--font-warm-body") || "'EB Garamond', 'Iowan Old Style', Georgia, serif";
  const capsFont = getCssVar("--font-warm-caps") || "'IM Fell English SC', 'Iowan Old Style', Georgia, serif";

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // parchment background
  ctx.fillStyle = "#F1E6CF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // card frame
  ctx.fillStyle = "#FBF4E4";
  ctx.strokeStyle = "#CDB991";
  ctx.lineWidth = 2;
  roundRect(ctx, 28, 28, 1024, 1294, 28);
  ctx.fill();
  ctx.stroke();

  // title
  ctx.textAlign = "center";
  ctx.fillStyle = "#2E2219";
  ctx.font = `60px ${displayFont}`;
  ctx.fillText(
    ownerName ? `${ownerName}\u2019s Warm Map` : "My Warm Map",
    540,
    128
  );

  // subtitle
  ctx.font = `italic 32px ${bodyFont}`;
  ctx.fillStyle = "#6A5641";
  ctx.fillText("the people who\u2019d pick up", 540, 178);

  // globe
  drawGlobe(ctx, home, entries, displayFont);

  // divider
  ctx.strokeStyle = "#C9B48C";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(110, 1076);
  ctx.lineTo(970, 1076);
  ctx.stroke();
  ctx.setLineDash([]);

  // stats
  ctx.fillStyle = "#2E2219";
  ctx.font = `66px ${displayFont}`;
  stat(ctx, 175, stats.people, stats.people === 1 ? "person" : "people", bodyFont);
  stat(ctx, 415, stats.cities, stats.cities === 1 ? "city" : "cities", bodyFont);
  stat(
    ctx,
    655,
    stats.countries,
    stats.countries === 1 ? "country" : "countries",
    bodyFont
  );
  stat(ctx, 905, stats.km.toLocaleString("en-IN"), "km of threads", bodyFont);

  // footer
  ctx.fillStyle = "#9C3324";
  ctx.font = `28px ${capsFont}`;
  ctx.letterSpacing = "3px";
  ctx.fillText("WHO\u2019S IN YOUR CORNER? \u00b7 WARMMAP.WORLD", 540, 1282);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not generate PNG blob"));
        return;
      }
      resolve({ dataUrl: canvas.toDataURL("image/png"), blob });
    }, "image/png");
  });
}

function stat(
  ctx: CanvasRenderingContext2D,
  x: number,
  value: string | number,
  label: string,
  labelFont: string
) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#2E2219";
  ctx.fillText(String(value), x, 1160);
  ctx.fillStyle = "#6A5641";
  ctx.font = `26px ${labelFont}`;
  ctx.fillText(label, x, 1202);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  home: City,
  entries: { city: string }[],
  displayFont: string
) {
  ctx.save();
  ctx.translate(116, 214);
  ctx.scale(1.413, 1.413);

  // globe base
  ctx.fillStyle = "#EBDDBF";
  ctx.strokeStyle = "#2E2219";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(CX, CY, 262, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // graticules
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, 260, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#6A5641";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;

  ctx.beginPath();
  ctx.ellipse(CX, CY, 60, 260, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(CX, CY, 130, 260, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(CX, CY, 200, 260, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX, 40);
  ctx.lineTo(CX, 560);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(40, CY);
  ctx.lineTo(560, CY);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(CX, CY, 260, 60, 0, 0, Math.PI * 2);
  ctx.stroke();

  drawCurved(ctx, "M60 190 Q300 160 540 190");
  drawCurved(ctx, "M60 410 Q300 440 540 410");
  drawCurved(ctx, "M110 110 Q300 90 490 110");
  drawCurved(ctx, "M110 490 Q300 510 490 490");

  ctx.restore();

  // outer ring
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "#2E2219";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(CX, CY, 276, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // threads & lanterns
  entries.forEach((entry) => {
    const city = citiesByName[entry.city];
    if (!city) return;
    const q = placeOnGlobe(home, city);
    const dx = q.x - CX;
    const dy = q.y - CY;
    const mx = (CX + q.x) / 2 - dy * 0.22;
    const my = (CY + q.y) / 2 + dx * 0.22;

    ctx.strokeStyle = "#B9741F";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.quadraticCurveTo(mx, my, q.x, q.y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const grad = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 18);
    grad.addColorStop(0, "rgba(232,168,74,0.9)");
    grad.addColorStop(1, "rgba(232,168,74,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#B9741F";
    ctx.strokeStyle = "#2E2219";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // home lantern
  const homeGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 26);
  homeGrad.addColorStop(0, "rgba(232,168,74,0.9)");
  homeGrad.addColorStop(1, "rgba(232,168,74,0)");
  ctx.fillStyle = homeGrad;
  ctx.beginPath();
  ctx.arc(CX, CY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9C3324";
  ctx.strokeStyle = "#2E2219";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(CX, CY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // home label
  ctx.font = `19px ${displayFont}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#2E2219";
  ctx.strokeStyle = "#EBDDBF";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeText("you", CX, CY + 32);
  ctx.fillText("you", CX, CY + 32);

  ctx.restore();
}

function drawCurved(ctx: CanvasRenderingContext2D, d: string) {
  // Very small parser for the prototype's quadratic paths.
  const parts = d.replace(/M/g, " M ").replace(/Q/g, " Q ").trim().split(/\s+/);
  let i = 0;
  while (i < parts.length) {
    const cmd = parts[i++];
    if (cmd === "M") {
      const x = parseFloat(parts[i++]);
      const y = parseFloat(parts[i++]);
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (cmd === "Q") {
      const cpx = parseFloat(parts[i++]);
      const cpy = parseFloat(parts[i++]);
      const x = parseFloat(parts[i++]);
      const y = parseFloat(parts[i++]);
      ctx.quadraticCurveTo(cpx, cpy, x, y);
      ctx.stroke();
    }
  }
}
