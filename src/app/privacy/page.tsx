import type { Metadata } from "next";
import { PrivacyDelete } from "@/components/PrivacyDelete";
import { PRIVACY_FACTS, privacyCopy } from "@/lib/privacy-facts";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Warm Map handles names, cities and your map.",
};

// GDPR wording drafted 18 Nov 2026 from build/DATA-INVENTORY-2026-11-18.md; not legal advice.
// Facts live in src/lib/privacy-facts.ts. A fact left null falls back to generic wording,
// so no placeholder text can reach the page.
export default function PrivacyPage() {
  const c = privacyCopy(PRIVACY_FACTS);
  const email = PRIVACY_FACTS.contactEmail;
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
        Open your map from its key (the link you sent yourself) and tap Delete my map, then confirm. It is deleted for good: every lantern,
        every thread, every thank-you link and every gold lantern, on our server, at once. This browser then forgets the key, your
        friends&apos; names and your draft.
      </p>
      <PrivacyDelete />
      <p>
        Lost your key? Write to <a href={`mailto:${email}`}>{email}</a> from any address with your map&apos;s link and
        we will delete it.
      </p>

      <h2>Cookies</h2>
      <p>
        None, for visitors. This browser keeps your names, your draft, your map&apos;s key and a random number that tells your device apart
        for the limits above, all in its own storage. We count taps on our own server, with no names and no third-party analytics.
      </p>

      <h2>Who is responsible</h2>
      <p>
        {c.who} For the purposes of data-protection law (including the GDPR), that makes them the controller of what is described on
        this page.
      </p>

      <h2>What we collect, and why</h2>
      <ul style={{ listStyle: "disc", paddingLeft: "1.2em" }}>
        <li>
          <strong>Your map</strong>: your first name, your home city, the cities of your lanterns and which question each answered, a
          fingerprint of your map&apos;s key, and when it was made. We use it to make and show your map, because you asked us to (contract:
          providing the service you requested).
        </li>
        <li>
          <strong>Thank-you links and ties</strong>: a fingerprint of each link, the lantern it points to, when it expires, and, when a
          friend taps Tie it back, a fingerprint of their device (different on every map) and of their connection (changed every day). We
          use it so a link works once and cannot be tapped a hundred times (legitimate interests: keeping the service honest and safe).
        </li>
        <li>
          <strong>Limits against misuse</strong>: counters keyed by a fingerprint of your device and of your connection, kept for about two
          days (legitimate interests: security and abuse prevention).
        </li>
        <li>
          <strong>Counts</strong>: a few taps and steps (for example, that someone started, or shared). Most are plain totals with no
          name and no device or connection mark. A few are kept with your map: how many times its link was opened and from which kind
          of link, and when you saw a new gold lantern. They carry no device or connection mark and no friend&apos;s name (legitimate
          interests: knowing whether the service works).
        </li>
        <li>
          <strong>What the people who run Warm Map can see</strong>: in a private, password-protected view, each map&apos;s first name,
          home city and date, next to its counts: lanterns and cities, thank-you links sent, lanterns tied back, how often its link was
          opened (per day), and how many maps it led to (per day, not which ones). We use this to understand how Warm Map spreads and to
          rank maps by how much warmth they pass on. Never your friends&apos; names, which we do not have, and never a device or
          connection mark (legitimate interests: knowing whether the service works and improving it).
        </li>
      </ul>
      <p>
        We do not ask for your e-mail address, we have no accounts, and we use no third-party analytics or advertising. Your friends&apos;
        names stay in your browser; we do not receive them. We do not need your consent for any of the above, so there is nothing to
        accept. If we ever add something that does need it, we will ask first.
      </p>

      <h2>How long we keep it</h2>
      <ul style={{ listStyle: "disc", paddingLeft: "1.2em" }}>
        <li>Your map, its thank-you links and ties: until you delete your map.</li>
        <li>Limit counters: about two days.</li>
        <li>Counts kept with your map: until you delete your map.</li>
        <li>{c.counts}</li>
        <li>Hosting providers keep their own technical logs, under their own terms.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of what we hold about you (access), to correct it (rectification), to delete it (erasure), to limit it or
        object to how we use it, and to receive it in a portable format. You can delete your own map yourself, at any time, as described
        above. For anything else write to the address below; we aim to answer within one month. {c.complaint}
      </p>

      <h2>Where it is kept</h2>
      <p>
        {c.where} {c.safeguards}
      </p>

      <h2>Children</h2>
      <p>
        {c.children} We do not knowingly keep a map made by a child; if you think one exists, write to us and we will delete it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Write to <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </main>
  );
}
