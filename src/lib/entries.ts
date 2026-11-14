// Map.entries as stored. Question lanterns carry their question index; the
// carried lantern (pointing back to whoever brought you) has none.
export type StoredEntry =
  | { city: string; questionIndex: number }
  | { city: string; carried: true };

export function parseEntries(raw: unknown): StoredEntry[] {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is StoredEntry => !!e && typeof e === "object" && typeof (e as { city?: unknown }).city === "string"
  );
}

export function isCarried(e: StoredEntry): e is { city: string; carried: true } {
  return "carried" in e && e.carried === true;
}
