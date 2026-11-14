// Which vouches are ever shown (as gold, or counted for the founder).
// Pre-v2 e-mail-verified vouches were migrated without a thank-you link; they
// stay in the database but are displayed nowhere (Aadarsh, 14 Nov).
export function isDisplayableVouch(v: { tier: string; thankLinkId: string | null }): boolean {
  return v.tier === "tap" && v.thankLinkId !== null;
}

/** The same rule as a Prisma filter. */
export const DISPLAYABLE_VOUCH = { tier: "tap", thankLinkId: { not: null } } as const;
