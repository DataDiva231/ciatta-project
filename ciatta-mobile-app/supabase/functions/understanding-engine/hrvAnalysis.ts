/**
 * Pure HRV analysis: no Deno/Supabase imports, same testing approach as
 * every other module here. Structurally identical to stepsAnalysis.ts —
 * both feed the 'recovery' Understanding — but averages same-day readings
 * instead of summing them, since HRV is a physiological state, not a
 * cumulative quantity like steps. Uses a gentler low-day threshold (30%
 * below baseline vs steps' 50%) since HRV is typically less volatile
 * day-to-day than step count, so a smaller relative dip already means
 * something.
 *
 * HealthKit reports SDNN, Health Connect reports RMSSD — both real HRV
 * metrics, computed differently, currently read as one undifferentiated
 * 'hrv' signal (noted in the ingestion code, not silently pretended away).
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

export interface HrvObservation {
  id: string;
  recordedAt: string;
  ms: number;
}

const BASELINE_MIN_DAYS = 14;
const LOW_HRV_RATIO = 0.7;
const CONFIDENCE_SAMPLE_CAP = 30;

export function dailyHrvAverages(observations: HrvObservation[]): Map<string, DailyMetricDay> {
  const byDay = new Map<string, { sum: number; count: number; ids: string[] }>();
  for (const obs of observations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { sum: 0, count: 0, ids: [] };
    entry.sum += obs.ms;
    entry.count += 1;
    entry.ids.push(obs.id);
    byDay.set(key, entry);
  }
  const result = new Map<string, DailyMetricDay>();
  for (const [key, { sum, count, ids }] of byDay) {
    result.set(key, { value: sum / count, ids });
  }
  return result;
}

export interface HrvUnderstandingResult {
  totalDays: number;
  avgMs: number;
  lowHrvDays: number;
  lowHrvRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeHrv(observations: HrvObservation[]): HrvUnderstandingResult {
  const byDay = dailyHrvAverages(observations);
  const days = [...byDay.values()];
  const totalDays = days.length;

  if (totalDays < BASELINE_MIN_DAYS) {
    return {
      totalDays,
      avgMs: 0,
      lowHrvDays: 0,
      lowHrvRate: 0,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const values = days.map((d) => d.value);
  const baseline = median(values);
  const avgMs = values.reduce((a, b) => a + b, 0) / totalDays;
  const lowHrvDays = values.filter((v) => v < baseline * LOW_HRV_RATIO).length;

  return {
    totalDays,
    avgMs,
    lowHrvDays,
    lowHrvRate: lowHrvDays / totalDays,
    confidence: Math.min(1, totalDays / CONFIDENCE_SAMPLE_CAP),
    eligible: true,
    observationIds: days.flatMap((d) => d.ids),
  };
}

export interface HrvUnderstandingDraft {
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

export function buildHrvUnderstanding(result: HrvUnderstandingResult): HrvUnderstandingDraft | null {
  if (!result.eligible) return null;
  const strength = strengthForConfidence(result.confidence);
  const avgMs = Math.round(result.avgMs);
  const pct = Math.round(result.lowHrvRate * 100);
  return {
    strength,
    narrative: `Your heart rate variability averages about ${avgMs}ms. About ${pct}% of your days run notably lower than that.`,
    confidenceLabel: CONFIDENCE_LABEL[strength],
  };
}

export function analyzeHrvRatingRelationship(
  hrvObservations: HrvObservation[],
  ratingObservations: RatingObservation[]
): DailyMetricRatingRelationshipResult {
  return analyzeDailyMetricRatingRelationship(
    dailyHrvAverages(hrvObservations),
    ratingObservations,
    BASELINE_MIN_DAYS,
    LOW_HRV_RATIO
  );
}

const HRV_DISCOVERY_COPY = {
  lowDayLabel: 'day with lower HRV',
  lowDayLabelPlural: 'days with lower HRV',
  narrative: {
    energy: 'Your energy tends to be lower the day after your HRV dips.',
    mood: 'Your mood tends to dip the day after your HRV runs low.',
  },
  suggestedNames: {
    energy: ['The HRV Signal', 'Nervous System Rebound', 'The Recovery Lag'],
    mood: ['HRV and Mood', 'The Recovery-Mood Link', 'The Quiet Signal'],
  },
};

export function buildHrvRatingDiscovery(
  result: DailyMetricRatingRelationshipResult,
  toDomain: 'energy' | 'mood'
): DailyMetricDiscoveryDraft | null {
  return buildDailyMetricRatingDiscovery(result, HRV_DISCOVERY_COPY, toDomain);
}
