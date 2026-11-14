// Live lantern count, on the landing page and after the reveal. Shown from the
// first lantern (Aadarsh, 14 Nov): a real count, never rounded up.
export function counterPayload(total: number): { show: boolean; lanterns: number | null } {
  return total >= 1 ? { show: true, lanterns: total } : { show: false, lanterns: null };
}
