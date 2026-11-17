// The facts the privacy page states about who runs Warm Map and where data lives.
// Fill a value in; leave it null and the page uses a plain, true, generic sentence
// instead. Nothing here may be invented: a null is always safer than a guess.
export interface PrivacyFacts {
  controllerName: string | null; // legal name of whoever is responsible, e.g. "Acme Pvt Ltd"
  controllerAddress: string | null; // registered address and country
  contactEmail: string; // for access, deletion and other requests
  hostingRegion: string | null; // where the site runs, e.g. "Mumbai, India"
  databaseRegion: string | null; // where the database lives
  transferMechanism: string | null; // e.g. "standard contractual clauses"
  supervisoryAuthority: string | null; // who to complain to
  minimumAge: number | null; // years
  analyticsRetention: string | null; // e.g. "25 months"
}

export const PRIVACY_FACTS: PrivacyFacts = {
  controllerName: null,
  controllerAddress: null,
  contactEmail: "hello@warmmap.world",
  hostingRegion: null,
  databaseRegion: null,
  transferMechanism: null,
  supervisoryAuthority: null,
  minimumAge: null,
  analyticsRetention: null,
};

/** The sentences the page shows, from the facts. Never contains a bracket. */
export function privacyCopy(f: PrivacyFacts) {
  const who = f.controllerName
    ? `Warm Map is run by ${f.controllerName}${f.controllerAddress ? `, ${f.controllerAddress}` : ""}, a small project from the people at Zeyhi.`
    : "Warm Map is a small project from the people at Zeyhi, and they are responsible for what is described on this page.";
  const where =
    f.hostingRegion && f.databaseRegion
      ? `The site runs on Vercel in ${f.hostingRegion} and the database on Neon in ${f.databaseRegion}.`
      : f.hostingRegion || f.databaseRegion
        ? `Our hosting and database providers keep data in ${f.hostingRegion ?? f.databaseRegion}, and may process it elsewhere.`
        : "The site and its database are run by hosting providers (Vercel and Neon) that may process data outside your country.";
  const safeguards = f.transferMechanism
    ? `When data of people in the EU, the UK or elsewhere leaves their region we rely on ${f.transferMechanism}.`
    : "Where that happens we rely on the safeguards the law provides for such transfers.";
  return {
    who,
    where,
    safeguards,
    counts: f.analyticsRetention
      ? `Counts with no personal mark: ${f.analyticsRetention}.`
      : "Counts with no personal mark: kept as plain totals, with nothing that leads back to a person.",
    complaint: f.supervisoryAuthority
      ? `If you think we have got something wrong you can complain to ${f.supervisoryAuthority}, or to the data-protection authority in your own country.`
      : "If you think we have got something wrong you can complain to the data-protection authority in your own country.",
    children: f.minimumAge
      ? `Warm Map is not meant for anyone under ${f.minimumAge}.`
      : "Warm Map is not meant for children.",
  };
}
