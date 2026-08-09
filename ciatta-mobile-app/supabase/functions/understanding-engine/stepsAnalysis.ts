/**
 * Pure steps analysis: no Deno/Supabase imports, same testing approach as
 * cycleAnalysis.ts and sleepAnalysis.ts. Two things live here:
 *
 * 1. A standalone 'recovery' Understanding — filed as recovery rather than
 *    energy specifically so it can cleanly relate *to* energy/mood via a
 *    Relationship the same way cycle and sleep do (filing it under
 *    'energy' would make a steps -> energy Relationship a nonsensical
 *    energy -> energy self-reference). Purely descriptive: there's no
 *    alternative hypothesis to confirm, so confidence scales with sample
 *    size alone. The copy is deliberately about steps, never about how the
 *    user feels — "how much you moved" is what's actually measured, not
 *    "your energy level," and conflating the two would be exactly the kind
 *    of overclaim this engine has avoided everywhere else.
 *
 * 2. A recovery -> {energy, mood} Relationship, built on the shared
 *    dailyMetricRatingRelationship primitive (steps sum same-day entries;
 *    HRV's version of this same pattern averages them instead, which is
 *    why aggregation stays per-module and only the classification/
 *    comparison logic is shared).
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForConfidence } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';
import {
  median,
  analyzeDailyMetricRatingRelationship,
  buildDailyMetricRatingDiscovery,
  type DailyMetricDay,
  type DailyMetricRatingRelationshipResult,
  type DailyMetricDiscoveryDraft,
} from './dailyMetricRatingRelationship.ts';

export interface StepsObservation {
  id: string;
  recordedAt: string;
  count: number;
}

const BASELINE_MIN_DAYS = 14;
// A day counts as "low activity" if it falls well below this person's own
// median — a relative threshold, not a fixed step count, since a
// meaningful "low" day for someone who averages 3,000 steps looks nothing
// like one for someone who averages 15,000.
const LOW_ACTIVITY_RATIO = 0.5;
const CONFIDENCE_SAMPLE_CAP = 30;

export function dailyStepTotals(observations: StepsObservation[]): Map<string, DailyMetricDay> {
  const byDay = new Map<string, DailyMetricDay>();
  for (const obs of observations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { value: 0, ids: [] };
    entry.value += obs.count;
    entry.ids.push(obs.id);
    byDay.set(key, entry);
  }
  return byDay;
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

  const totals = days.map((d) => d.value);
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

export function analyzeStepsRatingRelationship(
  stepsObservations: StepsObservation[],
  ratingObservations: RatingObservation[]
): DailyMetricRatingRelationshipResult {
  return analyzeDailyMetricRatingRelationship(
    dailyStepTotals(stepsObservations),
    ratingObservations,
    BASELINE_MIN_DAYS,
    LOW_ACTIVITY_RATIO
  );
}

const STEPS_DISCOVERY_COPY = {
  lowDayLabel: 'low-activity day',
  lowDayLabelPlural: 'low-activity days',
  narrative: {
    energy: "Your energy tends to be lower the day after a low-activity day.",
    mood: "Your mood tends to dip the day after a low-activity day.",
  },
  suggestedNames: {
    energy: ['The Movement Effect', 'Activity-Energy Link', 'The Rest Day Rebound'],
    mood: ['The Movement-Mood Link', 'Motion and Mood', 'The Stillness Signal'],
  },
};

export function buildStepsRatingDiscovery(
  result: DailyMetricRatingRelationshipResult,
  toDomain: 'energy' | 'mood'
): DailyMetricDiscoveryDraft | null {
  return buildDailyMetricRatingDiscovery(result, STEPS_DISCOVERY_COPY, toDomain);
}
