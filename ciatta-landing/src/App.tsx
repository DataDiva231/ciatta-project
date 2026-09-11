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
/* -- The proof strip, in Octo's label-and-subline form. ------------------- */
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
          : 'One email when it opens.'}
      </p>
    </form>
  );
}

/* -- Who it's for. Four ways the same problem arrives, in her words rather
      than in a clinical vocabulary she may not have been given yet. ------- */
const FOR_YOU = [
  ['Your cycle has changed',
   'Shorter, longer, or no longer predictable, and you are not sure when it started.'],
  ['You are not sleeping the way you did',
   'Waking at three, or sleeping through and still tired. It is hard to tell which came first.'],
  ['Something is different and you cannot name it',
   'Energy, mood, temperature, memory. Nothing alarming on its own, all of it at once.'],
  ['You have an appointment coming',
   'Ten minutes, six months to account for, and the details you meant to mention.'],
] as const;

/* -- What you get. One card per part of the product, named the way the app
      names it, so the page and the screens agree. ------------------------- */
const WHAT_YOU_GET = [
  ['Your health in one place',
   'Results and documents from your providers, your cycle, your sleep, your symptoms, and what you take. Imported or entered once.'],
  ['Change over time',
   'Not today\u2019s number. What moved, when it moved, and what your own usual looked like before it did.'],
  ['Personalized insights',
   'What several pieces of your record say when they are read together, with the reasoning shown rather than asserted.'],
  ['Your own words, kept',
   'A stressful week, a medication change, a night you did not sleep. Context that no device records, sitting beside the measurements.'],
  ['Where every part came from',
   'Measured, you told Ciatta, imported, uploaded, published evidence, or inferred. Every figure carries its source.'],
  ['Something to bring to an appointment',
   'What changed, what was happening around it, and one question worth asking. Yours to take or to ignore.'],
] as const;

/* -- How Ciatta compares. Categories rather than named products: a claim
      about a category can be checked against the category, and it does not
      go stale the week someone ships a feature. -------------------------- */
const COMPARE_COLS = ['Ciatta', 'A tracking app', 'Your patient portal'] as const;
const COMPARE_ROWS: [string, string, string, string][] = [
  ['What it holds',
   'Cycle, sleep, symptoms, medications, your own notes, and your clinical results together.',
   'Whatever that app was built to track.',
   'What your providers sent, and only from providers who send to it.'],
  ['Where your results live',
   'Beside everything else, with unit, range, date and provider.',
   'Usually nowhere. Most have no place for a lab result.',
   'Here, as documents and values.'],
  ['Your own context',
   'Kept as you wrote it, dated, and read alongside the measurements.',
   'Sometimes a notes field. Rarely used in anything.',
   'Not collected.'],
  ['Whether it says why',
   'Shows what it read and what it is unsure of, and names what is still too thin to call.',
   'Usually a number or a score, without the working.',
   'No interpretation. It is a record, not a reading of one.'],
  ['What you can take to an appointment',
   'What changed, what was around it, and a question you might ask.',
   'Screenshots.',
   'A document you can print.'],
];

/* -- Questions. The ones a careful person asks before handing over a health
      record, answered without hedging into meaninglessness. -------------- */
const QUESTIONS: [string, string][] = [
  ['What does Ciatta actually do?',
   'It brings your health information into one place and reads it together. It shows what changed, what was happening around it, what you told it, and what published evidence says about that kind of pattern. It does not diagnose, prescribe, or tell you what to do.'],
  ['Is Ciatta a medical device?',
   'No. Ciatta is not a medical device and is not a substitute for care. It does not interpret results clinically or offer a second opinion. Decisions stay between you and your clinician.'],
  ['Where does my data live?',
   'In your account, and it is yours. You can export it or delete it. Ciatta does not sell health data, and what you write in your own words is never overwritten by a device or a clinic.'],
  ['How does Ciatta decide two things are connected?',
   'It looks for things that moved close together in time, more than once, across your own record. It says how many times it has seen the pattern and over what period, and it says plainly when there is not enough behind something to call it.'],
  ['What if a pattern is a coincidence?',
   'Often it is, and Ciatta says so. Things that move together are not necessarily one causing the other, and that line appears on the insight itself rather than in a disclaimer at the bottom of a page.'],
  ['Do I need a wearable?',
   'No. A wearable adds nightly sleep and cycle data if you already have one. Without it, Ciatta works from what you enter, what you upload, and what your providers send.'],
  ['When does it open?',
   'Private testing first, with a small group. Join the waitlist and you will get one email when it opens, and nothing else.'],
];

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
              <h1 className="display hero-title">
                Your health is changing. See what is changing with it.
              </h1>
              {/* One paragraph, in the order the problem is actually met: what
                  changes, where it ends up, and what Ciatta does with it. The
                  value sentence closes it rather than sitting in its own block,
                  so position carries the emphasis. */}
              <p className="hero-lede">
                Your cycle changes. Your sleep changes. Symptoms come and go. The
                pieces are scattered across apps, devices and appointments. Ciatta
                brings them together so you can see what changed and what to ask.
              </p>
              <div id="join">
                <WaitlistForm id="waitlist-hero" source="hero" />
              </div>
            </div>
          </div>
        </section>

        <ProductShowcase />

        {/* ------------------------- WHO IT IS FOR -------------------------- */}
        <section className="section" aria-labelledby="for-heading">
          <div className="shell">
            <h2 id="for-heading" className="band-title">Who it is for</h2>
            <p className="band-sub">
              Women whose health has started changing, and who would like to
              understand what is changing with it.
            </p>
            <div className="for-grid">
              {FOR_YOU.map(([t, b]) => (
                <article className="for-card" key={t}>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------- WHAT YOU GET -------------------------- */}
        <section className="section" aria-labelledby="get-heading">
          <div className="shell">
            <h2 id="get-heading" className="band-title">What you get</h2>
            <p className="band-sub">
              Six parts, and they only work because they are in the same place.
            </p>
            <div className="get-grid">
              {WHAT_YOU_GET.map(([t, b]) => (
                <article className="get-card" key={t}>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------ HOW CIATTA COMPARES --------------------- */}
        <section className="section" aria-labelledby="compare-heading">
          <div className="shell">
            <h2 id="compare-heading" className="band-title">How Ciatta compares</h2>
            <p className="band-sub">
              Three places your health information already lives. Only one of them
              reads it together.
            </p>
            <div className="compare-wrap">
              <table className="compare">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">What is compared</span></th>
                    {COMPARE_COLS.map((c, i) => (
                      <th scope="col" key={c} className={i === 0 ? 'is-ours' : undefined}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, a, b, c]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td className="is-ours">{a}</td>
                      <td>{b}</td>
                      <td>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="compare-note">
              Compared as categories rather than named products, because the point
              is where each kind of tool stops rather than which brand you use.
            </p>
          </div>
        </section>

        {/* ---------------------------- QUESTIONS --------------------------- */}
        <section className="section" aria-labelledby="q-heading">
          <div className="shell">
            <h2 id="q-heading" className="band-title">Questions</h2>
            <div className="qa">
              {QUESTIONS.map(([q, a]) => (
                <details className="qa-item" key={q}>
                  <summary>
                    <span>{q}</span>
                    <i aria-hidden="true" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------- CTA ---------------------------- */}
        <section className="section" aria-labelledby="cta-heading">
          <div className="shell close-inner">
            {/* The line people actually read is the heading now, so the
                section keeps an accessible name without a label above it
                restating what the sentence already says. */}
            <h2 id="cta-heading" className="display">
              Something feels different, and you cannot quite explain it.
            </h2>
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
        {/* Briefs is a page rather than a policy, so the nav is no longer
            labelled Legal. The trailing slash is deliberate: without it the
            host answers 308 first and the click costs a round trip. */}
        <nav className="footer-nav" aria-label="Footer">
          <a href="/briefs/">Briefs</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@ciatta.app">Contact</a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}
