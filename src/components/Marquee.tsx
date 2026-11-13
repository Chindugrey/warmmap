import Image from "next/image";

const people = [
  { name: "Aadarsh", photo: "/aadarsh.png" },
  { name: "Abhijith", photo: "/abhijith.png" },
  { name: "Arjun", photo: "/arjun.png" },
  { name: "You next?", photo: "" },
];

export function Marquee() {
  // Duplicate a few times for a smooth infinite loop.
  const items = Array(6).fill(people).flat();

  return (
    <div className="marquee-section">
      <p className="kicker" style={{ textAlign: "center" }}>
        People building Warm Map
      </p>
      <div className="marquee">
        <div className="marquee-track">
          {items.map((p, idx) => (
            <div key={`${p.name}-${idx}`} className="marquee-item">
              {p.photo ? (
                <div className="marquee-photo">
                  <Image
                    src={p.photo}
                    alt={p.name}
                    width={40}
                    height={40}
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>
              ) : (
                <div className="marquee-photo placeholder">?</div>
              )}
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
