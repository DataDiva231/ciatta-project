import { Wordmark } from './components/Wordmark';
import { WaitlistForm } from './components/WaitlistForm';

/**
 * Member — the page the "Become a member" button goes to.
 *
 * Modelled on hioctohealth.com/checkout, which despite the URL takes no payment:
 * it is an email capture with the membership explained underneath. That is the
 * honest shape for a product that has not opened, and it is the shape Ciatta
 * needs. There are no card fields here and there should not be until there is
 * something to charge for.
 *
 * Split layout: the film on the left carries the brand, the card on the right
 * carries the one thing to do. Below the form, what membership actually is,
 * closed by default, including the two questions people ask first: what it
 * costs, and what happens after they put their address in.
 */

const INCLUDES: [string, string][] = [
  ['Your health in one place',
   'Results and documents from your providers, your cycle, your sleep, your symptoms, and what you take. Imported from a connected provider or entered once, then kept.'],
  ['Insights that show their working',
   'What several parts of your record say when they are read together, with what Ciatta read, what it is unsure of, and what is still too thin to call. Never a score without the reasoning.'],
  ['Your own words, alongside the measurements',
   'A stressful week, a medication change, a night you did not sleep. Context no device records, dated as you wrote it and never overwritten by a device or a clinic.'],
  ['Something to bring to an appointment',
   'What changed, what was happening around it, and one question worth asking. Yours to take or to ignore. Ciatta is not in the room and does not diagnose, prescribe, or offer a second opinion.'],
  ['What it costs',
   'Not set yet. Private testing is free, and members will be told what membership costs before anything is charged, with the choice to stop there. No card is taken today.'],
  ['What happens when you join',
   'One email when it opens, and nothing else. No newsletter, no launch countdown. Your address is used to tell you it is ready and for nothing else.'],
];

export default function Member() {
  return (
    <>
      <a className="skip" href="#member-main">Skip to the form</a>

      <main id="member-main" className="member">
        {/* The film, still rather than moving: this page is one decision and a
            playing video would be the loudest thing on it. */}
        <aside className="member-film" aria-hidden="true">
          <img src="/video/hero-poster.jpg" alt="" width={1600} height={900} />
          <div className="member-film-scrim" />
          <a className="member-mark" href="/" aria-hidden="true" tabIndex={-1}>
            <Wordmark size="sm" />
          </a>
          <p className="member-film-line">
            Your health is changing.<br />See what is changing with it.
          </p>
        </aside>

        <div className="member-panel">
          <a className="member-mark is-inline" href="/" aria-label="Ciatta, home">
            <Wordmark size="sm" />
          </a>

          <div className="member-card">
            <span className="member-eyebrow">Private testing</span>
            <h1 className="member-title">Become a member</h1>
            <p className="member-sub">
              Bring your results, your cycle, your sleep, your symptoms and your
              own notes into one place, and see what they say when they are read
              together. One membership.
            </p>

            <WaitlistForm id="waitlist-member" source="member" />

            <p className="member-aside">
              Ciatta is in private testing. Joining puts you on the list, not on
              a plan.
            </p>

            <div className="member-includes">
              <span className="member-includes-k">What membership is</span>
              {INCLUDES.map(([q, a]) => (
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

          <footer className="member-foot">
            <nav aria-label="Footer">
              <a href="/">Home</a>
              <a href="/briefs/">Briefs</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </nav>
            <span>&copy; {new Date().getFullYear()} Ciatta</span>
          </footer>
        </div>
      </main>
    </>
  );
}
