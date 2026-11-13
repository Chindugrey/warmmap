import { WarmMapGame } from "@/components/WarmMapGame";
import { Founders } from "@/components/Founders";

export default function Home() {
  return (
    <>
      <header className="plate hero">
        <p className="once">Warm Map · a small story about who you know</p>
        <h1>Who&apos;s in your corner?</h1>
        <p className="lede">
          Almost everything good in your life came through someone. Put those
          people on one warm globe, and share it with them.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <a className="btn" href="#corner">
            Make my Warm Map
          </a>
          <a className="btn ghost" href="#story">
            Read the story
          </a>
        </div>

        <svg
          className="veranda"
          viewBox="0 0 880 300"
          role="img"
          aria-label="An ink drawing of a lantern-lit veranda with arches, a low table and two cups of tea"
        >
          <g
            fill="none"
            stroke="#2E2219"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M40 270 H840" />
            <path d="M60 282 H820" strokeWidth={1.2} opacity={0.6} />
            <path d="M90 270 V120 M210 270 V120 M330 270 V120 M550 270 V120 M670 270 V120 M790 270 V120" />
            <path d="M90 120 Q150 50 210 120 M330 120 Q440 30 550 120 M670 120 Q730 50 790 120" />
            <path d="M210 120 Q270 70 330 120 M550 120 Q610 70 670 120" opacity={0.7} />
            <path d="M70 120 H810 M70 112 H810" opacity={0.8} />
            <path d="M150 60 V96 M440 40 V82 M730 60 V96" strokeWidth={1.2} />
            <path d="M380 236 H500 M392 236 V258 M488 236 V258" />
            <path d="M415 236 v-14 q0 -6 6 -6 h10 q6 0 6 6 v14 M437 224 q8 0 8 6 q0 6 -8 6" strokeWidth={1.6} />
            <path d="M455 236 v-12 q0 -5 5 -5 h9 q5 0 5 5 v12" strokeWidth={1.6} />
            <path d="M425 208 q4 -8 0 -14 M462 210 q4 -7 0 -12" strokeWidth={1.2} opacity={0.6} />
            <path d="M240 270 q20 -40 0 -70 M260 270 q30 -50 10 -90" strokeWidth={1.4} opacity={0.55} />
            <path d="M640 270 q-20 -40 0 -70 M620 270 q-30 -50 -10 -90" strokeWidth={1.4} opacity={0.55} />
          </g>
          <g>
            <circle cx={150} cy={108} r={26} fill="#E8A84A" opacity={0.22} className="flame" />
            <circle cx={440} cy={94} r={30} fill="#E8A84A" opacity={0.22} className="flame" />
            <circle cx={730} cy={108} r={26} fill="#E8A84A" opacity={0.22} className="flame" />
            <path
              d="M140 96 h20 l-4 22 h-12 z M430 82 h20 l-4 24 h-12 z M720 96 h20 l-4 22 h-12 z"
              fill="#B9741F"
              stroke="#2E2219"
              strokeWidth={1.5}
            />
          </g>
        </svg>

        <svg
          className="flourish"
          viewBox="0 0 220 24"
          aria-hidden="true"
        >
          <path
            d="M2 12 H86 M134 12 H218 M110 4 q-14 8 0 16 q14 -8 0 -16 z"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
          />
        </svg>
      </header>

      <main>
        <section id="story" className="page chapter">
          <p className="kicker">Chapter one</p>
          <h2>It always came through someone</h2>
          <p className="dropcap">
            Think back for a moment. Your first job. The flat you live in. The
            doctor you trust. The co-founder, the first customer, the person who
            said yes when nobody else would. Almost none of it began with a
            stranger&apos;s message. It began with someone who said, quietly,
            &quot;I know someone.&quot;
          </p>
          <ul className="moments" aria-label="Things that usually come through someone">
            <li>a first job</li>
            <li>a home</li>
            <li>a co-founder</li>
            <li>a first customer</li>
            <li>a mentor</li>
            <li>a second chance</li>
          </ul>
        </section>

        <div className="night">
          <section className="page chapter">
            <p className="kicker">Chapter two</p>
            <h2>Now everyone can reach everyone</h2>
            <p>
              Inboxes overflow. Feeds never sleep. Every message seems to be
              selling something, and every one of us has become someone&apos;s
              target. We have never had more ways to talk, or fewer people who&apos;ll
              pick up.
            </p>
          </section>
          <div className="plate noise" aria-hidden="true">
            <span style={{ left: "4%", top: "10%", transform: "rotate(-6deg)" }}>
              Quick question for you
            </span>
            <span style={{ left: "46%", top: "4%", transform: "rotate(3deg)" }}>
              Offer ends tonight
            </span>
            <span style={{ left: "70%", top: "34%", transform: "rotate(-4deg)" }}>
              Just bumping this up
            </span>
            <span style={{ left: "14%", top: "44%", transform: "rotate(5deg)" }}>
              Hi {"{first_name}"}, loved your post
            </span>
            <span style={{ left: "44%", top: "62%", transform: "rotate(-2deg)" }}>
              Can I get 15 minutes?
            </span>
            <span style={{ left: "4%", top: "80%", transform: "rotate(-5deg)" }}>
              Sponsored
            </span>
            <span style={{ left: "68%", top: "78%", transform: "rotate(6deg)" }}>
              Following up again
            </span>
          </div>
        </div>

        <section className="page chapter">
          <p className="kicker">Chapter three</p>
          <h2>But warmth still travels by hand</h2>
          <p className="dropcap">
            A few people would answer your call at two in the morning. They live
            in different cities, sometimes different countries. Together they&apos;re
            your corner. Light them up one lantern at a time, then send the map
            to them. When a friend finds their own lantern on it, they&apos;ll smile,
            vouch for you in one tap, and make a map of their own.
          </p>
        </section>

        <section className="plate">
          <WarmMapGame />
        </section>

        <section className="page chapter">
          <p className="kicker">Chapter four</p>
          <h2>The table</h2>
          <p className="dropcap">
            Once a month, in Bengaluru, Hyderabad and Delhi, fourteen people sit
            down to one long dinner. You can&apos;t buy a seat, and you can&apos;t apply.
            The friends who vouch for you bring you in.
          </p>
        </section>

        <section className="plate">
          <div className="tableplate">
            <svg
              viewBox="0 0 480 360"
              role="img"
              aria-label="A long table seen from above with fourteen seats: six gold for super connectors, six ink for the most vouched, two open for newcomers"
              style={{ width: "100%", height: "auto" }}
            >
              <defs>
                <radialGradient id="lamp2">
                  <stop offset="0%" stopColor="#E8A84A" />
                  <stop offset="100%" stopColor="#E8A84A" stopOpacity={0} />
                </radialGradient>
              </defs>
              <rect
                x={90}
                y={140}
                width={300}
                height={80}
                rx={40}
                fill="#E6D6B5"
                stroke="#2E2219"
                strokeWidth={2}
              />
              <circle cx={170} cy={180} r={12} fill="url(#lamp2)" />
              <circle cx={240} cy={180} r={12} fill="url(#lamp2)" />
              <circle cx={310} cy={180} r={12} fill="url(#lamp2)" />
              <g stroke="#2E2219" strokeWidth={1.8}>
                <circle cx={120} cy={110} r={15} fill="#B9741F" />
                <circle cx={180} cy={104} r={15} fill="#B9741F" />
                <circle cx={240} cy={102} r={15} fill="#B9741F" />
                <circle cx={300} cy={104} r={15} fill="#2E2219" />
                <circle cx={360} cy={110} r={15} fill="#2E2219" />
                <circle cx={120} cy={250} r={15} fill="#2E2219" />
                <circle cx={180} cy={256} r={15} fill="#2E2219" />
                <circle cx={240} cy={258} r={15} fill="#B9741F" />
                <circle cx={300} cy={256} r={15} fill="#B9741F" />
                <circle cx={360} cy={250} r={15} fill="#B9741F" />
                <circle cx={62} cy={180} r={15} fill="#2E2219" />
                <circle cx={418} cy={180} r={15} fill="#2E2219" />
                <circle cx={60} cy={122} r={15} fill="#F1E6CF" />
                <circle cx={420} cy={238} r={15} fill="#F1E6CF" />
              </g>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="legend">
                <div>
                  <span style={{ background: "#B9741F" }} />
                  6 super connectors, invited by hand
                </div>
                <div>
                  <span style={{ background: "#2E2219" }} />
                  6 people their friends vouched for most
                </div>
                <div>
                  <span style={{ background: "#F1E6CF" }} />
                  2 newcomers
                </div>
              </div>
              <p className="quiet">
                No pitching. Pitch, and you buy dessert. Phones sleep in a basket
                until the end.
              </p>
            </div>
          </div>
        </section>

        <section className="page chapter" style={{ paddingTop: 40 }}>
          <h3 style={{ fontSize: 30 }}>How the evening goes</h3>
          <ol className="games">
            <li>
              <time>7:00</time>
              <span>
                <b>Hello bingo.</b> Find the person who was someone&apos;s 2 a.m.
                call.
              </span>
            </li>
            <li>
              <time>7:30</time>
              <span>
                <b>Introduce your neighbour.</b> You speak for them; they speak
                for you.
              </span>
            </li>
            <li>
              <time>7:50</time>
              <span>
                <b>Two truths and an ask.</b> Said out loud, kept small.
              </span>
            </li>
            <li>
              <time>8:10</time>
              <span>
                <b>Pass the door.</b> Your ask travels round the table on a card.
                Whoever can open it stamps it, and a little printer prints the
                slip.
              </span>
            </li>
            <li>
              <time>8:40</time>
              <span>
                <b>Who&apos;s your hello?</b> A city is called. The first real name
                wins.
              </span>
            </li>
            <li>
              <time>8:55</time>
              <span>
                <b>The mystery seat.</b> One guest was a surprise all along.
              </span>
            </li>
            <li>
              <time>9:10</time>
              <span>
                <b>The receipt.</b> Everyone in the photo, holding one long strip
                of paper.
              </span>
            </li>
          </ol>
        </section>

        <section className="page chapter">
          <p className="kicker">Chapter five</p>
          <h2>And it was written down</h2>
          <p className="dropcap">
            Every door that opens at the table is printed that night. Thirty days
            later we print a second slip: the coffees, the interviews, the
            meetings that actually happened. We count doors, never likes.
          </p>
          <div className="slip" role="img" aria-label="A sample receipt from a table">
            <div className="c">
              <b>WARM TABLE</b>
            </div>
            <div className="c">Bengaluru · Table No. 1</div>
            <hr />
            <div className="l">
              <span>Guests</span>
              <span>14</span>
            </div>
            <div className="l">
              <span>Doors stamped</span>
              <span>[N]</span>
            </div>
            <div className="l">
              <span>Coffees</span>
              <span>[N]</span>
            </div>
            <div className="l">
              <span>Interviews</span>
              <span>[N]</span>
            </div>
            <hr />
            <div className="l">
              <b>Held in 30 days</b>
              <b>[N]</b>
            </div>
            <hr />
            <div className="c">No pitching. Only warmth.</div>
          </div>
          <p className="note" style={{ textAlign: "center" }}>
            A template. Real tables print real numbers.
          </p>
        </section>

        <section className="page chapter epilogue">
          <p className="kicker">The end, or the beginning</p>
          <h2>Your people are waiting to hear it</h2>
          <p>
            Two minutes. Twelve small questions. One map worth sharing, and maybe
            a seat at the table.
          </p>
          <a className="btn" href="#corner">
            Make my Warm Map
          </a>
          <svg
            className="flourish"
            viewBox="0 0 220 24"
            aria-hidden="true"
          >
            <path
              d="M2 12 H86 M134 12 H218 M110 4 q-14 8 0 16 q14 -8 0 -16 z"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
            />
          </svg>
        </section>
      </main>

      <Founders />

      <footer>
        <span>Bengaluru · Hyderabad · Delhi</span>
        <span>
          Names stay with you until that person says yes. Nothing is ever sent
          for you.
        </span>
        <span>
          <a href="/privacy">Privacy</a> · Made with care by the Zeyhi team.
        </span>
      </footer>
    </>
  );
}
