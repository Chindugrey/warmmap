import { CornerFlow } from "@/components/CornerFlow";

// The page is the game: the hero turns into question one. The rest of the
// landing sits below the hero and goes away once the map is under way.
export default function Home() {
  return (
    <CornerFlow
      below={
        <>
          <section className="wm-sec">
            <p className="wm-fable">
              Every evening, someone on a veranda lights a lantern for someone far away. A thread runs from that lantern to the other one: Kochi
              to London, Pune to Toronto, two streets over. This is a map of those threads.
            </p>
          </section>
          <section className="wm-sec wm-how">
            <h2>How it works</h2>
            <p><b>Light.</b> Name the people who were there. One question at a time.</p>
            <p><b>Look.</b> See your map: how many people, how many cities, how far the thread runs.</p>
            <p><b>Thank.</b> Send a few of them a note, from your own phone. They can tie it back.</p>
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
          </footer>
        </>
      }
    />
  );
}
