/**
 * Pure sleep analysis: no Deno/Supabase imports, same testing approach as
 * cycleAnalysis.ts. Two things live here:
 *
 * 1. A standalone 'sleep' Understanding — how much you sleep and how often
 *    you fall noticeably short of your own average. Purely descriptive;
 *    there's no alternative hypothesis to confirm here the way there was
 *    for the cycle/RHR rule, so confidence scales with sample size alone.
 *
 * 2. A sleep -> energy Relationship — does self-reported energy actually
 *    run lower the day after a short night, for this person specifically.
 *    Same two-independent-signals discipline as the cycle -> energy rule.
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForConfidence } from './cycleAnalysis.ts';
import type { EnergyObservation } from './energyRelationship.ts';

export interface SleepObservation {
  id: string;
  type: 'sleep_session' | 'sleep_segment';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  stage?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MIN_NIGHTS = 14;
const SHORT_NIGHT_THRESHOLD_MINUTES = 45;
const MIN_NIGHTS_PER_GROUP = 5;
const MIN_ENERGY_DROP = 0.5; // on the 1-4 scale, same floor as the cycle rule
const CONFIDENCE_SAMPLE_CAP_UNDERSTANDING = 30;
const CONFIDENCE_SAMPLE_CAP_RELATIONSHIP = 12;

function isAsleepStage(stage: string | null | undefined): boolean {
  return stage !== 'in_bed' && stage !== 'awake';
}

// A sleep observation is bucketed into "the night of" whichever calendar
// date is 12 hours before it ends — a 7am wake-up keys to the previous
// evening's date, which is how people actually talk about "last night's
// sleep." A same-day nap ending mid-afternoon keys to that same day, which
// is an acceptable imprecision for a rare case rather than something worth
// a more elaborate heuristic.
function nightKey(endTime: string): string {
  const d = new Date(new Date(endTime).getTime() - 12 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function nightlySleepMinutes(observations: SleepObservation[]): Map<string, number> {
  const byNight = new Map<string, number>();
  for (const obs of observations) {
    if (obs.type === 'sleep_segment' && !isAsleepStage(obs.stage)) continue;
    const key = nightKey(obs.endTime);
    byNight.set(key, (byNight.get(key) ?? 0) + obs.durationMinutes);
  }
  return byNight;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface SleepUnderstandingResult {
  totalNights: number;
  avgMinutes: number;
  shortNights: number;
  shortNightRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeSleep(observations: SleepObservation[]): SleepUnderstandingResult {
  const byNight = nightlySleepMinutes(observations);
  const nights = [...byNight.values()];
  const totalNights = nights.length;

  if (totalNights < BASELINE_MIN_NIGHTS) {
    return {
      totalNights,
      avgMinutes: 0,
      shortNights: 0,
      shortNightRate: 0,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const baseline = median(nights);
  const avgMinutes = nights.reduce((a, b) => a + b, 0) / totalNights;
  const shortNights = nights.filter((m) => m < baseline - SHORT_NIGHT_THRESHOLD_MINUTES).length;

  return {
    totalNights,
    avgMinutes,
    shortNights,
    shortNightRate: shortNights / totalNights,
    confidence: Math.min(1, totalNights / CONFIDENCE_SAMPLE_CAP_UNDERSTANDING),
    eligible: true,
    observationIds: observations.map((o) => o.id),
  };
}

export interface SleepUnderstandingDraft {
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

export function buildSleepUnderstanding(result: SleepUnderstandingResult): SleepUnderstandingDraft | null {
  if (!result.eligible) return null;
  const strength = strengthForConfidence(result.confidence);
  const hours = Math.floor(result.avgMinutes / 60);
  const minutes = Math.round(result.avgMinutes % 60);
  const pct = Math.round(result.shortNightRate * 100);
  return {
    strength,
    narrative: `You average about ${hours}h ${minutes}m of sleep a night. About ${pct}% of your nights fall noticeably short of that.`,
    confidenceLabel: CONFIDENCE_LABEL[strength],
  };
}

export interface SleepEnergyRelationshipResult {
  nightsWithBothSignals: number;
  shortNightCount: number;
  normalNightCount: number;
  avgEnergyAfterShort: number | null;
  avgEnergyAfterNormal: number | null;
  energyDelta: number | null; // normal - short; positive means energy really is lower after short sleep
  confirms: boolean;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeSleepEnergyRelationship(
  sleepObservations: SleepObservation[],
  energyObservations: EnergyObservation[]
): SleepEnergyRelationshipResult {
  const byNight = nightlySleepMinutes(sleepObservations);
  const nightKeys = [...byNight.keys()];

  if (nightKeys.length < BASELINE_MIN_NIGHTS) {
    return {
      nightsWithBothSignals: 0,
      shortNightCount: 0,
      normalNightCount: 0,
      avgEnergyAfterShort: null,
      avgEnergyAfterNormal: null,
      energyDelta: null,
      confirms: false,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const baseline = median([...byNight.values()]);

  const energyByDay = new Map<string, { rating: number; id: string }[]>();
  for (const obs of energyObservations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const list = energyByDay.get(key) ?? [];
    list.push({ rating: obs.rating, id: obs.id });
    energyByDay.set(key, list);
  }

  const shortEnergies: number[] = [];
  const normalEnergies: number[] = [];
  const observationIds: string[] = [];

  for (const night of nightKeys) {
    const nextDay = new Date(new Date(night).getTime() + DAY_MS).toISOString().slice(0, 10);
    const nextDayEnergy = energyByDay.get(nextDay);
    if (!nextDayEnergy || nextDayEnergy.length === 0) continue;

    const avgNextDayEnergy =
      nextDayEnergy.reduce((a, b) => a + b.rating, 0) / nextDayEnergy.length;
    const isShort = (byNight.get(night) ?? 0) < baseline - SHORT_NIGHT_THRESHOLD_MINUTES;

    if (isShort) {
      shortEnergies.push(avgNextDayEnergy);
    } else {
      normalEnergies.push(avgNextDayEnergy);
    }
    observationIds.push(...nextDayEnergy.map((e) => e.id));
  }

  const nightsWithBothSignals = shortEnergies.length + normalEnergies.length;
  const eligible =
    shortEnergies.length >= MIN_NIGHTS_PER_GROUP && normalEnergies.length >= MIN_NIGHTS_PER_GROUP;

  if (!eligible) {
    return {
      nightsWithBothSignals,
      shortNightCount: shortEnergies.length,
      normalNightCount: normalEnergies.length,
      avgEnergyAfterShort: null,
      avgEnergyAfterNormal: null,
      energyDelta: null,
      confirms: false,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgEnergyAfterShort = mean(shortEnergies);
  const avgEnergyAfterNormal = mean(normalEnergies);
  const energyDelta = avgEnergyAfterNormal - avgEnergyAfterShort;
  const confirms = energyDelta >= MIN_ENERGY_DROP;

  const confidence = confirms
    ? Math.min(1, nightsWithBothSignals / CONFIDENCE_SAMPLE_CAP_RELATIONSHIP)
    : 0;

  return {
    nightsWithBothSignals,
    shortNightCount: shortEnergies.length,
    normalNightCount: normalEnergies.length,
    avgEnergyAfterShort,
    avgEnergyAfterNormal,
    energyDelta,
    confirms,
    confidence,
    eligible: confirms,
    observationIds,
  };
}

export interface SleepDiscoveryDraft {
  narrative: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
  suggestedNames: string[];
}

const SUGGESTED_NAMES = ['The Short-Night Effect', 'Sleep Debt Signal', 'The Morning After'];
const DISCOVERY_CONFIDENCE_THRESHOLD = 0.6;

export function buildSleepEnergyDiscovery(
  result: SleepEnergyRelationshipResult
): SleepDiscoveryDraft | null {
  if (!result.eligible || result.confidence < DISCOVERY_CONFIDENCE_THRESHOLD) return null;
  if (result.energyDelta === null) return null;

  const strength = strengthForConfidence(result.confidence);
  const drop = Math.abs(result.energyDelta).toFixed(1);

  return {
    narrative: "Your energy tends to be lower the day after a short night's sleep.",
    detail: `Comparing ${result.shortNightCount} short nights against ${result.normalNightCount} more typical ones, your next-day energy ran about ${drop} points lower (on a 4-point scale) after the short nights.`,
    confidence: result.confidence,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    suggestedNames: SUGGESTED_NAMES,
  };
}
