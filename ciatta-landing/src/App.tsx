import { useEffect, useRef, useState } from 'react';
import { SilhouetteFigure } from './components/SilhouetteFigure';
import { joinWaitlist } from './lib/waitlist';

const INSIGHTS = [
  {
    id: 'sleep',
    domain: 'Sleep',
    color: '#5B4B7A',
    strength: 88,
    text: 'You slept under six hours four nights this week. Energy scores fell the next day every time.',
  },
  {
    id: 'recovery',
    domain: 'Recovery',
    color: '#6AA5CB',
    strength: 79,
    text: 'Resting heart rate ran high three mornings, always the day after short sleep.',
  },
  {
    id: 'cycle',
    domain: 'Cycle',
    color: '#F27D72',
    strength: 44,
    text: 'Low energy days cluster before your period, not on low step count days.',
  },
  {
    id: 'energy',
    domain: 'Energy',
    color: '#F6C76B',
    strength: 62,
    text: 'Steps stayed steady, but mood check ins dipped on the two days you moved least.',
  },
  {
    id: 'mood',
    domain: 'Mood',
    color: '#181818',
    strength: 71,
    text: 'When you felt flat, sleep debt was present the night before in four of five cases.',
  },
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

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
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

  if (state.kind === 'done') {
    return (
      <div className="joined" role="status">
        <span className="joined-mark" aria-hidden="true" />
        <div>
          <p className="joined-title">
            {state.alreadyJoined ? "You're already on the list." : "You're on the list."}
          </p>
          <p className="joined-sub">We'll write before launch, and not before.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={onSubmit} noValidate={false}>
      <label className="sr-only" htmlFor={id}>Email address</label>
      <div className="waitlist-row">
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
        <button type="submit" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Adding…' : 'Join wait list'}
        </button>
      </div>
      <p id={`${id}-note`} className="waitlist-note" role={state.kind === 'error' ? 'alert' : undefined}>
        {state.kind === 'error' ? state.message : 'No spam. One email when it opens.'}
      </p>
    </form>
  );
}

export default function App() {
  const [activeInsight, setActiveInsight] = useState(0);
  const insightsReveal = useReveal<HTMLElement>();
  const careReveal = useReveal<HTMLElement>();
  const scrolled = useScrolled();
  const insight = INSIGHTS[activeInsight];

  return (
    <>
      <a className="skip" href="#waitlist">Skip to the wait list</a>

      <header className={scrolled ? 'header is-scrolled' : 'header'}>
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <img src="/images/wordmark.png" alt="Ciatta" className="header-logo" width={108} height={31} />
        </a>
        <div className="header-end">
          <span className="header-status">
            <span className="header-status-dot" aria-hidden="true" />
            Private testing
          </span>
          <a className="header-cta" href="#join">Join wait list</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">
                Your health is telling a bigger story.
                <em> Ciatta helps you see it.</em>
              </h1>
              <p className="hero-lede">
                Your health information is scattered across apps, devices,
                appointments, and life. Ciatta brings it together, connects what
                matters, and shows you what's changing.
              </p>
              <p className="hero-lede lede-accent">
                See the bigger picture, not just the numbers.
              </p>
              <div id="waitlist" className="hero-waitlist">
                <WaitlistForm id="waitlist-hero" source="hero" />
              </div>
            </div>
            <div className="hero-visual">
              <SilhouetteFigure activeId={insight.id} className="hero-figure-wrap" />
            </div>
          </div>
        </section>

        <section className="pieces" aria-labelledby="pieces-heading">
          <div className="shell pieces-copy">
            <h2 id="pieces-heading" className="section-title">
              Your health doesn't happen one metric at a time.
            </h2>
            <p className="section-lede">
              Sleep affects recovery. Recovery affects energy. Your cycle shifts mood.
              Stress shows up in all of them. Most health apps still show each one on
              its own screen, updated on its own schedule.
            </p>
            <p className="section-lede lede-accent">Ciatta looks across them together.</p>
          </div>
        </section>

        <section
          ref={insightsReveal.ref}
          id="examples"
          className={`insights reveal${insightsReveal.visible ? ' is-visible' : ''}`}
          aria-labelledby="insights-heading"
        >
          <div className="shell insights-intro">
            <h2 id="insights-heading" className="section-title">
              See what's changing.
              <em> See what connects.</em>
            </h2>
            <p className="section-lede">
              Ciatta learns your patterns over time, and measures what's changing against
              your own baseline, not a population average.
            </p>
          </div>

          <div className="shell insights-body">
            <div className="insight-nav-col">
              <nav className="insight-nav" aria-label="Example insights">
                {INSIGHTS.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={activeInsight === i ? 'insight-nav-item is-active' : 'insight-nav-item'}
                    aria-current={activeInsight === i ? 'true' : undefined}
                    onClick={() => setActiveInsight(i)}
                  >
                    <span className="insight-nav-dot" style={{ background: item.color }} aria-hidden="true" />
                    <span className="insight-nav-label">{item.domain}</span>
                    <span className="insight-nav-strength">{item.strength}%</span>
                  </button>
                ))}
              </nav>
            </div>

            <article
              className="insight-panel"
              style={{ '--panel-accent': insight.color } as React.CSSProperties}
              aria-live="polite"
            >
              <header className="insight-panel-head">
                <span className="insight-panel-domain">{insight.domain}</span>
                <div className="insight-meter" aria-label={`Confidence ${insight.strength} percent`}>
                  <span className="insight-meter-track">
                    <span className="insight-meter-fill" style={{ width: `${insight.strength}%` }} />
                  </span>
                  <span className="insight-meter-val">{insight.strength}% confidence</span>
                </div>
              </header>
              <blockquote className="insight-quote">{insight.text}</blockquote>
              <p className="insight-caption">Your picture gets clearer as the pattern gets stronger.</p>
            </article>
          </div>
        </section>

        <section className="continuity" aria-labelledby="continuity-heading">
          <div className="shell">
            <h2 id="continuity-heading" className="section-title">
              The more your health changes, the more there is to connect.
            </h2>
            <p className="section-lede">
              Ciatta doesn't start over each day. Every new signal is weighed against
              what it has already learned about you, so it can tell:
            </p>
            <ul className="continuity-list">
              <li>What changed.</li>
              <li>What keeps repeating.</li>
              <li>What might be connected.</li>
              <li>What isn't clear yet.</li>
            </ul>
          </div>
        </section>

        <section
          ref={careReveal.ref}
          className={`care reveal${careReveal.visible ? ' is-visible' : ''}`}
          aria-labelledby="care-heading"
        >
          <div className="shell care-grid">
            <div className="care-copy">
              <h2 id="care-heading" className="section-title">
                When you need to talk to someone, bring the picture with you.
              </h2>
              <p className="section-lede">
                Ciatta is not a clinician and doesn't diagnose you. When something is strong
                enough to discuss, it organizes it into a concise brief you can bring with you.
                Provider details are optional.
              </p>
              <p className="section-lede lede-accent">
                It helps you walk into the conversation with the pieces already connected.
              </p>
            </div>
            <aside className="brief">
              <dl className="brief-list">
                <div>
                  <dt>Noticed</dt>
                  <dd>Resting heart rate was elevated three mornings after short sleep nights.</dd>
                </div>
                <div>
                  <dt>How strong</dt>
                  <dd>The pattern appears consistently across your recent baseline.</dd>
                </div>
                <div>
                  <dt>Still learning</dt>
                  <dd>Whether the pattern holds outside your luteal phase.</dd>
                </div>
                <div>
                  <dt>Worth discussing</dt>
                  <dd>Whether sleep debt may be affecting recovery this month.</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="close" id="join" aria-labelledby="close-heading">
          <div className="shell close-inner">
            <h2 id="close-heading" className="section-title">Your health is more than separate numbers.</h2>
            <p className="section-lede close-lines">
              It's patterns.
              <br />
              It's changes.
              <br />
              It's connections.
              <br />
              It's the bigger picture.
            </p>
            <p className="section-lede lede-accent">Ciatta helps you see it.</p>
            <WaitlistForm id="waitlist-close" source="closing" />
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <img src="/images/wordmark.png" alt="Ciatta" className="footer-logo" width={88} height={25} />
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
