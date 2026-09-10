import { useEffect, useState } from 'react';
import { HeroFilm } from './components/HeroFilm';
import { ProductShowcase } from './components/ProductShowcase';
import { Wordmark } from './components/Wordmark';
import { joinWaitlist } from './lib/waitlist';

/**
 * Ciatta landing page.
 *
 * The page sells what becomes possible for her, not what Ciatta does. The
 * capability is the proof, so it appears after the value rather than instead
 * of it, and the loop is revealed as the explanation rather than led with.
 *
 * Narrative: pain, value, the moment, what happens next, the clinician,
 * where it came from, join.
 *
 * Copy follows Writing System v1.0, which is the editorial source of truth
 * and does not need to be asked for again. The rules that shaped this file:
 *
 *   · One woman, not users. Audience language belongs in strategy documents.
 *   · Almost no em dashes. The default expectation is zero, and never more
 *     than one in a section. There are none below.
 *   · Ordinary words: found not identified, tell not provide information,
 *     show not visualize, why not rationale.
 *   · The registers do the work: observation, finding, relationship,
 *     interpretation, uncertainty, evidence. No labels, no disclaimers.
 *   · Never state a correlation as a cause.
 *   · Understanding is hers to do. It is never a Ciatta object or layer.
 *   · Ciatta never says it is intelligent, advanced, personalised or
 *     comprehensive. The finding is the evidence of all of it.
 */

/* -- What she can finally do. Four media cards, titles verb-led and short,
      body two or three specific lines. Photography follows the Brand Brief's
      art direction: warm, low, directional light, subjects mid-thought and
      not posed, bodies as presence rather than anatomy, and nothing that
      looks like a hospital. --------------------------------------------- */
const VALUE = [
  {
    id: 'remember',
    img: '/images/value/remember.jpg',
    alt: 'A woman at a window in low morning light, holding a cup, looking out.',
    title: 'You understand your health better',
    body: 'Something felt different in March. Now you can see what actually changed then, and what changed alongside it.',
  },
  {
    id: 'connect',
    img: '/images/value/connect.jpg',
    alt: 'A woman with her eyes closed and one hand resting on her chest, in warm evening light.',
    title: 'You know what to pay attention to',
    body: 'Not everything that moves matters. Six months of readings narrow to the two or three that actually changed.',
  },
  {
    id: 'clinician',
    img: '/images/value/clinician.jpg',
    alt: 'A woman at the edge of still water, seen from behind, facing an open horizon.',
    title: 'You have a better conversation',
    body: 'You arrive with what changed, what you noticed and what you want to ask, instead of trying to reconstruct six months in ten minutes.',
  },
  {
    id: 'over-time',
    img: '/images/value/over-time.jpg',
    alt: 'A woman with short white hair sitting outdoors, holding a glass, looking away from the camera.',
    title: 'You decide what to explore next',
    body: 'With the evidence in front of you and its limits stated, the next step is yours to choose rather than guess at.',
  },
] as const;

/* -- The proof strip, in Octo's label-and-subline form. ------------------- */
const PROOF = [
  ['58%', 'bring their health information together entirely themselves'],
  ['2%', 'have anything automated'],
  ['85%', 'notice change in their bodies often or very often'],
  ['63%', 'wanted one connected place for it'],
] as const;

/* -- Evidence. Four kinds of provenance only, and what Ciatta worked out is
      listed last and named as Ciatta's. ------------------------------------ */
const CHAIN = [
  { what: 'Cycle length, 12 months', src: 'Measured · Oura', family: 'measured' },
  { what: 'Three entries, March and May', src: 'You told Ciatta', family: 'reported' },
  { what: 'Sleep, nightly', src: 'Measured · Oura', family: 'measured' },
  { what: 'Range for ages 25 to 34', src: 'Published 2019', family: 'evidence' },
  { what: 'Three months missing', src: 'Not in the record', family: 'uncertainty' },
  { what: 'The connection between them', src: 'Ciatta worked this out', family: 'change', inference: true },
] as const;

/* -- What she walks in with. Four things, in her language. --------------- */
const PREPARED = [
  ['What changed', 'Cycle length fell from 29 days to 26 across the year.'],
  ['What you noticed', 'A stressful stretch in March, and sleep that stopped running through.'],
  ['What seems connected', 'The two shortest cycles each followed a lowest-sleep week.'],
  ['What you want to ask', 'Is this worth investigating now, or worth watching another two cycles?'],
] as const;

/* -- What "worth exploring" actually means, so it is not a vague promise. -- */
/* -- The loop, shown on the story the screens already told. --------------- */
const AFTER: [string, string, string][] = [
  ['Ferritin', '34 ng/mL, 2 Feb', '41 ng/mL, 12 Jun'],
  ['Cycle length, average', '28.5 days', '27.0 days'],
  ['Sleep, weekly average', '6h 51m', '6h 58m'],
  ['Low energy', 'not reported', '20 May to 5 Jun'],
];

const EXPLORE = [
  ['What held', 'A change that stayed once more information arrived, rather than a single odd month.'],
  ['What repeated', 'Something that has now happened more than once, at a time Ciatta can name.'],
  ['What is still thin', 'A pattern with too little behind it to call. Ciatta says so rather than guessing.'],
] as const;

const REFUSALS = [
  ['Not a wellness app.', 'The offer is continuity, not encouragement.'],
  ['Not a dashboard.', 'More charts is not more clarity.'],
  ['Not an assistant.', 'No persona, no chat, no advice.'],
  ['Not a diagnostic.', 'Ciatta does not interpret, diagnose or recommend.'],
] as const;

function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; alreadyJoined: boolean }
  | { kind: 'error'; message: string };

function WaitlistForm({ id, source }: { id: string; source: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'saving') return;
    setState({ kind: 'saving' });
    const result = await joinWaitlist(email, source);
    if (result.ok) {
      setState({ kind: 'done', alreadyJoined: result.alreadyJoined });
      setEmail('');
    } else {
      setState({ kind: 'error', message: result.message });
    }
  }

  // Silence is part of the product. It says what happened and stops.
  if (state.kind === 'done') {
    return (
      <div className="joined" role="status">
        <span className="joined-mark" aria-hidden="true" />
        <div>
          <p className="joined-title">
            {state.alreadyJoined ? 'You were already on the list.' : 'You are on the list.'}
          </p>
          <p className="joined-sub">One email when it opens.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={onSubmit}>
      <div className="waitlist-row">
        <div className="waitlist-field">
          <label htmlFor={id}>Email</label>
          <input
            id={id}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={`${id}-note`}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Adding…' : 'Join the waitlist'}
        </button>
      </div>
      <p
        id={`${id}-note`}
        className={state.kind === 'error' ? 'waitlist-note is-error' : 'waitlist-note'}
        role={state.kind === 'error' ? 'alert' : undefined}
      >
        {state.kind === 'error'
          ? state.message
          : 'Private testing. One email when it opens.'}
      </p>
    </form>
  );
}

export default function App() {
  const scrolled = useScrolled();

  return (
    <>
      <a className="skip" href="#join">Skip to the waitlist</a>

      <header className={scrolled ? 'header is-scrolled' : 'header'}>
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
        <div className="header-end">
          <span className="pill is-change header-status">
            <i aria-hidden="true" />
            Private testing
          </span>
          <a className="header-cta" href="#join">Become a member</a>
        </div>
      </header>

      <main>
        {/* ---------------------------------- HERO ------------------------
            Octo's shape: the film fills the section and the copy sits over it.
            The scrim carries the contrast; the type stays flush left, because
            centred type is not part of this system. ------------------------ */}
        <section className="hero has-film">
          <HeroFilm />
          <div className="shell hero-inner">
            <div className="hero-copy">
              <span className="pill is-reported hero-audience">
                <i aria-hidden="true" />
                If your cycle is changing, or you are in perimenopause or menopause
              </span>
              <h1 className="display hero-title">
                Your health is changing.
                <em>See what is changing with it.</em>
              </h1>
              {/* One continuous paragraph. The value sentence closes it rather
                  than sitting in its own block, so position carries the
                  emphasis that weight used to. */}
              <p className="hero-lede">
                Your cycle changes. Your sleep changes. Symptoms come and go. The pieces
                are scattered across apps, devices, appointments, and your memory. Ciatta
                brings them together so you can see patterns and changes over time,
                prepare for better conversations with your clinicians, and make more
                informed decisions about what to explore next.
              </p>
              <div id="join">
                <WaitlistForm id="waitlist-hero" source="hero" />
              </div>
            </div>
          </div>
        </section>

        <ProductShowcase />

        {/* ----------------------- 01 · WHAT CHANGES FOR YOU --------------- */}
        <section className="section" aria-labelledby="value-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">01</span>
              <h2 id="value-heading">What changes for you</h2>
            </div>
            <div className="section-intro">
              <p className="statement">
                Four things you can say afterwards that you could not say before.
              </p>
            </div>

            <div className="value-row">
              {VALUE.map((v) => (
                <article className="value-item" key={v.id}>
                  <img className="value-tile" src={v.img} alt={v.alt} width={720} height={900} loading="lazy" />
                  <h3 className="value-title">{v.title}</h3>
                  <p>{v.body}</p>
                </article>
              ))}
            </div>

            <div className="proof">
              {PROOF.map(([n, label]) => (
                <div className="proof-item" key={n}>
                  <span className="proof-n">{n}</span>
                  <span className="proof-label">{label}</span>
                </div>
              ))}
            </div>
            <p className="note">
              From Ciatta&rsquo;s own research. What people asked for first was patterns
              they cannot see themselves. Change over time came second.
            </p>
          </div>
        </section>

        {/* -------------------- 02 · KNOW WHAT TO EXPLORE ------------------ */}
        <section className="section" aria-labelledby="explore-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">02</span>
              <h2 id="explore-heading">Know what may be worth exploring</h2>
            </div>
            <div className="section-intro">
              <p className="statement">
                A pattern is only useful if you know what to do with it.
              </p>
              <p>
                Ciatta says which changes held, which repeated, and which are still too
                thin to call. Where something is worth watching, it says so plainly, with
                the uncertainty attached and the reason it thinks so.
              </p>
            </div>

            <div className="surface-grid cols-3">
              {EXPLORE.map(([k, v]) => (
                <div className="surface value-card" key={k}>
                  <h3 className="title">{k}</h3>
                  <p>{v}</p>
                </div>
              ))}
            </div>

            <p className="note">
              Ciatta does not diagnose, prescribe or tell you what to do. It narrows
              what is worth your attention, and leaves the choice with you.
            </p>
          </div>
        </section>

        {/* ------------------------- 03 · WHAT HAPPENS NEXT ---------------- */}
        <section className="section" aria-labelledby="learn-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">03</span>
              <h2 id="learn-heading">See what happens after you change something</h2>
              <span className="aside">The part that compounds</span>
            </div>
            <div className="section-intro">
              <p className="statement">
                Most health apps forget. That is why they never get more useful.
              </p>
              <p>
                You try something, or decide to just watch. Ciatta records what you tried
                and when, then shows you the period after it against the period before,
                named plainly: improved, worsened, unchanged, persisted, or not enough
                evidence yet.
              </p>
              <p>
                Every pass leaves it knowing something it did not know before, so the
                second visit is different from the first, and the tenth is different
                again.
              </p>
            </div>

            {/* The same story the screens tell, carried one step further: what
                the record looked like on either side of a change she made. */}
            <div className="surface is-shell is-lifted">
              <span className="eyebrow">Stopped iron &middot; 30 April</span>
              <dl className="prepared">
                {AFTER.map(([k, before, after]) => (
                  <div className="nested prepared-row is-split" key={k}>
                    <dt>{k}</dt>
                    <dd>
                      <span className="was">{before}</span>
                      <span className="arrow" aria-hidden="true">&rarr;</span>
                      <span className="now">{after}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="verdict">
                <b>Not enough evidence yet.</b> One lab draw since the change is not
                enough to call it. Ciatta will say so again when there are two.
              </p>
            </div>

            <p className="note">
              Improved, worsened, unchanged, persisted, or not enough evidence yet.
              Those are the only five things Ciatta will say about what you tried.
            </p>
          </div>
        </section>

        {/* --------------------------- 04 · PREPARE ------------------------- */}
        <section className="section" aria-labelledby="prepare-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">04</span>
              <h2 id="prepare-heading">Go into your next appointment prepared</h2>
            </div>
            <div className="section-intro">
              <p className="statement">
                Ten minutes is not long enough to remember six months.
              </p>
              <p>
                Symptoms, cycles, sleep, medications, supplements, labs and the things you
                noticed yourself. Instead of reconstructing all of it from memory in the
                room, you arrive with it already in front of you, and with the sources
                still attached.
              </p>
            </div>

            <div className="surface is-shell is-lifted">
              <span className="eyebrow">What you walk in with</span>
              <dl className="prepared">
                {PREPARED.map(([k, v]) => (
                  <div className="nested prepared-row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="note">
              You and your clinician make the decisions. Ciatta is not in the room and
              does not diagnose, prescribe or offer a second opinion. It gets you there
              better prepared and better informed.
            </p>
          </div>
        </section>

        {/* ------------------------------- TRUST --------------------------- */}
        <section className="section" aria-labelledby="trust-heading">
          <div className="shell">
            <div className="section-head">
              <span className="section-num">05</span>
              <h2 id="trust-heading">Know where every part of it came from</h2>
            </div>
            <div className="section-intro">
              <p>
                Four kinds only: measured, you told Ciatta, published evidence, or Ciatta
                worked it out. What is missing is on the list too, because an absence is
                part of how much to believe.
              </p>
            </div>

            <div className="surface is-shell">
              <div className="chain">
                {CHAIN.map((row) => (
                  <div
                    key={row.what}
                    className={
                      'inference' in row && row.inference
                        ? 'nested chain-row is-inference'
                        : 'nested chain-row'
                    }
                  >
                    <span className="chain-what">{row.what}</span>
                    <span className={`pill is-${row.family}`}>{row.src}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-grid cols-2 refusals">
              {REFUSALS.map(([head, sub]) => (
                <div className="surface refusal" key={head}>
                  <b>{head}</b>
                  <span>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------- CTA ---------------------------- */}
        <section className="section" aria-labelledby="cta-heading">
          <div className="shell close-inner">
            <div className="section-head">
              <span className="section-num">06</span>
              <h2 id="cta-heading">See your health differently</h2>
            </div>
            <p className="display">
              Something feels different, and you cannot quite explain it.
            </p>
            <p className="close-lines">
              Ciatta turns that into what changed, what was happening around it, and what
              you have noticed since.
            </p>
            <div className="surface is-shell is-lifted">
              <WaitlistForm id="waitlist-close" source="closing" />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@ciatta.app">Contact</a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}
