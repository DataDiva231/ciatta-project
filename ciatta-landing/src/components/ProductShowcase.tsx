import { useEffect, useRef, useState } from 'react';

/**
 * The Ciatta app, seven screens of it, drawn as the product rather than as
 * pictures of the product.
 *
 * These are designed as working screens first and composed into the fan
 * second. Each one has a job, a hierarchy, a control strip, real values with
 * their units and sources, a selected row with its detail open, and an action.
 * They share one interaction vocabulary so that moving between them costs
 * nothing:
 *
 *   nav bar        back chevron · title · one trailing action
 *   control strip  a segmented range, or filter chips
 *   section label  small caps, with a right-hand qualifier
 *   row            label · value · chevron; the open one shows its detail
 *   provenance     every screen ends by saying where its numbers came from
 *   tab bar        Today · My Health
 *
 * Every screen reads from one record, so they agree with each other and a
 * visitor can check the story across them. Today is 1 August 2026.
 *
 *   Cycles      8 Jan 29d · 6 Feb 29d · 7 Mar 28d · 4 Apr 26d · 30 Apr 28d
 *               28 May 26d · 23 Jun 28d · current started 21 Jul, day 12
 *   Sleep       typical 7h 05m · lowest weeks 25 Mar 5h 54m, 20 May 6h 04m
 *   Symptoms    disrupted sleep from 18 Mar · night sweats from 2 Apr
 *               low energy 20 May to 5 Jun
 *   Taking      iron 2 Feb to 30 Apr · magnesium from 14 Mar
 *               vitamin D from 12 Jun, after the 12 Jun results
 *   Her words   2 Feb · 14 Mar · 18 Mar · 22 May · 12 Jun · 3 Jul
 *   Labs        19 Aug 2025 · 2 Feb 2026 · 12 Jun 2026
 *
 *   The insight Both 26-day cycles began within ten days of a lowest-sleep
 *               week. Seen twice, across seven months.
 *
 * Drawn at iPhone 17 Pro proportions (402 x 874 pt). Interiors are sized in
 * cqw, so a screen at 0.62 scale and one at 1.75 hold identical proportions.
 */

const TABS = ['Today', 'My Health'] as const;

/* -- shared chrome --------------------------------------------------------- */

type Action = 'calendar' | 'filter' | 'plus' | 'share' | 'info';

function ActionIcon({ kind }: { kind: Action }) {
  const p = {
    calendar: <><rect x="1.6" y="2.6" width="12.8" height="11.8" rx="2.4" /><path d="M1.6 6.2h12.8M5 1.2v2.6M11 1.2v2.6" /></>,
    filter: <><path d="M1.8 4.2h12.4M3.9 8h8.2M6.2 11.8h3.6" /></>,
    plus: <><path d="M8 2.6v10.8M2.6 8h10.8" /></>,
    share: <><path d="M8 10.6V1.9M4.8 5.1 8 1.9l3.2 3.2" /><path d="M3.4 9.2v3.5a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4V9.2" /></>,
    info: <><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.9v.1" /></>,
  }[kind];
  return (
    <svg viewBox="0 0 16 16" className="ps-act" aria-hidden="true"
         fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

function Chrome({
  title, action = 'info', tab = 'My Health', dense, children,
}: {
  title: string; action?: Action; tab?: (typeof TABS)[number];
  dense?: boolean; children: React.ReactNode;
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

/** Where a number came from. Four kinds only, and they never change colour. */
function Src({ kind }: { kind: 'measured' | 'reported' | 'lab' | 'worked' }) {
  const label = {
    measured: 'Measured', reported: 'You logged', lab: 'Lab', worked: 'Ciatta',
  }[kind];
  return <span className={`ps-src is-${kind}`}>{label}</span>;
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

const MONTHS = ['Jan', 'Mar', 'May', 'Jul'] as const;
function Axis() {
  return (
    <div className="ps-axis" aria-hidden="true">
      {MONTHS.map((m) => <span key={m}>{m}</span>)}
    </div>
  );
}

/* -- 1. Cycle -------------------------------------------------------------- *
 * Job: see the whole cycle history, and open one cycle to inspect it.        */

function CycleScreen() {
  const cycles = [
    { s: '8 Jan', n: 29 }, { s: '6 Feb', n: 29 }, { s: '7 Mar', n: 28 },
    { s: '4 Apr', n: 26, short: true }, { s: '30 Apr', n: 28 },
    { s: '28 May', n: 26, short: true }, { s: '23 Jun', n: 28 },
  ];
  // plotted 24 to 32 days, so her typical 26 to 30 band sits mid-frame
  const h = (n: number) => `${((n - 24) / 8) * 100}%`;

  return (
    <Chrome title="Cycle" action="calendar">
      <Seg items={['3M', '6M', '12M', 'All']} on="12M" />

      <div className="ps-now">
        <div className="ps-now-head">
          <span className="ps-now-k">Current cycle</span>
          <span className="ps-now-n">Day 12</span>
        </div>
        <div className="ps-prog" aria-hidden="true"><span style={{ width: '43%' }} /></div>
        <div className="ps-now-foot">
          <span>Started 21 Jul</span>
          <span>Next expected 18 Aug</span>
        </div>
      </div>

      <Lab qual="Typical 26–30 days">Cycle length</Lab>
      <div className="ps-plot">
        {/* her own typical range, so a bar is read against her, not an average */}
        <span className="ps-band" style={{ bottom: h(26), height: '50%' }} aria-hidden="true" />
        <div className="ps-cols" aria-hidden="true">
          {cycles.map((c) => (
            <span key={c.s} className={c.short ? 'ps-col is-short' : 'ps-col'}>
              {c.short && <span className="ps-col-n">{c.n}d</span>}
              <span className="ps-col-bar" style={{ height: h(c.n) }} />
            </span>
          ))}
        </div>
      </div>
      <Axis />

      <Lab qual="7 cycles">History</Lab>
      <div className="ps-rows">
        <Row k="23 Jun – 20 Jul" meta="Medium flow" v="28d" />
        <Row k="28 May – 22 Jun" meta="Light flow" v="26d" open>
          <ul className="ps-facts">
            <li><span>Length</span><b>26 days &middot; 2 under typical</b></li>
            <li><span>Bleeding</span><b>4 days, light</b></li>
            <li><span>Also this cycle</span><b>Low energy, 20 May to 5 Jun</b></li>
          </ul>
          <span className="ps-link">Open the insight for this cycle</span>
        </Row>
        <Row k="30 Apr – 27 May" meta="Medium flow" v="28d" />
      </div>

      <div className="ps-prov">
        <Src kind="measured" /> Oura, nightly &middot; 3 start dates you confirmed
      </div>
    </Chrome>
  );
}

/* -- 2. Sleep -------------------------------------------------------------- *
 * Job: sleep over time, with the lowest stretches findable and openable.     */

function SleepScreen() {
  const weeks = [7.2, 7.0, 7.1, 6.9, 7.2, 6.8, 5.9, 6.6, 7.0, 6.9, 6.1, 6.7, 7.1, 6.9];
  const low = [6, 10];
  const nights = [6.4, 5.2, 5.9, 5.1, 6.3, 5.8, 6.6];

  return (
    <Chrome title="Sleep" action="calendar">
      <Seg items={['3M', '6M', '12M', 'All']} on="12M" />

      <div className="ps-figure">
        <span className="ps-fig-k">Average, last 4 weeks</span>
        <span className="ps-fig-n">6<i>h</i>54<i>m</i></span>
        <span className="ps-fig-d is-down">11m under your typical 7h 05m</span>
      </div>

      <Lab qual="Weekly average">Duration</Lab>
      <div className="ps-plot">
        <span className="ps-target" style={{ bottom: '58%' }} aria-hidden="true"><i>7h</i></span>
        <div className="ps-cols" aria-hidden="true">
          {weeks.map((v, i) => (
            <span key={i} className={low.includes(i) ? 'ps-col is-low' : 'ps-col'}>
              <span className="ps-col-bar" style={{ height: `${((v - 5.4) / 2.2) * 100}%` }} />
            </span>
          ))}
        </div>
      </div>
      <Axis />

      <div className="ps-duo">
        <span><b>7h 21m</b>Time in bed</span>
        <span><b>&plusmn;38m</b>Bedtime spread</span>
      </div>

      <Lab qual="2 found">Lowest weeks</Lab>
      <div className="ps-rows">
        <Row k="Week of 25 Mar" v="5h 54m" open>
          <div className="ps-nights" aria-hidden="true">
            {nights.map((n, i) => (
              <span key={i}>
                <i style={{ height: `${((n - 4.6) / 2.4) * 100}%` }} />
                {'MTWTFSS'[i]}
              </span>
            ))}
          </div>
          <ul className="ps-facts">
            <li><span>Under 5h 30m</span><b>3 nights</b></li>
            <li><span>Next cycle</span><b>Started 4 Apr, ran 26 days</b></li>
          </ul>
        </Row>
        <Row k="Week of 20 May" v="6h 04m" />
      </div>

      <div className="ps-prov">
        <Src kind="measured" /> Oura, nightly &middot; synced 2 hours ago
      </div>
    </Chrome>
  );
}

/* -- 3. Symptoms ----------------------------------------------------------- *
 * Job: what she reported, on the same timeline as her cycle starts.          */

function SymptomsScreen() {
  const lanes = [
    { name: 'Disrupted sleep', at: 22, w: 52, sev: 'mod' },
    { name: 'Night sweats', at: 34, w: 40, sev: 'mild' },
    { name: 'Low energy', at: 55, w: 14, sev: 'sev' },
  ];
  const starts = [4, 16, 27, 35, 42, 58, 66, 78];

  return (
    <Chrome title="Symptoms" action="filter">
      <Chips items={['All', 'Sleep', 'Energy', 'Temperature']} on="All" />

      <Lab qual="Jan to Aug">Timeline</Lab>
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
      <div className="ps-legend" aria-hidden="true">
        <span><i className="is-mild" />Mild</span>
        <span><i className="is-mod" />Moderate</span>
        <span><i className="is-sev" />Severe</span>
      </div>

      <Lab qual="Days logged">Most reported</Lab>
      <div className="ps-rows">
        <Row k="Disrupted sleep" v="34 days" open>
          <ul className="ps-facts">
            <li><span>First logged</span><b>18 Mar</b></li>
            <li><span>Most often</span><b>Moderate, 21 of 34 days</b></li>
            <li><span>Around it</span><b>Lowest-sleep week, 25 Mar</b></li>
          </ul>
        </Row>
        <Row k="Night sweats" v="21 days" />
        <Row k="Low energy" v="17 days" />
        <Row k="Headaches" meta="none since 12 Feb" v="6 days" />
      </div>

      <div className="ps-bar-action">Log a symptom</div>
      <div className="ps-prov">
        <Src kind="reported" /> Entered by you, dated as you entered it
      </div>
    </Chrome>
  );
}

/* -- 4. Medications & supplements ------------------------------------------ *
 * Job: what she takes, what she changed, and when the change happened.       */

function MedsScreen() {
  const spans = [
    { name: 'Iron, 24 mg', at: 8, w: 30, done: true },
    { name: 'Magnesium, 300 mg', at: 22, w: 78 },
    { name: 'Vitamin D, 1,000 IU', at: 62, w: 38 },
  ];
  return (
    <Chrome title="Medications" action="plus">
      <Seg items={['Current', 'All']} on="Current" />

      <Lab qual="2 items">Taking now</Lab>
      <div className="ps-cards">
        <div className="ps-card">
          <div className="ps-card-t"><b>Magnesium</b><span>300 mg</span></div>
          <div className="ps-card-m"><span>Evening</span><span>Since 14 Mar</span></div>
        </div>
        <div className="ps-card">
          <div className="ps-card-t"><b>Vitamin D</b><span>1,000 IU</span></div>
          <div className="ps-card-m"><span>Morning</span><span>Since 12 Jun</span></div>
          <span className="ps-link">Added after your 12 Jun results</span>
        </div>
      </div>

      <Lab qual="Jan to Aug">Timeline</Lab>
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

      <Lab qual="Last 6 months">Recent changes</Lab>
      <div className="ps-rows">
        <Row k="Stopped iron" v="30 Apr" open>
          <ul className="ps-facts">
            <li><span>Taken for</span><b>87 days, 2 Feb to 30 Apr</b></li>
            <li><span>Ferritin since</span><b>34 &rarr; 41 ng/mL</b></li>
          </ul>
          <span className="ps-link">See what changed after this</span>
        </Row>
        <Row k="Started vitamin D" v="12 Jun" />
        <Row k="Started magnesium" v="14 Mar" />
      </div>

      <div className="ps-prov">
        <Src kind="reported" /> You logged these. Ciatta does not remind you to take anything.
      </div>
    </Chrome>
  );
}

/* -- 5. What you told Ciatta ----------------------------------------------- *
 * Job: her own record, in her words. Deliberately unlike the measured
 * screens: no chart, no axis, no units. Warmer ground, larger type.          */

function ToldScreen() {
  return (
    <Chrome title="What you told Ciatta" action="plus">
      <Chips items={['All', 'Notes', 'Symptoms', 'Context']} on="All" />

      <Lab qual="Since January">42 entries</Lab>

      <div className="ps-entries">
        <span className="ps-month">July 2026</span>
        <blockquote className="ps-entry">
          <p>Better week. Slept through four nights.</p>
          <footer><span>3 Jul</span><span className="ps-tag-s">Sleep</span></footer>
        </blockquote>

        <span className="ps-month">June 2026</span>
        <blockquote className="ps-entry">
          <p>Started vitamin D after the last results.</p>
          <footer><span>12 Jun</span><span className="ps-tag-s">Medication</span></footer>
        </blockquote>

        <span className="ps-month">May 2026</span>
        <blockquote className="ps-entry">
          <p>Tired in a way sleep is not fixing.</p>
          <footer><span>22 May</span><span className="ps-tag-s">Energy</span></footer>
        </blockquote>

        <span className="ps-month">March 2026</span>
        <blockquote className="ps-entry is-linked">
          <p>Stopped sleeping through the night.</p>
          <footer><span>18 Mar</span><span className="ps-tag-s">Used in an insight</span></footer>
        </blockquote>
        <blockquote className="ps-entry is-linked">
          <p>Stressful stretch at work.</p>
          <footer><span>14 Mar</span><span className="ps-tag-s">Used in an insight</span></footer>
        </blockquote>

        <span className="ps-month">February 2026</span>
        <blockquote className="ps-entry">
          <p>Started iron after the last results.</p>
          <footer><span>2 Feb</span><span className="ps-tag-s">Medication</span></footer>
        </blockquote>
      </div>

      <div className="ps-bar-action is-primary">Add an entry</div>
      <div className="ps-prov">
        <Src kind="reported" /> Yours, dated, never overwritten by a device or a clinic
      </div>
    </Chrome>
  );
}

/* -- 6. Health records ----------------------------------------------------- *
 * Job: results a clinician would recognise. Value, unit, range, status,
 * date, source, and the months with nothing in them.                         */

function LabsScreen() {
  return (
    <Chrome title="Health records" action="share">
      <Seg items={['Results', 'Documents']} on="Results" />

      <div className="ps-figure is-inline">
        <span>
          <span className="ps-fig-k">Ferritin, latest</span>
          <span className="ps-fig-n is-sm">41<i>ng/mL</i></span>
        </span>
        <span className="ps-fig-side">
          <span className="ps-pill is-ok">In range</span>
          <span className="ps-fig-d is-up">up from 34 on 2 Feb</span>
        </span>
      </div>

      <Lab qual="Quest Diagnostics">12 Jun 2026</Lab>
      <table className="ps-table">
        <tbody>
          <tr><th scope="row">Ferritin</th><td className="ps-v">41 ng/mL</td><td className="ps-r">15&ndash;150</td><td><span className="ps-pill is-ok">In</span></td></tr>
          <tr><th scope="row">Vitamin D</th><td className="ps-v">26 ng/mL</td><td className="ps-r">30&ndash;100</td><td><span className="ps-pill is-low">Low</span></td></tr>
          <tr><th scope="row">TSH</th><td className="ps-v">2.3 mIU/L</td><td className="ps-r">0.4&ndash;4.0</td><td><span className="ps-pill is-ok">In</span></td></tr>
        </tbody>
      </table>

      <div className="ps-flag">
        <span className="ps-pill is-low">Low</span>
        Vitamin D below range on both draws, 28 then 26 ng/mL
      </div>

      <div className="ps-gap">
        <span className="ps-dash" aria-hidden="true" />No results between February and June
      </div>

      <Lab qual="Quest Diagnostics">2 Feb 2026</Lab>
      <table className="ps-table">
        <tbody>
          <tr><th scope="row">Ferritin</th><td className="ps-v">34 ng/mL</td><td className="ps-r">15&ndash;150</td><td><span className="ps-pill is-ok">In</span></td></tr>
          <tr><th scope="row">Vitamin D</th><td className="ps-v">28 ng/mL</td><td className="ps-r">30&ndash;100</td><td><span className="ps-pill is-low">Low</span></td></tr>
        </tbody>
      </table>

      <div className="ps-rows">
        <Row k="19 Aug 2025" meta="Northside Family Health" v="2 results" />
      </div>

      <div className="ps-bar-action">Import results</div>
      <div className="ps-prov">
        <Src kind="lab" /> 3 draws on file &middot; imported, never edited
      </div>
    </Chrome>
  );
}

/* -- 7. Personalized insight ----------------------------------------------- *
 * The anchor. The finding, what it rests on, what is published rather than
 * hers, what is still open, and the way out of the screen into a
 * conversation with a clinician.                                             */

function InsightScreen() {
  // Two sparklines on one x-axis, and a shaded window over each pairing the
  // finding rests on. Crossing a single pair of lines made the reader do the
  // work; the window says which stretch of time is being talked about.
  const cycle = 'M4 8 L28 8 L52 11 L76 17 L100 11 L124 17 L146 11';
  const sleep = 'M4 35.5 L28 36.6 L52 49.5 L76 37.7 L100 47 L124 37.7 L146 37.7';

  return (
    <Chrome title="Your health" action="share" tab="Today" dense>
      <div className="ps-ins-head">
        <span className="ps-tag">Personalized insight</span>
        <span className="ps-pill is-watch">Watching</span>
      </div>

      <div className="ps-stack">
        <p className="ps-finding">
          Your two shortest cycles followed your two lowest-sleep weeks.
        </p>
        <span className="ps-conf">
          <Src kind="worked" /> Seen twice &middot; across 7 months &middot; updated 21 Jul
        </span>
      </div>

      <div className="ps-pair">
        <div className="ps-pair-head">
          <span><i className="ps-key is-measured" />Cycle length</span>
          <span><i className="ps-key is-sleep" />Sleep</span>
        </div>
        <svg viewBox="0 0 150 54" className="ps-pair-chart" aria-hidden="true">
          {/* the two windows: a lowest-sleep week and the cycle that followed */}
          <rect x="52" y="2" width="24" height="50" rx="2" fill="var(--ps-clay)" opacity="0.13" />
          <rect x="100" y="2" width="24" height="50" rx="2" fill="var(--ps-clay)" opacity="0.13" />
          <path d={cycle} fill="none" stroke="var(--ps-measured)" strokeWidth="1.6" />
          <path d={sleep} fill="none" stroke="var(--ps-ink)" strokeWidth="1.5" opacity="0.75" />
          <g fill="var(--ps-clay)">
            <circle cx="52" cy="49.5" r="2.4" /><circle cx="76" cy="17" r="2.4" />
            <circle cx="100" cy="47" r="2.4" /><circle cx="124" cy="17" r="2.4" />
          </g>
        </svg>
        <span className="ps-pair-note">
          A lowest-sleep week, then a short cycle inside ten days. Twice.
        </span>
      </div>

      <Lab qual="4 sources">Based on</Lab>
      <div className="ps-rows is-tight">
        <Row k="Two shortest cycles" meta="4 Apr · 28 May" v="26d" />
        <Row k="Two lowest-sleep weeks" meta="25 Mar · 20 May" v="5h 54m" />
        <Row k="Disrupted sleep" meta="from 18 Mar" v="34d" />
        <Row k="“A stressful stretch at work”" meta="14 Mar" />
      </div>

      <div className="ps-stack">
        {/* Published evidence is visibly not her data: its own family, its own
            ground, and a source line that says plainly who it was about. */}
        <div className="ps-ev">
          <span className="ps-ev-k">Relevant evidence</span>
          <p>Shorter sleep is associated with cycle variability in published cohorts.</p>
          <span className="ps-cite">2,300 women &middot; published 2019 &middot; not about you</span>
        </div>
        <p className="ps-open">
          <span>Still open</span> Whether this repeats across your next two cycles.
        </p>
        <p className="ps-hedge">Things that move together are not one causing the other.</p>
      </div>

      <div className="ps-stack is-actions">
        <div className="ps-bar-action is-primary">Prepare for your appointment</div>
        <span className="ps-link is-centred">See how this was worked out</span>
      </div>
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
  { name: 'Health records', Screen: LabsScreen },
  { name: 'Cycle', Screen: CycleScreen },
  { name: 'Sleep', Screen: SleepScreen },
  { name: 'Personalized insight', Screen: InsightScreen },
  { name: 'Symptoms', Screen: SymptomsScreen },
  { name: 'Medications', Screen: MedsScreen },
  { name: 'What you told Ciatta', Screen: ToldScreen },
] as const;

const N = SCREENS.length;
const HALF = (N - 1) / 2;
const INSIGHT_INDEX = 3;

const PROGRESSION = [
  'What changed',
  'What was happening around it',
  'What you told Ciatta',
  'Relevant evidence',
  'What may be worth discussing',
] as const;

export function ProductShowcase() {
  const [active, setActive] = useState(INSIGHT_INDEX);
  const [held, setHeld] = useState(false);
  const prevOffsets = useRef<number[]>([]);
  const drag = useRef<{ x: number } | null>(null);

  const step = (d: number) => setActive((a) => (a + d + N) % N);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (held) return;
    // `active` is a dependency so the timer re-arms on every change: a manual
    // choice is never overridden by a tick already part-way through. The dwell
    // is long because these screens are meant to be read, not glimpsed.
    const id = window.setTimeout(() => step(1), 5200);
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
          All the pieces. <em>One picture.</em>
        </h2>
        <p className="showcase-lede">Your health doesn&rsquo;t change one thing at a time.</p>
        <p className="showcase-sub">
          Ciatta brings your health information together to surface personalized
          insights, so you can understand what&rsquo;s changing, know what may be worth
          exploring, and have a better conversation with your clinician.
        </p>
      </div>

      <div className="shell">
        <ul className="ps-sources">
          {SCREENS.map(({ name }, i) => (
            <li key={name}>
              <button
                type="button"
                className={
                  'ps-source' +
                  (i === active ? ' is-on' : '') +
                  (i === INSIGHT_INDEX ? ' is-insight' : '')
                }
                aria-current={i === active ? 'true' : undefined}
                onClick={() => setActive(i)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
        <span className="ps-arrow" aria-hidden="true">&darr;</span>
      </div>

      <div
        className="showcase-stage"
        aria-hidden="true"
        onPointerDown={(e) => { drag.current = { x: e.clientX }; setHeld(true); }}
        onPointerUp={(e) => {
          const d = drag.current; drag.current = null; setHeld(false);
          if (d && Math.abs(e.clientX - d.x) > 40) step(e.clientX - d.x < 0 ? 1 : -1);
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
              >
                <Screen />
              </div>
            );
          })}
        </div>
      </div>

      <div className="shell">
        <span className="ps-arrow" aria-hidden="true">&darr;</span>
        <ol className="ps-progression">
          {PROGRESSION.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="showcase-foot">
          The insight is not a seventh thing Ciatta collected. It is what the other six
          say when they are read together.
        </p>
      </div>
    </section>
  );
}
