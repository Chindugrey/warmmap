import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { citiesByName } from "@/lib/cities";
import { placeOnGlobe, mapStats } from "@/lib/geo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  let ownerName = "Someone";
  let homeCity = "Bengaluru";
  let entries: { city: string; questionIndex: number }[] = [];

  if (id) {
    const map = await prisma.map.findFirst({
      where: { OR: [{ shortSlug: id }, { publicId: id }], deletedAt: null },
    });
    if (map) {
      ownerName = map.ownerName || "Someone";
      homeCity = map.homeCity;
      const rawEntries = map.entries;
      if (Array.isArray(rawEntries)) {
        entries = rawEntries as { city: string; questionIndex: number }[];
      } else if (typeof rawEntries === "string") {
        try {
          entries = JSON.parse(rawEntries || "[]");
        } catch {
          entries = [];
        }
      }
    }
  }

  const stats = mapStats(entries, homeCity);
  const home = citiesByName[homeCity] || citiesByName["Bengaluru"];

  const cx = 300;
  const cy = 300;

  const placed = entries
    .map((e) => citiesByName[e.city])
    .filter(Boolean)
    .map((city) => placeOnGlobe(home, city as any));

  const threads = placed.map((p) => {
    const mx = (cx + p.x) / 2 - (p.y - cy) * 0.22;
    const my = (cy + p.y) / 2 + (p.x - cx) * 0.22;
    return `M${cx} ${cy} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });

  const lanterns = placed.map((p) => ({ cx: p.x, cy: p.y }));

  const statItems = [
    { n: stats.people, label: stats.people === 1 ? "person" : "people" },
    { n: stats.cities, label: stats.cities === 1 ? "city" : "cities" },
    { n: stats.countries, label: stats.countries === 1 ? "country" : "countries" },
    { n: stats.km.toLocaleString("en-IN"), label: "km of threads" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#F1E6CF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#2E2219",
        }}
      >
        <div
          style={{
            width: 1144,
            height: 574,
            background: "#FBF4E4",
            borderRadius: 28,
            border: "2px solid #CDB991",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 32,
              right: 32,
              width: 80,
              height: 80,
              borderRadius: "50%",
              border: "2px dashed #9C3324",
              color: "#9C3324",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              textAlign: "center",
              transform: "rotate(12deg)",
              fontWeight: 700,
            }}
          >
            WARM{"\n"}MAP
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 54, marginBottom: 8, display: "flex" }}>
              {ownerName}&apos;s Warm Map
            </div>
            <div
              style={{
                fontSize: 26,
                fontStyle: "italic",
                color: "#6A5641",
                marginBottom: 24,
                display: "flex",
              }}
            >
              the people who&apos;d pick up
            </div>
          </div>

          <svg
            width={520}
            height={520}
            viewBox="0 0 600 600"
            style={{ marginBottom: -40, display: "flex" }}
          >
            <defs>
              <radialGradient id="lp" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E8A84A" stopOpacity=".9" />
                <stop offset="100%" stopColor="#E8A84A" stopOpacity="0" />
              </radialGradient>
              <clipPath id="sphere">
                <circle cx={cx} cy={cy} r={260} />
              </clipPath>
            </defs>
            <circle
              cx={cx}
              cy={cy}
              r={262}
              fill="#EBDDBF"
              stroke="#2E2219"
              strokeWidth={2.2}
            />
            <g
              clipPath="url(#sphere)"
              fill="none"
              stroke="#6A5641"
              strokeWidth={1}
              opacity={0.5}
            >
              <ellipse cx={cx} cy={cy} rx={60} ry={260} />
              <ellipse cx={cx} cy={cy} rx={130} ry={260} />
              <ellipse cx={cx} cy={cy} rx={200} ry={260} />
              <path d={`M${cx} 40 V560`} />
              <path d={`M40 ${cy} H560`} />
              <ellipse cx={cx} cy={cy} rx={260} ry={60} />
              <path d="M60 190 Q300 160 540 190 M60 410 Q300 440 540 410 M110 110 Q300 90 490 110 M110 490 Q300 510 490 490" />
            </g>
            <circle
              cx={cx}
              cy={cy}
              r={276}
              fill="none"
              stroke="#2E2219"
              strokeWidth={1}
              opacity={0.45}
            />
            {threads.map((d, i) => (
              <path
                key={`t-${i}`}
                d={d}
                fill="none"
                stroke="#B9741F"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}
            {lanterns.map((p, i) => (
              <g key={`l-${i}`}>
                <circle cx={p.cx} cy={p.cy} r={18} fill="url(#lp)" />
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={5}
                  fill="#B9741F"
                  stroke="#2E2219"
                  strokeWidth={1.2}
                />
              </g>
            ))}
            <circle cx={cx} cy={cy} r={26} fill="url(#lp)" />
            <circle
              cx={cx}
              cy={cy}
              r={8}
              fill="#9C3324"
              stroke="#2E2219"
              strokeWidth={1.2}
            />
          </svg>

          <div
            style={{
              display: "flex",
              gap: 80,
              borderTop: "2px dashed #C9B48C",
              paddingTop: 24,
              marginTop: 8,
            }}
          >
            {statItems.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 44, display: "flex" }}>{s.n}</div>
                <div style={{ fontSize: 18, color: "#6A5641", display: "flex" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 20,
              letterSpacing: 3,
              color: "#9C3324",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Who&apos;s in your corner? · warmmap.world
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  ) as Response;
}
