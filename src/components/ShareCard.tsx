import type { ReactNode } from "react";

interface ShareCardProps {
  ownerName: string;
  stats: {
    people: number;
    cities: number;
    countries: number;
    km: number;
  };
  globe: ReactNode;
  domain?: string;
}

export function ShareCard({
  ownerName,
  stats,
  globe,
  domain = "warmmap.world",
}: ShareCardProps) {
  const title = ownerName ? `${ownerName}'s Warm Map` : "My Warm Map";

  return (
    <div className="mapcard">
      <div className="stamp" aria-hidden="true">
        WARM
        <br />
        MAP
      </div>
      <p className="pc-title">{title}</p>
      <p className="pc-sub">the people who&apos;d pick up</p>
      {globe}
      <div className="pc-stats">
        <div>
          <b>{stats.people}</b>
          <span>{stats.people === 1 ? "person" : "people"}</span>
        </div>
        <div>
          <b>{stats.cities}</b>
          <span>{stats.cities === 1 ? "city" : "cities"}</span>
        </div>
        <div>
          <b>{stats.countries}</b>
          <span>{stats.countries === 1 ? "country" : "countries"}</span>
        </div>
        <div>
          <b>{stats.km.toLocaleString("en-IN")}</b>
          <span>km of threads</span>
        </div>
      </div>
      <p className="pc-foot">
        Who&apos;s in your corner? · {domain}
      </p>
    </div>
  );
}
