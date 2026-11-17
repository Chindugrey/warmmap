import Image from "next/image";
import { CornerFlow } from "@/components/CornerFlow";

const FOUNDERS = [
  { name: "Aadarsh", photo: "/aadarsh.png", href: "https://www.linkedin.com/in/aadarsh-k-s/" },
  { name: "Abhijith", photo: "/abhijith.png", href: "https://www.linkedin.com/in/abhijithharikumar-gtm/" },
  { name: "Arjun", photo: "/arjun.png", href: "https://www.linkedin.com/in/arjun-aravind-708647125/" },
];

// The page is the game: the hero turns into question one. Below the hero, in
// order: the narrative, the founders, what we never do. They go away once the
// map is under way.
export default function Home() {
  return (
    <CornerFlow
      below={
        <>
          <section className="wm-sec wm-narr">
            <p>Think of the people who&apos;ve had your back: the 2am call, the first break, the hard truth.</p>
            <p>Each answer lights a lantern in their city. In five answers, you&apos;ll see how far your warmth reaches &mdash; and their names never leave your phone.</p>
            <p>Send each one a thank-you. When they tie it back, their lantern turns gold.</p>
          </section>
          <section className="wm-sec wm-founders" aria-labelledby="wm-fcap">
            <p className="wm-fcap" id="wm-fcap">Built by three people who kept meaning to say thank you.</p>
            <ul>
              {FOUNDERS.map((f) => (
                <li key={f.name}>
                  <a href={f.href} target="_blank" rel="noopener noreferrer">
                    <Image src={f.photo} alt="" width={72} height={72} />
                    <span>{f.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="wm-sec" id="never">
            <h2>What we never do</h2>
            <ul>
              <li>We never store your friends&apos; names. They stay on your device and in the messages you send.</li>
              <li>Names never appear in the picture or the link you share.</li>
              <li>We never post, message or tag anyone for you.</li>
              <li>We never sell or rent your data.</li>
              <li>You can delete your map with one tap, from your map&apos;s key.</li>
            </ul>
          </section>
          <footer className="wm-foot">
            Made with care in Bengaluru · <a href="/privacy">Privacy</a> · <a href="/privacy#delete">Delete my map</a>
            <br />A small project from the people at Zeyhi
            <br />
            City data © <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>,{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          </footer>
        </>
      }
    />
  );
}
