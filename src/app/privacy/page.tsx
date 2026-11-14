import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Warm Map handles names, cities and your map.",
};

export default function PrivacyPage() {
  return (
    <main className="page chapter">
      <p className="kicker">Privacy</p>
      <h1>Your friends&apos; names stay with you</h1>

      <h2>What we store when you tap Show me</h2>
      <ul className="moments">
        <li>your first name and the city you call home</li>
        <li>the cities your lanterns are in, and which question each one answered</li>
        <li>a fingerprint of your map&apos;s key (never the key itself)</li>
      </ul>
      <p>
        Anyone with your map&apos;s link sees your first name, your home city and the cities, sorted by name. They never see which question a
        city answered, or which lanterns are gold.
      </p>

      <h2>What we never store</h2>
      <p>
        The names you type stay in this browser. A thank-you link is made on your phone; we keep only a fingerprint of it and which lantern it
        points to. The name in the link sits after the # sign, which browsers never send to us.
      </p>

      <h2>When a friend ties it back</h2>
      <p>
        One tap turns your lantern gold. We keep the tap, a fingerprint of the friend&apos;s device (different for every map) and of their
        connection (changed every day), so nobody can tap a hundred times. No e-mail, no name.
      </p>

      <h2 id="delete">Delete my map</h2>
      <p>
        Open your map from its key (the link you sent yourself) and tap Delete my map. It is deleted for good: every lantern, every
        thread, every thank-you link and every gold lantern.
      </p>

      <h2>Cookies</h2>
      <p>
        None for tracking. This browser keeps your names, your draft and your map&apos;s key in its own storage. We count visits and taps on
        our own server, with no names and no third-party analytics.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Write to <a href="mailto:hello@warmmap.world">hello@warmmap.world</a>.
      </p>
    </main>
  );
}
