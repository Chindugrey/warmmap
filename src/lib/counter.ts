// Live lantern count: shown only once it passes the floor; never rounded up.
export const COUNTER_FLOOR = 15;

export function counterPayload(total: number): { show: boolean; lanterns: number | null } {
  return total >= COUNTER_FLOOR ? { show: true, lanterns: total } : { show: false, lanterns: null };
}
