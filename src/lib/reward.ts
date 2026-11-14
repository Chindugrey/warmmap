// The short line after each lantern (design-doc.md "The lines after each
// answer"). Runs on the phone; the name never leaves it.
import { citiesByName } from "./cities";
import { haversineKm } from "./geo";

export interface RewardCtx {
  count: number; // lanterns lit including this one
  questionIndex: number;
  city: string;
  name: string;
  homeCity: string;
  prevCities: string[];
  prevNames: string[]; // lower-cased
  skipped?: boolean;
}

export function rewardLine(c: RewardCtx): string {
  if (c.skipped) return "That's fine. Not every lantern is ready yet.";
  if (c.count === 1) return "There. That's your first light.";
  if (c.count === 5) return "Five lanterns. Your map is ready when you are.";
  const first = c.name.trim().split(/\s+/)[0] ?? "";
  if (first && c.prevNames.includes(c.name.trim().toLowerCase())) return `${first} again. Some people hold a lot of your sky.`;
  if (c.questionIndex === 0) return "Some people are worth waking up.";
  if (c.questionIndex === 4) return "Every story has someone who said yes first.";
  if (c.count === 6) return "Six people. Most people never write this down.";
  const home = citiesByName[c.homeCity];
  const city = citiesByName[c.city];
  if (home && city) {
    const countries = new Set([home.country, ...c.prevCities.map((p) => citiesByName[p]?.country).filter(Boolean)]);
    if (!countries.has(city.country)) return "Your map just crossed a border.";
    if (city.name === home.name) return "Close enough to show up in twenty minutes.";
    const km = Math.round(haversineKm(home.lat, home.lon, city.lat, city.lon) / 10) * 10;
    return `${km.toLocaleString("en-IN")} km of thread. Worth every kilometre.`;
  }
  return "Another light.";
}
