// Founder's connector score (design-doc.md): vouches received from different
// people, plus maps their friends went on to make, plus the cities on their map.
export function connectorScore(x: { distinctVouchers: number; mapsBroughtIn: number; cities: number }): number {
  return x.distinctVouchers + x.mapsBroughtIn + x.cities;
}
