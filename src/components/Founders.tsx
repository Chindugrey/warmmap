import Image from "next/image";

const founders = [
  {
    name: "Aadarsh",
    linkedin: "https://www.linkedin.com/in/aadarsh-k-s/",
    photo: "/aadarsh.png",
  },
  {
    name: "Abhijith",
    linkedin: "https://www.linkedin.com/in/abhijithharikumar-gtm/",
    photo: "/abhijith.png",
  },
  {
    name: "Arjun",
    linkedin: "https://www.linkedin.com/in/arjun-aravind-708647125/",
    photo: "/arjun.png",
  },
];

export function Founders() {
  return (
    <section className="page chapter founders-compact">
      <blockquote className="founders-quote-compact">
        We are living in the world of campaigns, MQLs, meetings, cold emails,
        and GTM. Somewhere along the way we missed the freshness of warm
        meetings, warm intros and humane interactions. We are trying to bring
        it back.
      </blockquote>

      <div className="founders-row">
        {founders.map((f) => (
          <a
            key={f.name}
            href={f.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="founder-chip"
          >
            <div className="founder-photo-sm">
              <Image
                src={f.photo}
                alt={f.name}
                width={64}
                height={64}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>
            <span className="founder-name-sm">{f.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
