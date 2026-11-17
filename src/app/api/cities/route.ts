// GET /api/cities?q=…&home=…&limit=…: ranked city suggestions from the full list. The same ranking as the
// curated list (exact / alias, prefix, word prefix, substring of 4+, then fuzzy; a country gives its cities;
// the home city's state and country first). Public data, no cookies, no DB.
import { NextRequest, NextResponse } from "next/server";
import { searchCities } from "@/lib/cities-full";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").slice(0, 60);
  const home = (sp.get("home") ?? "").slice(0, 80);
  const limit = Math.min(10, Math.max(1, Number(sp.get("limit")) || 6));
  const body = q.trim() ? searchCities(q, limit, home || undefined) : { results: [], match: null, country: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
