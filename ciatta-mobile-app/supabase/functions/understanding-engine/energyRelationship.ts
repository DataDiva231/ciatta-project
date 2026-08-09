/**
 * Pure cycle -> energy relationship analysis. No Deno/Supabase imports —
 * same testing approach as cycleAnalysis.ts. Deliberately separate from
 * (and only imports *types* from) cycleAnalysis.ts rather than refactoring
 * shared windowing logic out of it: that file is already deployed and
 * verified, and a small amount of duplicated windowing math is a better
 * trade than risking a regression in it for the sake of DRY.
 *
 * The question this answers: when resting heart rate rises in the luteal
 * phase, does self-reported energy actually drop in that same window, for
 * this same person? RHR-vs-cycle is a Understanding about the body alone;
 * this is a Relationship because it requires two independently-observed
 * signals (physiological + subjective) to agree before it counts.
 */
import type { CycleWindow, CycleDelta, Strength } from './cycleAnalysis.ts';

export interface EnergyObservation {
  id: string;
  recordedAt: string;
  rating: number; // 1 (Low) .. 4 (Great)
}

interface EnergyPhaseDelta {
  cycleIndex: number;
  sufficientData: boolean;
  delta: number | null; // luteal mean - follicular mean
  confirms: boolean; // a meaningful energy *drop* in the luteal window
  observationIds: string[];
}

// Must match cycleAnalysis.ts's PHASE_WINDOW_DAYS — both analyses are
// windowing the same cycles the same way, just with different signals.
const PHASE_WINDOW_DAYS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// Energy answers are sparse by design (one curiosity a day, rotating across
// 3 domains), so this floor is intentionally much lower than RHR's — an
// 8-day window realistically yields 2-3 answers for a single domain.
const MIN_ENERGY_SAMPLES_PER_WINDOW = 2;
const MIN_ENERGY_DROP = 0.5; // on the 1-4 scale
const MIN_CYCLES_FOR_CONFIDENCE = 3;
const CONFIDENCE_SAMPLE_CAP = 6;
const MIN_COOCCURRENCE_RATE = 0.5;
const DISCOVERY_CONFIDENCE_THRESHOLD = 0.6; // "strong" tier — see strengthForConfidence

function computeEnergyPhaseDeltas(
  cycles: CycleWindow[],
  energyObs: EnergyObservation[]
): EnergyPhaseDelta[] {
  const sorted = energyObs
    .map((o) => ({ ...o, date: new Date(o.recordedAt) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return cycles.map((cycle) => {
    if (cycle.lengthDays < PHASE_WINDOW_DAYS * 2) {
      return { cycleIndex: cycle.cycleIndex, sufficientData: false, delta: null, confirms: false, observationIds: [] };
    }

    const follicularEnd = new Date(cycle.start.getTime() + PHASE_WINDOW_DAYS * DAY_MS);
    const lutealStart = new Date(cycle.end.getTime() - PHASE_WINDOW_DAYS * DAY_MS);

    const follicular = sorted.filter((o) => o.date >= cycle.start && o.date < follicularEnd);
    const luteal = sorted.filter((o) => o.date >= lutealStart && o.date < cycle.end);

    const sufficientData =
      follicular.length >= MIN_ENERGY_SAMPLES_PER_WINDOW &&
      luteal.length >= MIN_ENERGY_SAMPLES_PER_WINDOW;

    if (!sufficientData) {
      return { cycleIndex: cycle.cycleIndex, sufficientData: false, delta: null, confirms: false, observationIds: [] };
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const follicularMean = mean(follicular.map((o) => o.rating));
    const lutealMean = mean(luteal.map((o) => o.rating));
    const delta = lutealMean - follicularMean;

    return {
      cycleIndex: cycle.cycleIndex,
      sufficientData: true,
      delta,
      confirms: delta <= -MIN_ENERGY_DROP,
      observationIds: [...follicular, ...luteal].map((o) => o.id),
    };
  });
}

export interface RelationshipResult {
  cyclesWithBothSignals: number;
  cyclesCoOccurring: number;
  coOccurrenceRate: number;
  avgEnergyDelta: number | null;
  avgRhrDelta: number | null;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeEnergyRelationship(
  cycles: CycleWindow[],
  rhrDeltas: CycleDelta[],
  energyObs: EnergyObservation[]
): RelationshipResult {
  const energyDeltas = computeEnergyPhaseDeltas(cycles, energyObs);
  const rhrByIndex = new Map(rhrDeltas.map((d) => [d.cycleIndex, d]));

  let cyclesWithBothSignals = 0;
  let cyclesCoOccurring = 0;
  const energyDeltaValues: number[] = [];
  const rhrDeltaValues: number[] = [];
  const observationIds: string[] = [];

  for (const ed of energyDeltas) {
    const rd = rhrByIndex.get(ed.cycleIndex);
    if (!rd || !rd.sufficientData || !ed.sufficientData) continue;

    cyclesWithBothSignals++;
    if (ed.delta !== null) energyDeltaValues.push(ed.delta);
    if (rd.deltaBpm !== null) rhrDeltaValues.push(rd.deltaBpm);
    observationIds.push(...ed.observationIds, ...rd.observationIds);
    if (ed.confirms && rd.confirms) cyclesCoOccurring++;
  }

  const coOccurrenceRate = cyclesWithBothSignals > 0 ? cyclesCoOccurring / cyclesWithBothSignals : 0;
  const eligible =
    cyclesWithBothSignals >= MIN_CYCLES_FOR_CONFIDENCE && coOccurrenceRate >= MIN_COOCCURRENCE_RATE;
  const confidence = eligible
    ? coOccurrenceRate * Math.min(1, cyclesWithBothSignals / CONFIDENCE_SAMPLE_CAP)
    : 0;

  const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    cyclesWithBothSignals,
    cyclesCoOccurring,
    coOccurrenceRate,
    avgEnergyDelta: mean(energyDeltaValues),
    avgRhrDelta: mean(rhrDeltaValues),
    confidence,
    eligible,
    observationIds,
  };
}

const RELATIONSHIP_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function strengthForConfidence(confidence: number): Strength {
  if (confidence < 0.3) return 'emerging';
  if (confidence < 0.6) return 'moderate';
  if (confidence < 0.85) return 'strong';
  return 'very-strong';
}

export interface RelationshipDraft {
  strength: Strength;
  confidenceLabel: string;
}

export function buildRelationship(result: RelationshipResult): RelationshipDraft | null {
  if (!result.eligible) return null;
  const strength = strengthForConfidence(result.confidence);
  return { strength, confidenceLabel: RELATIONSHIP_LABEL[strength] };
}

export interface DiscoveryDraft {
  narrative: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
}

/**
 * A Relationship becomes a Discovery — a milestone worth surfacing, not
 * just a live-updating stat — only once it's corroborated strongly
 * (confidence >= 0.6, the "strong" tier). Below that it's real but not
 * yet a story worth telling.
 */
export function buildDiscovery(result: RelationshipResult): DiscoveryDraft | null {
  if (!result.eligible || result.confidence < DISCOVERY_CONFIDENCE_THRESHOLD) return null;
  if (result.avgEnergyDelta === null || result.avgRhrDelta === null) return null;

  const strength = strengthForConfidence(result.confidence);
  const energyDrop = Math.abs(result.avgEnergyDelta).toFixed(1);
  const rhrRise = result.avgRhrDelta.toFixed(1);

  return {
    narrative:
      "Your energy tends to dip in the same days your resting heart rate rises — usually in the two weeks before your period.",
    detail: `Across ${result.cyclesWithBothSignals} cycles I had both signals for, your energy dropped by about ${energyDrop} points (on a 4-point scale) in the same window your resting heart rate rose by about ${rhrRise} bpm, together in ${result.cyclesCoOccurring} of them.`,
    confidence: result.confidence,
    confidenceLabel: RELATIONSHIP_LABEL[strength],
  };
}
