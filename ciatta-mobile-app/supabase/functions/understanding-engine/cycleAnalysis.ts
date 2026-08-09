/**
 * Pure cycle-phase analysis: no Deno/Supabase imports, so this can be unit
 * tested with plain Node/tsc and reused unchanged if the engine ever moves
 * off Edge Functions. `index.ts` is the only thing that talks to the DB.
 *
 * The rule: resting heart rate tends to run higher in the luteal phase
 * (progesterone-driven) than the follicular phase. We test that, per user,
 * against their own history rather than a population norm.
 */

export interface FlowObservation {
  id: string;
  recordedAt: string; // ISO timestamp
  cycleStart?: boolean | null; // trusted signal, e.g. HealthKit's HKMenstrualCycleStart
}

export interface RhrObservation {
  id: string;
  recordedAt: string; // ISO timestamp
  bpm: number;
}

export interface CycleWindow {
  cycleIndex: number;
  start: Date;
  end: Date; // exclusive — start of the next cycle
  lengthDays: number;
}

export interface CycleDelta {
  cycleIndex: number;
  start: Date;
  sufficientData: boolean;
  follicularMeanBpm: number | null;
  lutealMeanBpm: number | null;
  deltaBpm: number | null;
  follicularSampleCount: number;
  lutealSampleCount: number;
  confirms: boolean;
  observationIds: string[];
}

export interface CycleAnalysisResult {
  cyclesDetected: number;
  cyclesWithSufficientData: number;
  cyclesConfirming: number;
  confirmationRate: number; // 0..1, only meaningful when cyclesWithSufficientData > 0
  avgDeltaBpm: number | null;
  confidence: number; // 0..1
  eligible: boolean; // enough cycles AND the pattern actually holds
  deltas: CycleDelta[];
  observationIds: string[];
  firstCycleStart: Date | null;
}

// Window (in days) counted from each end of a cycle, used as a structural
// proxy for "early/follicular" vs "late/luteal" since we don't have
// ovulation-detection inputs (BBT, OPK) to find the actual boundary.
const PHASE_WINDOW_DAYS = 8;
const MIN_SAMPLES_PER_WINDOW = 5;
const MIN_DELTA_BPM = 1.0;
const MIN_CYCLES_FOR_CONFIDENCE = 3;
const CONFIDENCE_SAMPLE_CAP = 6;
const MIN_CONFIRMATION_RATE = 0.5;
const MIN_CYCLE_LENGTH_DAYS = 18;
const MAX_CYCLE_LENGTH_DAYS = 60;
const GAP_DAYS_FOR_NEW_PERIOD = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Collapses same-day flow readings into period-start days, then pairs
 * consecutive starts into fully-bounded cycles (the current, still-ongoing
 * cycle has no end yet and is excluded).
 */
export function detectCycles(flowObs: FlowObservation[]): CycleWindow[] {
  if (flowObs.length === 0) return [];

  const sorted = [...flowObs].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const flowDays = new Map<string, { date: Date; cycleStart: boolean }>();
  for (const obs of sorted) {
    const date = new Date(obs.recordedAt);
    const key = dayKey(date);
    const existing = flowDays.get(key);
    flowDays.set(key, {
      date,
      cycleStart: existing?.cycleStart || obs.cycleStart === true,
    });
  }

  const days = [...flowDays.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

  const periodStarts: Date[] = [];
  let lastFlowDate: Date | null = null;
  for (const day of days) {
    const gapDays = lastFlowDate
      ? (day.date.getTime() - lastFlowDate.getTime()) / DAY_MS
      : Infinity;
    if (day.cycleStart || gapDays >= GAP_DAYS_FOR_NEW_PERIOD) {
      periodStarts.push(day.date);
    }
    lastFlowDate = day.date;
  }

  const cycles: CycleWindow[] = [];
  for (let i = 0; i < periodStarts.length - 1; i++) {
    const start = periodStarts[i];
    const end = periodStarts[i + 1];
    const lengthDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    if (lengthDays < MIN_CYCLE_LENGTH_DAYS || lengthDays > MAX_CYCLE_LENGTH_DAYS) {
      // Implausible as a real cycle — likely a gap in tracking, not a
      // genuine short/long cycle. Excluded rather than guessed at.
      continue;
    }
    cycles.push({ cycleIndex: cycles.length, start, end, lengthDays });
  }

  return cycles;
}

export function analyzeCycles(
  cycles: CycleWindow[],
  rhrObs: RhrObservation[]
): CycleAnalysisResult {
  const rhrSorted = rhrObs
    .map((o) => ({ ...o, date: new Date(o.recordedAt) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const deltas: CycleDelta[] = cycles.map((cycle) => {
    if (cycle.lengthDays < PHASE_WINDOW_DAYS * 2) {
      return {
        cycleIndex: cycle.cycleIndex,
        start: cycle.start,
        sufficientData: false,
        follicularMeanBpm: null,
        lutealMeanBpm: null,
        deltaBpm: null,
        follicularSampleCount: 0,
        lutealSampleCount: 0,
        confirms: false,
        observationIds: [],
      };
    }

    const follicularEnd = new Date(cycle.start.getTime() + PHASE_WINDOW_DAYS * DAY_MS);
    const lutealStart = new Date(cycle.end.getTime() - PHASE_WINDOW_DAYS * DAY_MS);

    const follicular = rhrSorted.filter((o) => o.date >= cycle.start && o.date < follicularEnd);
    const luteal = rhrSorted.filter((o) => o.date >= lutealStart && o.date < cycle.end);

    const sufficientData =
      follicular.length >= MIN_SAMPLES_PER_WINDOW && luteal.length >= MIN_SAMPLES_PER_WINDOW;

    if (!sufficientData) {
      return {
        cycleIndex: cycle.cycleIndex,
        start: cycle.start,
        sufficientData: false,
        follicularMeanBpm: null,
        lutealMeanBpm: null,
        deltaBpm: null,
        follicularSampleCount: follicular.length,
        lutealSampleCount: luteal.length,
        confirms: false,
        observationIds: [],
      };
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const follicularMeanBpm = mean(follicular.map((o) => o.bpm));
    const lutealMeanBpm = mean(luteal.map((o) => o.bpm));
    const deltaBpm = lutealMeanBpm - follicularMeanBpm;

    return {
      cycleIndex: cycle.cycleIndex,
      start: cycle.start,
      sufficientData: true,
      follicularMeanBpm,
      lutealMeanBpm,
      deltaBpm,
      follicularSampleCount: follicular.length,
      lutealSampleCount: luteal.length,
      confirms: deltaBpm >= MIN_DELTA_BPM,
      observationIds: [...follicular, ...luteal].map((o) => o.id),
    };
  });

  const sufficient = deltas.filter((d) => d.sufficientData);
  const cyclesWithSufficientData = sufficient.length;
  const cyclesConfirming = sufficient.filter((d) => d.confirms).length;
  const confirmationRate = cyclesWithSufficientData > 0 ? cyclesConfirming / cyclesWithSufficientData : 0;
  const avgDeltaBpm =
    cyclesWithSufficientData > 0
      ? sufficient.reduce((sum, d) => sum + (d.deltaBpm ?? 0), 0) / cyclesWithSufficientData
      : null;

  const eligible =
    cyclesWithSufficientData >= MIN_CYCLES_FOR_CONFIDENCE && confirmationRate >= MIN_CONFIRMATION_RATE;

  const confidence = eligible
    ? confirmationRate * Math.min(1, cyclesWithSufficientData / CONFIDENCE_SAMPLE_CAP)
    : 0;

  return {
    cyclesDetected: cycles.length,
    cyclesWithSufficientData,
    cyclesConfirming,
    confirmationRate,
    avgDeltaBpm,
    confidence,
    eligible,
    deltas,
    observationIds: sufficient.flatMap((d) => d.observationIds),
    firstCycleStart: cycles.length > 0 ? cycles[0].start : null,
  };
}

export type Strength = 'emerging' | 'moderate' | 'strong' | 'very-strong';

export function strengthForConfidence(confidence: number): Strength {
  if (confidence < 0.3) return 'emerging';
  if (confidence < 0.6) return 'moderate';
  if (confidence < 0.85) return 'strong';
  return 'very-strong';
}

export interface UnderstandingDraft {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
  stillLearning: string[];
}

const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function buildUnderstanding(result: CycleAnalysisResult): UnderstandingDraft | null {
  if (!result.eligible || result.avgDeltaBpm === null) return null;

  const strength = strengthForConfidence(result.confidence);
  const delta = result.avgDeltaBpm.toFixed(1);

  return {
    strength,
    narrative: `Your resting heart rate tends to run about ${delta} bpm higher in the days before your period. I've noticed this in ${result.cyclesConfirming} of the ${result.cyclesWithSufficientData} cycles I've tracked so far.`,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    stillLearning: [
      'exactly how many days before your period this shift starts',
      'how this connects to your energy day-to-day',
    ],
  };
}
