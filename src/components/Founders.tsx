import Image from "next/image";

const founders = [
  {
    name: "Aadarsh K S",
    linkedin: "https://www.linkedin.com/in/aadarsh-k-s/",
    photo: "/aadarsh.png",
  },
  {
    name: "Abhijith Harikumar",
    linkedin: "https://www.linkedin.com/in/abhijithharikumar-gtm/",
    photo: "/abhijith.png",
  },
  {
    name: "Arjun Aravind",
    linkedin: "https://www.linkedin.com/in/arjun-aravind-708647125/",
    photo: "/arjun.png",
  },
];

export function Founders() {
  return (
    <section className="page chapter founders">
      <p className="kicker">Why we built this</p>
      <blockquote className="founders-quote">
        We are living in the world of campaigns, MQLs, meetings, cold emails,
        GTM, and somewhere along the way we missed the freshness of warm
        meetings, warm intros and humane interactions. We are trying to bring
        it back. This is our story.
      </blockquote>

      <div className="founders-grid">
        {founders.map((f) => (
          <a
            key={f.name}
            href={f.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="founder-card"
          >
            <div className="founder-photo">
              <Image
                src={f.photo}
                alt={f.name}
                width={120}
                height={120}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>
            <p className="founder-name">{f.name}</p>
            <span className="founder-link">LinkedIn</span>
          </a>
        ))}
      </div>
    </section>
  );
}
