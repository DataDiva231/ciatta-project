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
