import { useEffect, useRef, useState } from 'react';

/**
 * The Ciatta app, seven screens of it, drawn as the product rather than as
 * pictures of the product.
 *
 * ARCHITECTURE
 *
 *   Today        what matters now
 *   My Health    the information Ciatta holds, organised
 *                  Health Records  Results · Documents
 *                  Cycle · Sleep · Symptoms · Medications & Supplements
 *                  What you told Ciatta
 *   Journey      how her health has changed over time
 *   Profile      her details, goals, connections, permissions, account
 *
 *   Teach Ciatta is a persistent action, not a fifth destination. It sits above
 *   the tab bar on every screen, because context can arrive at any moment and
 *   should never require navigating somewhere first.
 *
 * The layers are kept apart on purpose. Health Records answers "what
 * information do I have" and holds nothing Ciatta concluded; the insight
 * answers "what do these pieces show together" and holds nothing raw. Putting
 * an interpretation inside the record would make the source unciteable.
 *
 * PROVENANCE
 *
 *   Measured            a device recorded it
 *   You told Ciatta     she said it, in her words
 *   Imported            it arrived from a connected provider
 *   Uploaded            it came from a document she added
 *   Published evidence  a study, about a cohort, not about her
 *   Inferred by Ciatta  read from several of the above together
 *
 * THE RECORD  — today is 1 April 2026, and every screen agrees with this.
 *
 *   Cycles     8 Dec 29d · 6 Jan 28d · 3 Feb 27d · 2 Mar 26d
 *              current cycle began 28 Mar, day 5
 *   Sleep      average 7h 18m · lowest weeks 26 Jan 6h 02m, 23 Feb 6h 14m
 *   Symptoms   sleep disruption from 10 Mar · fatigue 7 Mar to 24 Mar
 *              night sweats 3 occurrences · headache 12 Mar · mood 9 Mar
 *   Taking     levothyroxine 50mcg from 8 Jan, changed to 75mcg 3 Mar
 *              magnesium glycinate 400mg from 12 Feb
 *              ferrous sulfate stopped 6 Jan
 *   Her words  3 Mar medication changed · 7 Mar stressful · 10 Mar waking
 *   Records    14 Mar Quest: ferritin 24, TSH 2.1, vitamin D 31
 *              14 Mar annual physical, PDF
 *
 *   The finding: the two shortest cycles each began within a week of a
 *   lowest-sleep week. Twice. Which is proximity in time, and nothing more.
 *
 * Drawn at iPhone 17 Pro proportions (402 x 874 pt). Interiors are sized in
 * cqw, so a screen at 0.62 scale and one at 1.75 hold identical proportions.
 */

const TABS = ['Today', 'My Health', 'Journey', 'Profile'] as const;

/* -- shared chrome --------------------------------------------------------- */

type Action = 'calendar' | 'filter' | 'plus' | 'share' | 'info' | 'search';

function ActionIcon({ kind }: { kind: Action }) {
  const p = {
    calendar: <><rect x="1.6" y="2.6" width="12.8" height="11.8" rx="2.4" /><path d="M1.6 6.2h12.8M5 1.2v2.6M11 1.2v2.6" /></>,
    filter: <><path d="M1.8 4.2h12.4M3.9 8h8.2M6.2 11.8h3.6" /></>,
    plus: <><path d="M8 2.6v10.8M2.6 8h10.8" /></>,
    share: <><path d="M8 10.6V1.9M4.8 5.1 8 1.9l3.2 3.2" /><path d="M3.4 9.2v3.5a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4V9.2" /></>,
    info: <><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.9v.1" /></>,
    search: <><circle cx="7.2" cy="7.2" r="4.8" /><path d="m11 11 3 3" /></>,
  }[kind];
  return (
    <svg viewBox="0 0 16 16" className="ps-act" aria-hidden="true"
         fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

function Chrome({
  title, action = 'info', tab = 'My Health', dense, teach = true, children,
}: {
  title: string; action?: Action; tab?: (typeof TABS)[number];
  dense?: boolean; teach?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="ps-phone">
      <div className="ps-screen">
        <div className="ps-status">
          <span className="ps-time">9:41</span>
          <span className="ps-status-r" aria-hidden="true">
            <svg viewBox="0 0 18 12" className="ps-sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.4"/></svg>
            <svg viewBox="0 0 24 12" className="ps-batt"><rect x="0.6" y="0.6" width="19" height="10.8" rx="3" fill="none" strokeWidth="1.2"/><rect x="2.2" y="2.2" width="13" height="7.6" rx="1.6"/><path d="M21.4 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z"/></svg>
          </span>
        </div>
        <div className="ps-nav">
          <svg viewBox="0 0 8 14" className="ps-chev" aria-hidden="true"><path d="M7 1 1 7l6 6" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="ps-nav-title">{title}</span>
          <ActionIcon kind={action} />
        </div>
        <div className={dense ? 'ps-body is-dense' : 'ps-body'}>{children}</div>
        {/* Context can arrive at any moment, so the way to add it is on every
            screen rather than behind a destination of its own. */}
        {teach && <div className="ps-teach" aria-hidden="true"><i>+</i>Teach Ciatta</div>}
        <div className="ps-tabs" aria-hidden="true">
          {TABS.map((t) => (
            <span key={t} className={t === tab ? 'ps-tab is-on' : 'ps-tab'}>{t}</span>
          ))}
        </div>
        <span className="ps-home" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The range control. Same shape, same position, on every measured screen. */
function Seg({ items, on }: { items: readonly string[]; on: string }) {
  return (
    <div className="ps-seg" aria-hidden="true">
      {items.map((i) => (
        <span key={i} className={i === on ? 'ps-seg-i is-on' : 'ps-seg-i'}>{i}</span>
      ))}
    </div>
  );
}

/** Filter chips, for screens whose content is kinds rather than a period. */
function Chips({ items, on }: { items: readonly string[]; on: string }) {
  return (
    <div className="ps-chips" aria-hidden="true">
      {items.map((i) => (
        <span key={i} className={i === on ? 'ps-chip is-on' : 'ps-chip'}>{i}</span>
      ))}
    </div>
  );
}

function Lab({ children, qual }: { children: React.ReactNode; qual?: string }) {
  return (
    <div className="ps-lab">
      <span>{children}</span>
      {qual && <span className="ps-lab-q">{qual}</span>}
    </div>
  );
}

/** Where a value came from. Six kinds, and they never change colour. */
type SrcKind = 'measured' | 'told' | 'imported' | 'uploaded' | 'evidence' | 'inferred';
const SRC_LABEL: Record<SrcKind, string> = {
  measured: 'Measured',
  told: 'You told Ciatta',
  imported: 'Imported',
  uploaded: 'Uploaded',
  evidence: 'Published evidence',
  inferred: 'Inferred by Ciatta',
};
function Src({ kind }: { kind: SrcKind }) {
  return <span className={`ps-src is-${kind}`}>{SRC_LABEL[kind]}</span>;
}

function Caret() {
  return (
    <svg viewBox="0 0 8 14" className="ps-caret" aria-hidden="true">
      <path d="m1 1 6 6-6 6" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A tappable row. `open` renders it as the inspected one, detail showing. */
function Row({
  k, v, meta, open, children,
}: {
  k: string; v?: string; meta?: string; open?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={open ? 'ps-row is-open' : 'ps-row'}>
      <div className="ps-row-line">
        <span className="ps-row-k">
          <b>{k}</b>
          {meta && <i>{meta}</i>}
        </span>
        {v && <span className="ps-row-v">{v}</span>}
        <Caret />
      </div>
      {open && children && <div className="ps-row-detail">{children}</div>}
    </div>
  );
}

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar'] as const;
function Axis() {
  return (
    <div className="ps-axis" aria-hidden="true">
      {MONTHS.map((m) => <span key={m}>{m}</span>)}
    </div>
  );
}

/* -- 1. Cycle -------------------------------------------------------------- *
 * Job: the whole cycle history, and one cycle opened to inspect.             */

function CycleScreen() {
  const cycles = [
    { s: '8 Dec', e: '5 Jan', n: 29 },
    { s: '6 Jan', e: '2 Feb', n: 28 },
    { s: '3 Feb', e: '1 Mar', n: 27, short: true },
    { s: '2 Mar', e: '27 Mar', n: 26, short: true },
  ];
  // plotted 24 to 32 days, so the decline reads without the axis exaggerating it
  const h = (n: number) => `${((n - 24) / 8) * 100}%`;

  return (
    <Chrome title="Cycle" action="calendar">
      <Seg items={['6M', '12M', 'All']} on="12M" />

      <div className="ps-now">
        <div className="ps-now-head">
          <span className="ps-now-k">Current cycle</span>
          <span className="ps-now-n">Day 5</span>
        </div>
        <div className="ps-prog" aria-hidden="true"><span style={{ width: '19%' }} /></div>
        <div className="ps-now-foot">
          <span>Began 28 Mar</span>
          <span>Next expected 23 Apr</span>
        </div>
      </div>

      <Lab qual="29d &rarr; 26d">Cycle length</Lab>
      {/* No reference band. Across four cycles spanning 26 to 29 days it filled
          the plot and read as a ceiling; the decline is the whole point. */}
      <div className="ps-plot">
        <div className="ps-cols" aria-hidden="true">
          {cycles.map((c) => (
            <span key={c.s} className={c.short ? 'ps-col is-short' : 'ps-col'}>
              <span className="ps-col-n">{c.n}d</span>
              <span className="ps-col-bar" style={{ height: h(c.n) }} />
            </span>
          ))}
        </div>
      </div>
      <Axis />

      <Lab qual="4 cycles">History</Lab>
      <div className="ps-rows">
        <Row k="2 Mar – 27 Mar" meta="Shortest recorded" v="26d" open>
          <ul className="ps-facts">
            <li><span>Length</span><b>26 days, 3 under your usual</b></li>
            <li><span>Bleeding</span><b>4 days</b></li>
            <li><span>Week before</span><b>23 Feb, 6h 14m sleep</b></li>
          </ul>
          <span className="ps-link">See this cycle in Journey</span>
        </Row>
        <Row k="3 Feb – 1 Mar" meta="Second shortest" v="27d" />
        <Row k="6 Jan – 2 Feb" v="28d" />
      </div>

      <div className="ps-prov"><Src kind="measured" /> Oura, nightly &middot; 4 start dates you confirmed</div>
    </Chrome>
  );
}

/* -- 2. Sleep -------------------------------------------------------------- *
 * Job: duration over time, with the lowest weeks findable and openable.      */

function SleepScreen() {
  const weeks = [7.5, 7.4, 7.2, 7.3, 7.1, 7.4, 6.03, 7.0, 7.2, 7.1, 6.23, 6.9, 7.3, 7.2];
  const low = [6, 10];
  const nights = [6.6, 5.4, 6.1, 5.2, 6.5, 6.0, 6.3];

  return (
    <Chrome title="Sleep" action="calendar">
      <Seg items={['6M', '12M', 'All']} on="12M" />

      <div className="ps-figure">
        <span className="ps-fig-k">Average, last 12 months</span>
        <span className="ps-fig-n">7<i>h</i>18<i>m</i></span>
        <span className="ps-fig-d is-down">Recent low 6h 02m, week of 26 Jan</span>
      </div>

      <Lab qual="Weekly average">Duration</Lab>
      <div className="ps-plot">
        <span className="ps-target" style={{ bottom: '62%' }} aria-hidden="true"><i>7h 18m</i></span>
        <div className="ps-cols" aria-hidden="true">
          {weeks.map((v, i) => (
            <span key={i} className={low.includes(i) ? 'ps-col is-low' : 'ps-col'}>
              <span className="ps-col-bar" style={{ height: `${((v - 5.6) / 2.1) * 100}%` }} />
            </span>
          ))}
        </div>
      </div>
      <Axis />

      <Lab qual="2 found">Lowest weeks</Lab>
      <div className="ps-rows">
        <Row k="Week of 26 Jan" v="6h 02m" open>
          <div className="ps-nights" aria-hidden="true">
            {nights.map((n, i) => (
              <span key={i}>
                <i style={{ height: `${((n - 4.8) / 2.2) * 100}%` }} />
                {'MTWTFSS'[i]}
              </span>
            ))}
          </div>
          <ul className="ps-facts">
            <li><span>Under 6h</span><b>3 nights</b></li>
            <li><span>Cycle after</span><b>Began 3 Feb, ran 27 days</b></li>
          </ul>
        </Row>
        <Row k="Week of 23 Feb" meta="Cycle after began 2 Mar" v="6h 14m" />
      </div>

      <div className="ps-prov"><Src kind="measured" /> Oura, nightly &middot; synced 2 hours ago</div>
    </Chrome>
  );
}

/* -- 3. Symptoms ----------------------------------------------------------- *
 * Job: what she logged, when, how often, how bad. Not a diagnosis of any of
 * it: these are her reports, and the screen never says what they mean.       */

function SymptomsScreen() {
  const lanes = [
    { name: 'Sleep disruption', at: 62, w: 30, sev: 'mod' },
    { name: 'Fatigue', at: 58, w: 34, sev: 'mod' },
    { name: 'Night sweats', at: 40, w: 46, sev: 'mild' },
    { name: 'Mood changes', at: 60, w: 14, sev: 'mild' },
  ];
  const starts = [6, 30, 54, 78];

  return (
    <Chrome title="Symptoms" action="filter">
      <Chips items={['All', 'Sleep', 'Energy', 'Temperature']} on="All" />

      <Lab qual="Dec to Apr">Timeline</Lab>
      <div className="ps-lanes">
        <div className="ps-lane is-ref">
          <span className="ps-lane-k">Cycle starts</span>
          <span className="ps-rail">
            {starts.map((l) => <span key={l} className="ps-tick" style={{ left: `${l}%` }} />)}
          </span>
        </div>
        {lanes.map((l) => (
          <div className="ps-lane" key={l.name}>
            <span className="ps-lane-k">{l.name}</span>
            <span className="ps-rail">
              <span className={`ps-span is-${l.sev}`} style={{ left: `${l.at}%`, width: `${l.w}%` }} />
            </span>
          </div>
        ))}
      </div>
      <Axis />

      <Lab qual="You logged these">Recent</Lab>
      <div className="ps-rows">
        <Row k="Sleep disruption" meta="From 10 Mar &middot; most nights" v="Moderate" open>
          <ul className="ps-facts">
            <li><span>Logged</span><b>14 times since 10 Mar</b></li>
            <li><span>Usual note</span><b>Waking 2 to 3 times</b></li>
            <li><span>Severity</span><b>Moderate on 9 of 14</b></li>
          </ul>
        </Row>
        <Row k="Fatigue" meta="7 Mar to 24 Mar" v="Moderate" />
        <Row k="Night sweats" meta="3 occurrences since 2 Feb" v="Mild" />
        <Row k="Headache" meta="12 Mar, one day" v="Mild" />
      </div>

      <div className="ps-bar-action">Log a symptom</div>
      <div className="ps-prov"><Src kind="told" /> Entered by you, dated as you entered it</div>
    </Chrome>
  );
}

/* -- 4. Medications & Supplements ------------------------------------------ *
 * Job: what she takes, what changed, when. Everything here she entered or
 * imported; Ciatta recommends none of it and says so.                        */

function MedsScreen() {
  const spans = [
    { name: 'Ferrous sulfate', at: 0, w: 24, done: true },
    { name: 'Levothyroxine', at: 20, w: 80 },
    { name: 'Magnesium glycinate', at: 48, w: 52 },
  ];
  return (
    <Chrome title="Medications & Supplements" action="plus">
      <Seg items={['Current', 'All']} on="Current" />

      <Lab qual="2 active">Taking now</Lab>
      <div className="ps-cards">
        <div className="ps-card">
          <div className="ps-card-t"><b>Levothyroxine</b><span>75 mcg</span><span className="ps-pill is-ok">Active</span></div>
          <div className="ps-card-m"><span>Morning, daily</span><span>Started 8 Jan 2026</span></div>
          <span className="ps-note-s">Dose changed from 50 mcg on 3 Mar 2026</span>
        </div>
        <div className="ps-card">
          <div className="ps-card-t"><b>Magnesium glycinate</b><span>400 mg</span><span className="ps-pill is-ok">Active</span></div>
          <div className="ps-card-m"><span>Evening, daily</span><span>Started 12 Feb 2026</span></div>
        </div>
      </div>

      <Lab qual="Dec to Apr">Timeline</Lab>
      <div className="ps-lanes">
        {spans.map((s) => (
          <div className="ps-lane" key={s.name}>
            <span className="ps-lane-k">{s.name}</span>
            <span className="ps-rail">
              <span className={s.done ? 'ps-span is-past' : 'ps-span is-on'}
                    style={{ left: `${s.at}%`, width: `${s.w}%` }} />
            </span>
          </div>
        ))}
      </div>
      <Axis />

      <Lab qual="3 changes">Changes</Lab>
      <div className="ps-rows">
        <Row k="Levothyroxine increased" meta="50 mcg &rarr; 75 mcg" v="3 Mar" open>
          <ul className="ps-facts">
            <li><span>Recorded</span><b>You told Ciatta, 3 Mar</b></li>
            <li><span>On record since</span><b>8 Jan 2026</b></li>
          </ul>
        </Row>
        <Row k="Magnesium glycinate started" v="12 Feb" />
        <Row k="Ferrous sulfate stopped" meta="Now inactive" v="6 Jan" />
      </div>

      <div className="ps-prov">
        <Src kind="told" /> You entered these. Ciatta does not recommend or remind.
      </div>
    </Chrome>
  );
}

/* -- 5. What you told Ciatta ----------------------------------------------- *
 * Job: her lived context, in her words, sitting beside the measured screens
 * rather than beneath them. No chart, no axis, no units.                     */

function ToldScreen() {
  return (
    <Chrome title="What you told Ciatta" action="search">
      <Chips items={['All', 'Symptoms', 'Life', 'Medication']} on="All" />

      <Lab qual="Since December">38 entries</Lab>

      <div className="ps-entries">
        <span className="ps-month">March 2026</span>
        <blockquote className="ps-entry">
          <p>I&rsquo;ve been waking up several times during the night.</p>
          <footer><span>10 Mar 2026</span><span className="ps-tag-s">Used in an insight</span></footer>
        </blockquote>
        <blockquote className="ps-entry">
          <p>Work has been unusually stressful lately.</p>
          <footer><span>7 Mar 2026</span><span className="ps-tag-s">Used in an insight</span></footer>
        </blockquote>
        <blockquote className="ps-entry">
          <p>My doctor changed my medication.</p>
          <footer><span>3 Mar 2026</span><span className="ps-tag-s">Medication</span></footer>
        </blockquote>

        <span className="ps-month">February 2026</span>
        <blockquote className="ps-entry">
          <p>Started magnesium to see if it helps me sleep.</p>
          <footer><span>12 Feb 2026</span><span className="ps-tag-s">Medication</span></footer>
        </blockquote>
      </div>

      <div className="ps-bar-action is-primary">+ Teach Ciatta</div>
      <div className="ps-prov">
        <Src kind="told" /> Yours, dated, never overwritten by a device or a clinic
      </div>
    </Chrome>
  );
}

/* -- 6. Health Records → Results ------------------------------------------- *
 * Job: the source layer. What arrived from providers and documents, with the
 * unit, the range, the date and who sent it. Ciatta concludes nothing here.  */

function RecordsScreen() {
  return (
    <Chrome title="Health Records" action="search" dense>
      <Seg items={['Results', 'Documents']} on="Results" />

      <Lab qual="Quest Diagnostics">14 Mar 2026</Lab>
      <div className="ps-rows">
        <Row k="Ferritin" meta="15–150 ng/mL" v="24 ng/mL" />
        <Row k="TSH" meta="0.4–4.0 mIU/L" v="2.1 mIU/L" />
        <Row k="Vitamin D" meta="30–100 ng/mL" v="31 ng/mL" />
      </div>

      <Lab qual="Uploaded 14 Mar">Documents</Lab>
      <div className="ps-doc">
        <span className="ps-doc-ico" aria-hidden="true">PDF</span>
        <span className="ps-doc-b">
          <b>Annual Physical</b>
          <i>14 Mar 2026 &middot; Primary care visit</i>
        </span>
        <Caret />
      </div>

      {/* One primary action, not two competing ones. Import and upload are
          both ways of adding a record, so they belong behind the same door. */}
      <div className="ps-bar-action is-primary">+ Add health record</div>

      {/* The primary action is one door with two ways through it, so the
          difference between a connected source and a manual one is the first
          thing she reads rather than a choice she has to reverse-engineer. */}
      <div className="ps-sheet" aria-hidden="true">
        <span className="ps-grab" />
        <span className="ps-sheet-t">Add to Ciatta</span>
        <div className="ps-opt">
          <div className="ps-opt-h"><b>Import results</b><Caret /></div>
          <p>Connect a provider or patient portal and bring structured results into Ciatta.</p>
        </div>
        <div className="ps-opt">
          <div className="ps-opt-h"><b>Upload document</b><Caret /></div>
          <p>Upload a PDF, image or document. Ciatta reads it and adds what it finds.</p>
        </div>
      </div>

      <div className="ps-prov"><Src kind="imported" /> 3 results &middot; 1 document on file</div>
    </Chrome>
  );
}

/* -- 7. Personalized insight ----------------------------------------------- *
 * The intelligence layer, and the only screen that reads the others together.
 * Every layer is labelled with where it came from, so the finding can be
 * taken apart. It ends on a question, not an instruction.                    */

function InsightScreen() {
  const cycle = 'M4 7 L36 8 L68 11 L100 14 L132 18';
  const sleep = 'M4 30 L36 31 L68 42 L100 32 L132 40';

  return (
    <Chrome title="Today" action="share" tab="Today" dense>
      <div className="ps-ins-head">
        <span className="ps-tag">Personalized insight</span>
        <span className="ps-pill is-watch">Watching</span>
      </div>

      <p className="ps-finding">
        Your two shortest cycles followed your two lowest-sleep weeks.
      </p>
      <span className="ps-conf">
        <Src kind="inferred" /> Seen twice &middot; Dec to Mar
      </span>

      <div className="ps-pair">
        <div className="ps-pair-head">
          <span><i className="ps-key is-measured" />Cycle length</span>
          <span><i className="ps-key is-sleep" />Sleep</span>
        </div>
        <svg viewBox="0 0 136 46" className="ps-pair-chart" aria-hidden="true">
          <rect x="60" y="2" width="16" height="42" rx="2" fill="var(--ps-clay)" opacity="0.14" />
          <rect x="124" y="2" width="12" height="42" rx="2" fill="var(--ps-clay)" opacity="0.14" />
          <path d={cycle} fill="none" stroke="var(--ps-measured)" strokeWidth="1.6" />
          <path d={sleep} fill="none" stroke="var(--ps-ink)" strokeWidth="1.5" opacity="0.75" />
          <g fill="var(--ps-clay)">
            <circle cx="68" cy="42" r="2.4" /><circle cx="68" cy="11" r="2.4" />
            <circle cx="132" cy="40" r="2.4" /><circle cx="132" cy="18" r="2.4" />
          </g>
        </svg>
      </div>

      <dl className="ps-layers">
        <div>
          <dt>What changed<Src kind="measured" /></dt>
          <dd>Cycle length decreased, 29 days to 26 days.</dd>
        </div>
        <div>
          <dt>What happened around it<Src kind="measured" /></dt>
          <dd>Both shorter cycles began within a week of a lowest-sleep week.</dd>
        </div>
        <div>
          <dt>What you told Ciatta<Src kind="told" /></dt>
          <dd>A stressful stretch at work, and waking several times a night.</dd>
        </div>
        <div>
          <dt>What else is in your record<Src kind="imported" /></dt>
          <dd>14 Mar: ferritin 24, TSH 2.1, vitamin D 31. All within range.</dd>
        </div>
        <div>
          <dt>What Ciatta found<Src kind="inferred" /></dt>
          <dd>The cycle changes and the low-sleep weeks fell close together in time.</dd>
        </div>
        <div className="is-evidence">
          <dt>What evidence says<Src kind="evidence" /></dt>
          <dd>
            Shorter sleep is associated with cycle variability in published cohorts.
            <span className="ps-cite">2,300 women &middot; 2019 &middot; not about you</span>
          </dd>
        </div>
      </dl>

      <div className="ps-open-row">
        <span className="ps-open-k">Worth exploring</span>
        <p>Whether this pattern continues across your next few cycles.</p>
      </div>

      <div className="ps-next">
        <span className="ps-next-k">For your next conversation</span>
        <p>&ldquo;Are the changes in my sleep and cycle history worth evaluating together?&rdquo;</p>
      </div>

      <p className="ps-hedge">
        Things that move together are not necessarily one causing the other.
      </p>
    </Chrome>
  );
}

/* -------------------------------------------------------------------------- */

const SLOTS = [
  { x: -2.62, y: 16, s: 0.62, z: 3 },
  { x: -1.96, y: 11, s: 0.70, z: 4 },
  { x: -1.16, y: 5,  s: 0.80, z: 5 },
  { x:  0,    y: 0,  s: 1.75, z: 8 },
  { x:  1.16, y: 5,  s: 0.80, z: 5 },
  { x:  1.96, y: 11, s: 0.70, z: 4 },
  { x:  2.62, y: 16, s: 0.62, z: 3 },
] as const;

const SCREENS = [
  { name: 'Health Records', Screen: RecordsScreen },
  { name: 'Cycle', Screen: CycleScreen },
  { name: 'Sleep', Screen: SleepScreen },
  { name: 'Personalized insight', Screen: InsightScreen },
  { name: 'Symptoms', Screen: SymptomsScreen },
  { name: 'Medications & Supplements', Screen: MedsScreen },
  { name: 'What you told Ciatta', Screen: ToldScreen },
] as const;

const N = SCREENS.length;
const HALF = (N - 1) / 2;
const INSIGHT_INDEX = 3;
export function ProductShowcase() {
  const [active, setActive] = useState(INSIGHT_INDEX);
  const [held, setHeld] = useState(false);
  const prevOffsets = useRef<number[]>([]);
  const drag = useRef<{ x: number } | null>(null);
  // set when a pointer gesture travelled far enough to be a swipe, so the
  // click that follows it does not also select a screen
  const swiped = useRef(false);

  const step = (d: number) => setActive((a) => (a + d + N) % N);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (held) return;
    // `active` is a dependency so the timer re-arms on every change: a manual
    // choice is never overridden by a tick already part-way through. The dwell
    // is eight seconds because these screens are meant to be read, not
    // glimpsed, and a click has to be able to beat the timer to a screen.
    const id = window.setTimeout(() => step(1), 8000);
    return () => window.clearTimeout(id);
  }, [held, active]);

  const offsets = SCREENS.map((_, i) => {
    const raw = (i - active + N) % N;
    return raw > HALF ? raw - N : raw;
  });
  const wrapped = offsets.map((o, i) => {
    const prev = prevOffsets.current[i];
    return prev !== undefined && Math.abs(o - prev) > 1;
  });
  prevOffsets.current = offsets;

  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <div className="shell showcase-intro">
        <h2 id="showcase-heading" className="showcase-title">
          All the pieces. One picture.
        </h2>
      </div>


      {/* The source buttons were the only keyboard path to these screens, and
          the stage itself was aria-hidden. With them gone the stage has to
          carry that itself, or the showcase would be reachable by mouse drag
          alone. */}
      <div
        className="showcase-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={`Ciatta app screens: ${SCREENS[active].name}, ${active + 1} of ${N}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        }}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        onPointerDown={(e) => { drag.current = { x: e.clientX }; swiped.current = false; setHeld(true); }}
        onPointerUp={(e) => {
          const d = drag.current; drag.current = null; setHeld(false);
          if (d && Math.abs(e.clientX - d.x) > 40) {
            swiped.current = true;
            step(e.clientX - d.x < 0 ? 1 : -1);
          }
        }}
        onPointerCancel={() => { drag.current = null; setHeld(false); }}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => { if (!drag.current) setHeld(false); }}
      >
        <div className="ps-fan">
          {SCREENS.map(({ name, Screen }, i) => {
            const slot = SLOTS[offsets[i] + HALF];
            return (
              <div
                key={name}
                className={
                  'ps-slot' +
                  (offsets[i] === 0 ? ' is-centre' : '') +
                  (wrapped[i] ? ' is-rejoining' : '')
                }
                style={{
                  transform: `translateX(calc(-50% + var(--ps-w) * ${slot.x})) translateY(${slot.y}%) scale(${slot.s})`,
                  zIndex: slot.z,
                }}
              onClick={() => { if (!swiped.current) setActive(i); }}
              title={offsets[i] === 0 ? undefined : `Bring ${name} to the centre`}
              >
                <Screen />
              </div>
            );
          })}
        </div>
      </div>

      <div className="shell">
        <p className="showcase-foot">
          The insight is what the other six say when they are read together.
        </p>
      </div>
    </section>
  );
}
