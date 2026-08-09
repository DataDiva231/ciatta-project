/**
 * Pure steps analysis: no Deno/Supabase imports, same testing approach as
 * cycleAnalysis.ts and sleepAnalysis.ts. Three things live here:
 *
 * 1. A standalone 'recovery' Understanding — until now 'recovery' had no
 *    signal at all. Filed as recovery rather than energy specifically so
 *    it can cleanly relate *to* energy/mood via a Relationship the same
 *    way cycle and sleep do (filing it under 'energy' would make a
 *    steps -> energy Relationship a nonsensical energy -> energy
 *    self-reference). Purely descriptive: there's no alternative
 *    hypothesis to confirm, so confidence scales with sample size alone.
 *    The copy is deliberately about steps, never about how the user
 *    feels — "how much you moved" is what's actually measured, not "your
 *    energy level," and conflating the two would be exactly the kind of
 *    overclaim this engine has avoided everywhere else.
 *
 * 2. A recovery -> {energy, mood} Relationship — does a self-reported
 *    rating actually run lower the day after a low-activity day. Steps
 *    sync automatically every day with none of the curiosity rotation's
 *    sparsity (unlike e.g. sleep_interruption vs energy_rating, which
 *    almost never land close enough together to pair), so this is
 *    structurally sound the same way sleep -> rating is.
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForConfidence } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

export interface StepsObservation {
  id: string;
  recordedAt: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MIN_DAYS = 14;
// A day counts as "low activity" if it falls well below this person's own
// median — a relative threshold, not a fixed step count, since a
// meaningful "low" day for someone who averages 3,000 steps looks nothing
// like one for someone who averages 15,000.
const LOW_ACTIVITY_RATIO = 0.5;
const CONFIDENCE_SAMPLE_CAP = 30;
const MIN_DAYS_PER_GROUP = 5;
const MIN_RATING_DROP = 0.5; // on the 1-4 scale, same floor as every other rating relationship
const CONFIDENCE_SAMPLE_CAP_RELATIONSHIP = 12;
const DISCOVERY_CONFIDENCE_THRESHOLD = 0.6;

function dailyStepTotals(observations: StepsObservation[]): Map<string, { total: number; ids: string[] }> {
  const byDay = new Map<string, { total: number; ids: string[] }>();
  for (const obs of observations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { total: 0, ids: [] };
    entry.total += obs.count;
    entry.ids.push(obs.id);
    byDay.set(key, entry);
  }
  return byDay;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface StepsUnderstandingResult {
  totalDays: number;
  avgSteps: number;
  lowActivityDays: number;
  lowActivityRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeSteps(observations: StepsObservation[]): StepsUnderstandingResult {
  const byDay = dailyStepTotals(observations);
  const days = [...byDay.values()];
  const totalDays = days.length;

  if (totalDays < BASELINE_MIN_DAYS) {
    return {
      totalDays,
      avgSteps: 0,
      lowActivityDays: 0,
      lowActivityRate: 0,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const totals = days.map((d) => d.total);
  const baseline = median(totals);
  const avgSteps = totals.reduce((a, b) => a + b, 0) / totalDays;
  const lowActivityDays = totals.filter((t) => t < baseline * LOW_ACTIVITY_RATIO).length;

  return {
    totalDays,
    avgSteps,
    lowActivityDays,
    lowActivityRate: lowActivityDays / totalDays,
    confidence: Math.min(1, totalDays / CONFIDENCE_SAMPLE_CAP),
    eligible: true,
    observationIds: days.flatMap((d) => d.ids),
  };
}

export interface StepsUnderstandingDraft {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
}

const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function buildStepsUnderstanding(
  result: StepsUnderstandingResult
): StepsUnderstandingDraft | null {
  if (!result.eligible) return null;
  const strength = strengthForConfidence(result.confidence);
  const avgSteps = Math.round(result.avgSteps).toLocaleString('en-US');
  const pct = Math.round(result.lowActivityRate * 100);
  return {
    strength,
    narrative: `You average about ${avgSteps} steps a day. About ${pct}% of your days are notably less active than that.`,
    confidenceLabel: CONFIDENCE_LABEL[strength],
  };
}

export interface StepsRatingRelationshipResult {
  daysWithBothSignals: number;
  lowActivityDayCount: number;
  normalDayCount: number;
  avgRatingAfterLow: number | null;
  avgRatingAfterNormal: number | null;
  ratingDelta: number | null; // normal - low; positive means the rating really is lower after a low-activity day
  confirms: boolean;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

/** Generic over which 1-4 rating (energy, mood) it's tested against, same
 * as sleep's version — does a low-activity day predict a lower rating the
 * next day, for this person specifically. */
export function analyzeStepsRatingRelationship(
  stepsObservations: StepsObservation[],
  ratingObservations: RatingObservation[]
): StepsRatingRelationshipResult {
  const byDay = dailyStepTotals(stepsObservations);
  const dayKeys = [...byDay.keys()];

  if (dayKeys.length < BASELINE_MIN_DAYS) {
    return {
      daysWithBothSignals: 0,
      lowActivityDayCount: 0,
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

  const baseline = median([...byDay.values()].map((d) => d.total));

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
    const isLow = (byDay.get(day)?.total ?? 0) < baseline * LOW_ACTIVITY_RATIO;

    if (isLow) {
      lowRatings.push(avgNextDayRating);
    } else {
      normalRatings.push(avgNextDayRating);
    }
    observationIds.push(...nextDayRatings.map((r) => r.id), ...(byDay.get(day)?.ids ?? []));
  }

  const daysWithBothSignals = lowRatings.length + normalRatings.length;
  const eligible =
    lowRatings.length >= MIN_DAYS_PER_GROUP && normalRatings.length >= MIN_DAYS_PER_GROUP;

  if (!eligible) {
    return {
      daysWithBothSignals,
      lowActivityDayCount: lowRatings.length,
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

  const confidence = confirms
    ? Math.min(1, daysWithBothSignals / CONFIDENCE_SAMPLE_CAP_RELATIONSHIP)
    : 0;

  return {
    daysWithBothSignals,
    lowActivityDayCount: lowRatings.length,
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

export interface StepsDiscoveryDraft {
  narrative: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
  suggestedNames: string[];
}

const RATING_DOMAIN_COPY: Record<
  'energy' | 'mood',
  { narrative: string; label: string; suggestedNames: string[] }
> = {
  energy: {
    narrative: "Your energy tends to be lower the day after a low-activity day.",
    label: 'energy',
    suggestedNames: ['The Movement Effect', 'Activity-Energy Link', 'The Rest Day Rebound'],
  },
  mood: {
    narrative: "Your mood tends to dip the day after a low-activity day.",
    label: 'mood',
    suggestedNames: ['The Movement-Mood Link', 'Motion and Mood', 'The Stillness Signal'],
  },
};

export function buildStepsRatingDiscovery(
  result: StepsRatingRelationshipResult,
  toDomain: 'energy' | 'mood'
): StepsDiscoveryDraft | null {
  if (!result.eligible || result.confidence < DISCOVERY_CONFIDENCE_THRESHOLD) return null;
  if (result.ratingDelta === null) return null;

  const strength = strengthForConfidence(result.confidence);
  const drop = Math.abs(result.ratingDelta).toFixed(1);
  const copy = RATING_DOMAIN_COPY[toDomain];

  return {
    narrative: copy.narrative,
    detail: `Comparing ${result.lowActivityDayCount} low-activity days against ${result.normalDayCount} more typical ones, your next-day ${copy.label} ran about ${drop} points lower (on a 4-point scale) after the low-activity days.`,
    confidence: result.confidence,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    suggestedNames: copy.suggestedNames,
  };
}
