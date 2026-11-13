import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Warm Map handles your names, cities and consent.",
};

export default function PrivacyPage() {
  return (
    <main className="page chapter">
      <p className="kicker">Privacy</p>
      <h1>Your names stay with you</h1>

      <p className="dropcap">
        Warm Map is built around a simple idea: trust travels by hand. That
        means we don&apos;t collect more than we need, and we never send a
        friend&apos;s name anywhere without a clear yes.
      </p>

      <h2>What we store</h2>
      <ul className="moments">
        <li>the city you call home</li>
        <li>the cities your lanterns are in</li>
        <li>counts of people, cities and countries</li>
        <li>whether you consented to share the map</li>
      </ul>

      <h2>What we don&apos;t store</h2>
      <p>
        The first names you type while making your map stay in your browser
        until you save or share. They are not sent to our server. When a friend
        sees their city on your map and chooses to vouch, only then do they
        choose what name, if any, to share.
      </p>

      <h2>Delete my map</h2>
      <p>
        You can delete any map you created from your dashboard at{" "}
        <a href="/me">/me</a>. Deleting marks the map as deleted in our
        database; share links stop working immediately.
      </p>

      <h2>Cookies and consent</h2>
      <p>
        We use a single local-storage flag to remember that you&apos;ve seen the
        consent banner. We do not use third-party analytics or advertising
        cookies. Warm Map is a quiet corner of the internet.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Write to{" "}
        <a href="mailto:hello@warmmap.world">hello@warmmap.world</a>.
      </p>
    </main>
  );
}
