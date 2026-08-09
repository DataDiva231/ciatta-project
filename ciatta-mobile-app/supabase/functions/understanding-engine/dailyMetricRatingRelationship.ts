/**
 * Pure "does a day where a daily metric falls notably below this person's
 * own baseline predict a lower self-reported rating the next day."
 *
 * This is the third occurrence of this exact shape (sleep -> rating, steps
 * -> rating, now HRV -> rating) — unlike the earlier decision to duplicate
 * cycleAnalysis.ts's windowing rather than extract it (a genuinely
 * different, already-deployed algorithm), this is the *same* algorithm
 * three times over, so it's extracted here rather than copy-pasted again.
 * Callers own their own daily aggregation (steps sums same-day entries,
 * HRV averages them — physically different operations) and pass in the
 * already-aggregated {day -> value} map; everything downstream of that is
 * identical regardless of which signal it came from.
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForConfidence } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS_PER_GROUP = 5;
const MIN_RATING_DROP = 0.5; // on the 1-4 scale, same floor as every other rating relationship
const CONFIDENCE_SAMPLE_CAP = 12;
const DISCOVERY_CONFIDENCE_THRESHOLD = 0.6;

export function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface DailyMetricDay {
  value: number;
  ids: string[];
}

export interface DailyMetricRatingRelationshipResult {
  daysWithBothSignals: number;
  lowDayCount: number;
  normalDayCount: number;
  avgRatingAfterLow: number | null;
  avgRatingAfterNormal: number | null;
  ratingDelta: number | null; // normal - low; positive means the rating really is lower after a low day
  confirms: boolean;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeDailyMetricRatingRelationship(
  dailyMetric: Map<string, DailyMetricDay>,
  ratingObservations: RatingObservation[],
  minDaysForBaseline: number,
  lowThresholdRatio: number
): DailyMetricRatingRelationshipResult {
  const dayKeys = [...dailyMetric.keys()];

  if (dayKeys.length < minDaysForBaseline) {
    return {
      daysWithBothSignals: 0,
      lowDayCount: 0,
      normalDayCount: 0,
      avgRatingAfterLow: null,
      avgRatingAfterNormal: null,
      ratingDelta: null,
      confirms: false,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const baseline = median([...dailyMetric.values()].map((d) => d.value));

  const ratingByDay = new Map<string, { rating: number; id: string }[]>();
  for (const obs of ratingObservations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const list = ratingByDay.get(key) ?? [];
    list.push({ rating: obs.rating, id: obs.id });
    ratingByDay.set(key, list);
  }

  const lowRatings: number[] = [];
  const normalRatings: number[] = [];
  const observationIds: string[] = [];

  for (const day of dayKeys) {
    const nextDay = new Date(new Date(day).getTime() + DAY_MS).toISOString().slice(0, 10);
    const nextDayRatings = ratingByDay.get(nextDay);
    if (!nextDayRatings || nextDayRatings.length === 0) continue;

    const avgNextDayRating =
      nextDayRatings.reduce((a, b) => a + b.rating, 0) / nextDayRatings.length;
    const isLow = (dailyMetric.get(day)?.value ?? 0) < baseline * lowThresholdRatio;

    if (isLow) {
      lowRatings.push(avgNextDayRating);
    } else {
      normalRatings.push(avgNextDayRating);
    }
    observationIds.push(...nextDayRatings.map((r) => r.id), ...(dailyMetric.get(day)?.ids ?? []));
  }

  const daysWithBothSignals = lowRatings.length + normalRatings.length;
  const eligible =
    lowRatings.length >= MIN_DAYS_PER_GROUP && normalRatings.length >= MIN_DAYS_PER_GROUP;

  if (!eligible) {
    return {
      daysWithBothSignals,
      lowDayCount: lowRatings.length,
      normalDayCount: normalRatings.length,
      avgRatingAfterLow: null,
      avgRatingAfterNormal: null,
      ratingDelta: null,
      confirms: false,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgRatingAfterLow = mean(lowRatings);
  const avgRatingAfterNormal = mean(normalRatings);
  const ratingDelta = avgRatingAfterNormal - avgRatingAfterLow;
  const confirms = ratingDelta >= MIN_RATING_DROP;

  const confidence = confirms ? Math.min(1, daysWithBothSignals / CONFIDENCE_SAMPLE_CAP) : 0;

  return {
    daysWithBothSignals,
    lowDayCount: lowRatings.length,
    normalDayCount: normalRatings.length,
    avgRatingAfterLow,
    avgRatingAfterNormal,
    ratingDelta,
    confirms,
    confidence,
    eligible: confirms,
    observationIds,
  };
}

export interface DailyMetricDiscoveryDraft {
  narrative: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
  suggestedNames: string[];
}

export interface DailyMetricDiscoveryCopy {
  lowDayLabel: string; // e.g. "low-activity day" or "day with lower HRV"
  lowDayLabelPlural: string; // e.g. "low-activity days"
  narrative: Record<'energy' | 'mood', string>;
  suggestedNames: Record<'energy' | 'mood', string[]>;
}

const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function buildDailyMetricRatingDiscovery(
  result: DailyMetricRatingRelationshipResult,
  copy: DailyMetricDiscoveryCopy,
  toDomain: 'energy' | 'mood'
): DailyMetricDiscoveryDraft | null {
  if (!result.eligible || result.confidence < DISCOVERY_CONFIDENCE_THRESHOLD) return null;
  if (result.ratingDelta === null) return null;

  const strength = strengthForConfidence(result.confidence);
  const drop = Math.abs(result.ratingDelta).toFixed(1);
  const label = toDomain;

  return {
    narrative: copy.narrative[toDomain],
    detail: `Comparing ${result.lowDayCount} ${copy.lowDayLabelPlural} against ${result.normalDayCount} more typical ones, your next-day ${label} ran about ${drop} points lower (on a 4-point scale) after those days.`,
    confidence: result.confidence,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    suggestedNames: copy.suggestedNames[toDomain],
  };
}
