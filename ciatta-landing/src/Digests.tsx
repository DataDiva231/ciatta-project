import { useState } from 'react';
import { Wordmark } from './components/Wordmark';

/**
 * Digests — Ciatta's writing, indexed.
 *
 * Three kinds, and the kind is not a label on top of one undifferentiated pile:
 * they answer different questions and are written differently.
 *
 *   Guides       how to do a thing, or what to expect. Longest.
 *   Comparisons  two things people mistake for each other, told apart.
 *   Definitions  one term, said plainly, in about a paragraph.
 *
 * The topic filter is the second axis, because a woman arrives either knowing
 * what she wants to read about (cycle, sleep, labs) or what shape of answer she
 * wants (a definition, not an essay), and rarely both.
 *
 * This is an index. Nothing links out yet, and rather than pretend otherwise,
 * every card says so. A dead link is worse than an honest "not written yet".
 */

type Kind = 'Guides' | 'Comparisons' | 'Definitions';
type Topic = 'Cycle' | 'Sleep' | 'Symptoms' | 'Results' | 'Appointments';

type Piece = { title: string; kind: Kind; topic: Topic; blurb: string };

const PIECES: Piece[] = [
  /* --- Guides ---------------------------------------------------------- */
  { title: 'What changes first in perimenopause', kind: 'Guides', topic: 'Cycle',
    blurb: 'Cycle length usually moves before anything else does, and it moves in both directions.' },
  { title: 'How to track a cycle that has stopped being regular', kind: 'Guides', topic: 'Cycle',
    blurb: 'What to record when the thing you were counting on has stopped being countable.' },
  { title: 'Keeping a symptom record a clinician can actually use', kind: 'Guides', topic: 'Symptoms',
    blurb: 'Dates, duration and severity. Why "sometimes" is the least useful word in the record.' },
  { title: 'What to bring to a perimenopause appointment', kind: 'Guides', topic: 'Appointments',
    blurb: 'Ten minutes, six months to account for, and what is worth writing down beforehand.' },
  { title: 'Reading your own lab results', kind: 'Guides', topic: 'Results',
    blurb: 'Units, reference ranges, and why "within range" is a range rather than a verdict.' },
  { title: 'Sleep and the menstrual cycle', kind: 'Guides', topic: 'Sleep',
    blurb: 'What is known about how the two move together, and how much of it is about averages.' },
  { title: 'When a shorter cycle is worth mentioning', kind: 'Guides', topic: 'Cycle',
    blurb: 'One short month is usually nothing. What makes a run of them worth raising.' },
  { title: 'Night sweats, hot flushes and the words for them', kind: 'Guides', topic: 'Symptoms',
    blurb: 'Vasomotor symptoms, described the way they are experienced and the way they are recorded.' },
  { title: 'How to ask for a test without asking for a test', kind: 'Guides', topic: 'Appointments',
    blurb: 'Bringing a pattern rather than a request, and why it tends to go further.' },

  /* --- Comparisons ------------------------------------------------------ */
  { title: 'Perimenopause or premenstrual', kind: 'Comparisons', topic: 'Symptoms',
    blurb: 'Overlapping symptoms, different timing. What tells them apart in a record.' },
  { title: 'Cycle tracking or symptom tracking', kind: 'Comparisons', topic: 'Cycle',
    blurb: 'Two different records, two different questions. Most apps only keep one.' },
  { title: 'Ferritin or haemoglobin', kind: 'Comparisons', topic: 'Results',
    blurb: 'Both about iron, measuring different things, and often ordered at different times.' },
  { title: 'A wearable or a written note', kind: 'Comparisons', topic: 'Sleep',
    blurb: 'What a device records, what it cannot, and why the two are worth keeping together.' },
  { title: 'Patient portal or personal record', kind: 'Comparisons', topic: 'Results',
    blurb: 'One holds what your providers sent. The other holds what you noticed.' },
  { title: 'FSH or AMH', kind: 'Comparisons', topic: 'Results',
    blurb: 'Two tests people expect to settle the question of perimenopause, and what each can say.' },

  /* --- Definitions ------------------------------------------------------ */
  { title: 'Perimenopause', kind: 'Definitions', topic: 'Cycle',
    blurb: 'The years of change before the final period, and why it is defined backwards.' },
  { title: 'Cycle length', kind: 'Definitions', topic: 'Cycle',
    blurb: 'Counted from the first day of bleeding to the day before the next. Where people miscount.' },
  { title: 'Follicular phase', kind: 'Definitions', topic: 'Cycle',
    blurb: 'The first half, and the half that does most of the changing.' },
  { title: 'Luteal phase', kind: 'Definitions', topic: 'Cycle',
    blurb: 'The second half, usually steadier in length than the first.' },
  { title: 'Vasomotor symptoms', kind: 'Definitions', topic: 'Symptoms',
    blurb: 'The clinical name for hot flushes and night sweats.' },
  { title: 'Ferritin', kind: 'Definitions', topic: 'Results',
    blurb: 'A measure of stored iron, and one that moves for reasons other than iron.' },
  { title: 'TSH', kind: 'Definitions', topic: 'Results',
    blurb: 'Thyroid stimulating hormone. What it is asked to indicate, and what it is not.' },
  { title: 'Reference range', kind: 'Definitions', topic: 'Results',
    blurb: 'Where most results from a reference population fall. Not a target, and not a diagnosis.' },
  { title: 'Sleep efficiency', kind: 'Definitions', topic: 'Sleep',
    blurb: 'Time asleep as a share of time in bed, and why devices disagree about it.' },
];

const KINDS: Kind[] = ['Guides', 'Comparisons', 'Definitions'];
const TOPICS: Topic[] = ['Cycle', 'Sleep', 'Symptoms', 'Results', 'Appointments'];

const KIND_BLURB: Record<Kind, string> = {
  Guides: 'How to do something, or what to expect. The long ones.',
  Comparisons: 'Two things people mistake for each other, told apart.',
  Definitions: 'One term, said plainly, in about a paragraph.',
};

export default function Digests() {
  const [kind, setKind] = useState<Kind | 'All'>('All');
  const [topic, setTopic] = useState<Topic | 'All'>('All');

  const shown = PIECES.filter(
    (p) => (kind === 'All' || p.kind === kind) && (topic === 'All' || p.topic === topic),
  );
  // Grouped by kind, and only the groups that survived both filters get a heading.
  const groups = KINDS.map((k) => [k, shown.filter((p) => p.kind === k)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <>
      <a className="skip" href="#digests-main">Skip to the writing</a>

      <header className="header is-scrolled">
        <a href="/" className="header-brand" aria-label="Ciatta, home">
          <Wordmark size="sm" />
        </a>
        <div className="header-end">
          <a className="header-cta" href="/#join">Become a member</a>
        </div>
      </header>

      <main id="digests-main">
        <section className="section digest-head">
          <div className="shell">
            <h1 className="band-title">Digests</h1>
            <p className="band-sub">
              What we have had to look up, written down properly. Guides for the
              long questions, comparisons for the two things that get confused,
              and definitions for the word someone used without explaining it.
            </p>
          </div>
        </section>

        <section className="section digest-body" aria-labelledby="digest-list">
          <div className="shell">
            <h2 id="digest-list" className="sr-only">All writing</h2>

            <div className="filters">
              <div className="filter-row" role="group" aria-label="Filter by kind">
                <span className="filter-label">Kind</span>
                <button type="button" onClick={() => setKind('All')}
                        className={kind === 'All' ? 'chip is-on' : 'chip'}
                        aria-pressed={kind === 'All'}>All</button>
                {KINDS.map((k) => (
                  <button type="button" key={k} onClick={() => setKind(k)}
                          className={kind === k ? 'chip is-on' : 'chip'}
                          aria-pressed={kind === k}>{k}</button>
                ))}
              </div>
              <div className="filter-row" role="group" aria-label="Filter by topic">
                <span className="filter-label">Topic</span>
                <button type="button" onClick={() => setTopic('All')}
                        className={topic === 'All' ? 'chip is-on' : 'chip'}
                        aria-pressed={topic === 'All'}>All</button>
                {TOPICS.map((t) => (
                  <button type="button" key={t} onClick={() => setTopic(t)}
                          className={topic === t ? 'chip is-on' : 'chip'}
                          aria-pressed={topic === t}>{t}</button>
                ))}
              </div>
            </div>

            <p className="filter-count" aria-live="polite">
              {shown.length} {shown.length === 1 ? 'piece' : 'pieces'}
              {kind !== 'All' || topic !== 'All' ? ' shown' : ''}
            </p>

            {groups.map(([k, list]) => (
              <div className="digest-group" key={k}>
                <div className="digest-group-head">
                  <h3>{k}</h3>
                  <p>{KIND_BLURB[k]}</p>
                </div>
                <div className="digest-grid">
                  {list.map((p) => (
                    <article className="digest-card" key={p.title}>
                      <span className="digest-topic">{p.topic}</span>
                      <h4>{p.title}</h4>
                      <p>{p.blurb}</p>
                      {/* Not a link. Nothing is written yet, and a card that
                          looks clickable and is not is worse than one that
                          says where it stands. */}
                      <span className="digest-soon">In writing</span>
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {groups.length === 0 && (
              <p className="digest-empty">
                Nothing under both of those yet. Try one filter at a time.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <span className="sr-only">Ciatta</span>
        <Wordmark size="sm" />
        <nav className="footer-nav" aria-label="Legal">
          <a href="/">Home</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@ciatta.app">Contact</a>
        </nav>
        <p className="footer-copy">&copy; {new Date().getFullYear()} Ciatta</p>
      </footer>
    </>
  );
}
