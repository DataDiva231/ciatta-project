/**
 * Pure steps analysis: no Deno/Supabase imports, same testing approach as
 * cycleAnalysis.ts and sleepAnalysis.ts. Produces the first standalone
 * 'energy' Understanding — until now 'energy' only ever appeared as the
 * target of a Relationship (cycle -> energy, sleep -> energy), never
 * described on its own.
 *
 * Steps sync automatically every day from Health Connect/HealthKit, with
 * none of the once-daily curiosity rotation's sparsity — this is real,
 * dense, already-flowing data that no rule has used yet. Purely
 * descriptive, same as the sleep Understanding: there's no alternative
 * hypothesis to confirm, so confidence scales with sample size alone.
 *
 * The copy here is deliberately about steps, never about how the user
 * feels — "how much you moved" is what's actually measured, not "your
 * energy level," and conflating the two would be exactly the kind of
 * overclaim this engine has avoided everywhere else.
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForConfidence } from './cycleAnalysis.ts';

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
