import { WarmMapGame } from "@/components/WarmMapGame";
import { Founders } from "@/components/Founders";
import { ShareCTA } from "@/components/ShareCTA";
import { Marquee } from "@/components/Marquee";
import { FinalCTA } from "@/components/FinalCTA";

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
      </header>

      <main>
        <Founders />

        <section className="plate" id="corner">
          <WarmMapGame />
        </section>

        <section className="page chapter table-pitch">
          <p className="kicker">Where the map leads</p>
          <h2>The Warm Table</h2>
          <p className="dropcap">
            Once a map has enough warmth, it becomes a table. Fourteen people,
            one long dinner, no pitches, no performances. Just the kind of
            conversations that used to happen over a shared meal and a second
            cup of tea.
          </p>
          <p>
            We are starting in a handful of cities. The vision is simple: bring
            back warm meetings, warm intros and humane interactions everywhere.
            City by city. Table by table. Until the old feeling of trust is
            normal again.
          </p>

          <div className="tableplate compact">
            <svg
              viewBox="0 0 480 360"
              role="img"
              aria-label="A long table seen from above with fourteen seats"
              style={{ width: "100%", height: "auto", maxWidth: 360 }}
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
            <div className="legend compact-legend">
              <div>
                <span style={{ background: "#B9741F" }} />
                Super connectors
              </div>
              <div>
                <span style={{ background: "#2E2219" }} />
                Most vouched
              </div>
              <div>
                <span style={{ background: "#F1E6CF" }} />
                Newcomers
              </div>
            </div>
          </div>
        </section>

        <ShareCTA />

        <Marquee />

        <FinalCTA />
      </main>

      <footer>
        <span>Names stay with you until that person says yes.</span>
        <span>
          <a href="/privacy">Privacy</a> · Made with care by the Warm Map team.
        </span>
      </footer>
    </>
  );
}
