import { displayCopy } from './displayCopy';
import type { Domain, Strength } from './types';
import { vizColor } from '../theme/tokens';

export type InsightChartKind =
  | 'line'
  | 'bars'
  | 'area'
  | 'band'
  | 'divergent'
  | 'still-learning';

export type DailyPoint = {
  day: string;
  value: number;
  label: string;
};

export type SeriesPack = {
  sleepMinutes: DailyPoint[];
  hrvMs: DailyPoint[];
  rhrBpm: DailyPoint[];
  steps: DailyPoint[];
  energyRating: DailyPoint[];
  moodRating: DailyPoint[];
};

export type UnderstandingSignal = {
  domain: Domain;
  strength: Strength;
  narrative: string;
  stillLearning: string[];
  lastUpdated: string;
  observationsCount: number;
};

export type RelationshipSignal = {
  from: Domain;
  to: Domain;
  strength: Strength;
};

export type InsightViewModel = {
  id: string;
  domain?: Domain;
  catalog: string;
  title: string;
  headline: string;
  metricLine: string;
  context: string;
  tryLabel: string | null;
  color: string;
  kind: InsightChartKind;
  points: DailyPoint[];
  yGuides?: { value: number; label: string }[];
  baseline?: number;
  band?: { min: number; max: number };
  badge?: string;
};

export type InsightSelectionInput = {
  understandings: UnderstandingSignal[];
  relationships: RelationshipSignal[];
  goals: string[];
  series: SeriesPack;
  featuredDomain?: Domain;
  now?: Date;
  shownCatalogId?: string | null;
  focusDomain?: Domain;
  excludeIds?: string[];
  /** When false, thin series yield no chart instead of a placeholder. */
  allowStillLearning?: boolean;
};

const STRENGTH_SCORE: Record<Strength, number> = {
  emerging: 0.22,
  moderate: 0.5,
  strong: 0.82,
  'very-strong': 1,
};

const MIN_POINTS = 4;
const SHOW_FLOOR = 0.34;

const GOAL_HINTS: Record<string, string[]> = {
  sleep: ['sleep', 'rest', 'night', 'insomnia', 'bed'],
  recovery: ['recover', 'hrv', 'strain', 'rest'],
  energy: ['energy', 'tired', 'fatigue', 'active'],
  cycle: ['cycle', 'period', 'hormone', 'fertility'],
  mood: ['mood', 'stress', 'anxi', 'feel'],
  stress: ['stress', 'hrv', 'overwhelm', 'tension'],
};

type Candidate = InsightViewModel & {
  score: number;
};

function windowLine(points: DailyPoint[], metric: string): string {
  if (points.length === 0) return displayCopy(metric);
  const first = points[0].label;
  const last = points[points.length - 1].label;
  return displayCopy(`${metric} | ${first} to ${last}`);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

function changeMagnitude(points: DailyPoint[]): number {
  if (points.length < 2) return 0;
  const values = points.map((p) => p.value);
  const avg = mean(values);
  if (avg === 0) return 0;
  const span = Math.max(...values) - Math.min(...values);
  const recent = values[values.length - 1] - values[0];
  return Math.min(1, (Math.abs(recent) / avg + span / avg) / 2);
}

function varianceAdds(points: DailyPoint[]): number {
  if (points.length < 3) return 0;
  const values = points.map((p) => p.value);
  const avg = mean(values);
  if (avg === 0) return 0;
  const sd = Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
  return Math.min(1, sd / Math.abs(avg));
}

function recencyScore(iso: string, now: Date): number {
  const hours = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3600000);
  if (hours <= 6) return 1;
  if (hours <= 24) return 0.75;
  if (hours <= 72) return 0.45;
  return 0.2;
}

function goalScore(keys: string[], goals: string[]): number {
  if (goals.length === 0) return 0.15;
  const blob = goals.join(' ').toLowerCase();
  return keys.some((k) => GOAL_HINTS[k]?.some((h) => blob.includes(h))) ? 1 : 0.08;
}

function understandingFor(
  list: UnderstandingSignal[],
  domain: Domain
): UnderstandingSignal | undefined {
  return list.find((u) => u.domain === domain);
}

function tryLabel(u?: UnderstandingSignal): string | null {
  const open = u?.stillLearning[0];
  if (open) return displayCopy(open);
  if (u) return 'See why this holds';
  return null;
}

function headlineFrom(u: UnderstandingSignal | undefined, fallback: string): string {
  const n = u?.narrative?.trim();
  if (n) return displayCopy(n);
  return displayCopy(fallback);
}

function rank(
  base: Omit<Candidate, 'score'>,
  opts: {
    understanding?: UnderstandingSignal;
    featured?: Domain;
    goals: string[];
    goalKeys: string[];
    now: Date;
    shownCatalogId?: string | null;
    points: DailyPoint[];
  }
): Candidate {
  const strength = opts.understanding ? STRENGTH_SCORE[opts.understanding.strength] : 0.12;
  const relevance =
    opts.featured && opts.understanding?.domain === opts.featured ? 1 : opts.understanding ? 0.55 : 0.2;
  const change = changeMagnitude(opts.points);
  const novelty = opts.shownCatalogId && opts.shownCatalogId === base.id ? 0.15 : 1;
  const adds = varianceAdds(opts.points);
  const goal = goalScore(opts.goalKeys, opts.goals);
  const recency = opts.understanding ? recencyScore(opts.understanding.lastUpdated, opts.now) : 0.3;
  const score =
    relevance * 0.24 +
    strength * 0.22 +
    change * 0.2 +
    goal * 0.14 +
    recency * 0.1 +
    adds * 0.1 +
    novelty * 0.1;
  return { ...base, score };
}

function stillLearningCard(title: string, catalog: string, domain?: Domain): InsightViewModel {
  return {
    id: 'still_learning',
    domain,
    catalog,
    title: displayCopy(title),
    headline: displayCopy("I don't have enough data to see a clear pattern yet."),
    metricLine: displayCopy('Still taking shape'),
    context: displayCopy('As more days arrive, this will take shape here.'),
    tryLabel: null,
    color: vizColor.still,
    kind: 'still-learning',
    points: [
      { day: '1', value: 2, label: '' },
      { day: '2', value: 3, label: '' },
      { day: '3', value: 2.4, label: '' },
      { day: '4', value: 3.2, label: '' },
      { day: '5', value: 2.6, label: '' },
      { day: '6', value: 2.2, label: '' },
      { day: '7', value: 2.8, label: '' },
    ],
  };
}

function buildCandidates(input: InsightSelectionInput): Candidate[] {
  const now = input.now ?? new Date();
  const { series, understandings, featuredDomain, goals, shownCatalogId } = input;
  const out: Candidate[] = [];

  const sleepU = understandingFor(understandings, 'sleep');
  if (series.sleepMinutes.length >= MIN_POINTS && sleepU) {
    out.push(
      rank(
        {
          id: 'sleep_trend',
          domain: 'sleep',
          catalog: '01',
          title: displayCopy('Sleep'),
          headline: headlineFrom(sleepU, 'Your nights have been shifting.'),
          metricLine: windowLine(series.sleepMinutes, 'Sleep duration'),
          context: displayCopy(
            sleepU.stillLearning[0] ?? 'Quieter nights sit higher. Shorter ones sit lower.'
          ),
          tryLabel: tryLabel(sleepU),
          color: vizColor.plum,
          kind: 'line',
          points: series.sleepMinutes,
          yGuides: [
            { value: 480, label: 'Good' },
            { value: 390, label: 'Okay' },
            { value: 300, label: 'Poor' },
          ],
        },
        {
          understanding: sleepU,
          featured: featuredDomain,
          goals,
          goalKeys: ['sleep'],
          now,
          shownCatalogId,
          points: series.sleepMinutes,
        }
      )
    );
  }

  const recoveryU = understandingFor(understandings, 'recovery');
  const moodU = understandingFor(understandings, 'mood');
  const hrvHost = recoveryU ?? moodU;
  if (series.hrvMs.length >= MIN_POINTS && hrvHost) {
    out.push(
      rank(
        {
          id: 'hrv_bars',
          domain: hrvHost.domain,
          catalog: '02',
          title: displayCopy('Stress and HRV'),
          headline: headlineFrom(hrvHost, 'Your body has been under more load than usual.'),
          metricLine: windowLine(series.hrvMs, 'Heart rate variability'),
          context: displayCopy(
            hrvHost.stillLearning[0] ?? 'Higher bars mean more variable rest between beats.'
          ),
          tryLabel: tryLabel(hrvHost),
          color: vizColor.sage,
          kind: 'bars',
          points: series.hrvMs,
        },
        {
          understanding: hrvHost,
          featured: featuredDomain,
          goals,
          goalKeys: ['recovery', 'stress', 'mood'],
          now,
          shownCatalogId,
          points: series.hrvMs,
        }
      )
    );
  }

  if (series.rhrBpm.length >= MIN_POINTS && (recoveryU || sleepU || understandingFor(understandings, 'cycle'))) {
    const host = recoveryU ?? sleepU ?? understandingFor(understandings, 'cycle');
    const baseline = mean(series.rhrBpm.map((p) => p.value));
    out.push(
      rank(
        {
          id: 'rhr_line',
          domain: host?.domain,
          catalog: '03',
          title: displayCopy('Resting heart rate'),
          headline: headlineFrom(host, 'Your resting heart rate has moved off its usual place.'),
          metricLine: windowLine(series.rhrBpm, 'Resting heart rate'),
          context: displayCopy(host?.stillLearning[0] ?? 'The dashed line is your usual range this week.'),
          tryLabel: tryLabel(host),
          color: vizColor.ocean,
          kind: 'line',
          points: series.rhrBpm,
          baseline,
        },
        {
          understanding: host,
          featured: featuredDomain,
          goals,
          goalKeys: ['recovery', 'sleep', 'cycle'],
          now,
          shownCatalogId,
          points: series.rhrBpm,
        }
      )
    );
  }

  const energyU = understandingFor(understandings, 'energy');
  const energyPts = series.energyRating.length >= MIN_POINTS ? series.energyRating : series.steps;
  if (energyPts.length >= MIN_POINTS && energyU) {
    const metric = series.energyRating.length >= MIN_POINTS ? 'Energy' : 'Steps';
    out.push(
      rank(
        {
          id: 'energy_bars',
          domain: 'energy',
          catalog: '06',
          title: displayCopy('Energy'),
          headline: headlineFrom(energyU, 'Your energy has been moving day to day.'),
          metricLine: windowLine(energyPts, metric),
          context: displayCopy(energyU.stillLearning[0] ?? 'Taller marks are fuller days.'),
          tryLabel: tryLabel(energyU),
          color: vizColor.amber,
          kind: 'bars',
          points: energyPts,
        },
        {
          understanding: energyU,
          featured: featuredDomain,
          goals,
          goalKeys: ['energy'],
          now,
          shownCatalogId,
          points: energyPts,
        }
      )
    );
  }

  if (series.moodRating.length >= MIN_POINTS && moodU) {
    out.push(
      rank(
        {
          id: 'mood_line',
          domain: 'mood',
          catalog: '08',
          title: displayCopy('Mood'),
          headline: headlineFrom(moodU, 'How you have been feeling has a shape this week.'),
          metricLine: windowLine(series.moodRating, 'Mood'),
          context: displayCopy(moodU.stillLearning[0] ?? 'This is the week as you named it.'),
          tryLabel: tryLabel(moodU),
          color: vizColor.ink,
          kind: 'area',
          points: series.moodRating,
        },
        {
          understanding: moodU,
          featured: featuredDomain,
          goals,
          goalKeys: ['mood', 'stress'],
          now,
          shownCatalogId,
          points: series.moodRating,
        }
      )
    );
  }

  const related = input.relationships.find(
    (r) =>
      (r.from === 'sleep' && r.to === 'recovery') ||
      (r.to === 'sleep' && r.from === 'recovery')
  );
  if (
    related &&
    series.sleepMinutes.length >= MIN_POINTS &&
    series.hrvMs.length >= MIN_POINTS &&
    (sleepU || recoveryU)
  ) {
    const host = STRENGTH_SCORE[related.strength] >= 0.8 ? recoveryU ?? sleepU : sleepU ?? recoveryU;
    const aligned = series.sleepMinutes.map((p, i) => {
      const h = series.hrvMs.find((h) => h.day === p.day) ?? series.hrvMs[i];
      const sleepN = p.value / 480;
      const hrvN = h ? h.value / (mean(series.hrvMs.map((x) => x.value)) || 1) : 0;
      return { ...p, value: sleepN - hrvN };
    });
    out.push(
      rank(
        {
          id: 'recovery_balance',
          domain: host?.domain,
          catalog: '07',
          title: displayCopy('Recovery'),
          headline: headlineFrom(host, 'Rest and strain have been pulling in different directions.'),
          metricLine: windowLine(aligned, 'Recovery balance'),
          context: displayCopy(
            host?.stillLearning[0] ?? 'Marks above show rest. Marks below show more load than rest.'
          ),
          tryLabel: tryLabel(host),
          color: vizColor.sage,
          kind: 'divergent',
          points: aligned,
        },
        {
          understanding: host,
          featured: featuredDomain,
          goals,
          goalKeys: ['recovery', 'sleep'],
          now,
          shownCatalogId,
          points: aligned,
        }
      )
    );
  }

  return out;
}

/**
 * Ranked visualization candidates. The same selection the Narrative Engine
 * already uses; callers pick how many to surface.
 */
export function listInsightCandidates(input: InsightSelectionInput): InsightViewModel[] {
  const focused = input.focusDomain
    ? input.understandings.filter((u) => u.domain === input.focusDomain)
    : input.understandings;

  if (focused.length === 0 && !input.focusDomain) return [];

  const scoped: InsightSelectionInput = {
    ...input,
    understandings: input.focusDomain ? focused : input.understandings,
    featuredDomain: input.focusDomain ?? input.featuredDomain,
  };

  let candidates = buildCandidates(scoped);
  if (input.focusDomain) {
    const allowed = new Set(
      {
        sleep: ['sleep_trend', 'rhr_line'],
        recovery: ['hrv_bars', 'rhr_line', 'recovery_balance'],
        energy: ['energy_bars'],
        cycle: ['rhr_line'],
        mood: ['mood_line', 'hrv_bars'],
      }[input.focusDomain]
    );
    candidates = candidates.filter((c) => allowed.has(c.id));
  }

  const excluded = new Set(input.excludeIds ?? []);
  const ranked = [...candidates]
    .filter((c) => !excluded.has(c.id))
    .sort((a, b) => b.score - a.score);

  return ranked
    .filter((c) => c.score >= SHOW_FLOOR)
    .map(({ score: _score, ...view }) => view);
}

/**
 * Picks at most one insight visualization. Returns still-learning when an
 * understanding exists but the series is too thin to plot, unless
 * allowStillLearning is false. Returns null when nothing is worth plotting.
 */
export function selectInsightVisualization(input: InsightSelectionInput): InsightViewModel | null {
  const focused = input.focusDomain
    ? input.understandings.filter((u) => u.domain === input.focusDomain)
    : input.understandings;

  if (focused.length === 0 && !input.focusDomain) return null;

  const listed = listInsightCandidates(input);
  if (listed.length === 0) {
    if (input.allowStillLearning === false) return null;
    if (focused.length > 0 || input.focusDomain) {
      const title = input.focusDomain
        ? { sleep: 'Sleep', recovery: 'Recovery', energy: 'Energy', cycle: 'Cycle', mood: 'Mood' }[
            input.focusDomain
          ]
        : 'Still learning';
      return stillLearningCard(title, '10', input.focusDomain);
    }
    return null;
  }

  let pick = listed[0];
  const runner = listed[1];
  if (runner && input.shownCatalogId === pick.id) {
    pick = runner;
  }
  return pick;
}

export function toUnderstandingSignals(
  rows: {
    domain: Domain;
    strength: Strength;
    narrative: string;
    still_learning: string[];
    last_updated: string;
    observations_count: number;
  }[]
): UnderstandingSignal[] {
  return rows.map((r) => ({
    domain: r.domain,
    strength: r.strength,
    narrative: r.narrative,
    stillLearning: r.still_learning,
    lastUpdated: r.last_updated,
    observationsCount: r.observations_count,
  }));
}
