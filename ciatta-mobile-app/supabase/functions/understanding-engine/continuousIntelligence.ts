/**
 * Continuous intelligence planner — decides *which* existing processors to
 * run and *when*, without replacing them.
 *
 * The Understanding Engine still owns analysis, evidence thresholds, and
 * writes. This module is only the adaptive cadence layer: observation type
 * → processor subset, debounce/batch, meaningful-change override, and
 * idempotent-write detection. Nightly reconciliation stays the default
 * full run (see planForMode('nightly')).
 */
export type ProcessorName =
  | 'cycle'
  | 'sleep'
  | 'recovery'
  | 'mood'
  | 'contextual'
  | 'provider_feedback';

export type EngineMode = 'nightly' | 'continuous' | 'morning';

export interface RunPlan {
  processors: ProcessorName[];
  runDecay: boolean;
  runCrossDomain: boolean;
  runMorningState: boolean;
}

type Cadence = { kind: 'immediate' } | { kind: 'debounce'; minIntervalMs: number } | { kind: 'morning' };

interface Route {
  processors: ProcessorName[];
  cadence: Cadence;
}

const TWO_MINUTES_MS = 2 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
export const CONTINUOUS_RETRY_MS = 5 * 60 * 1000;
const MEANINGFUL_RELATIVE_DELTA = 0.1;

const ROUTES: Record<string, Route> = {
  hrv: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: TWO_MINUTES_MS } },
  heart_rate: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: TWO_MINUTES_MS } },
  steps: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  resting_heart_rate: { processors: ['cycle'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  menstrual_flow: { processors: ['cycle'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  sleep_session: { processors: [], cadence: { kind: 'morning' } },
  sleep_segment: { processors: [], cadence: { kind: 'morning' } },
  body_temperature: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  wrist_temperature: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  basal_body_temperature: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  temperature: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  workout: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  active_energy: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  basal_energy: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  oxygen_saturation: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  respiratory_rate: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  vo2_max: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  walking_heart_rate_average: { processors: ['recovery'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  blood_pressure_systolic: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  blood_pressure_diastolic: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  body_mass: { processors: [], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  ovulation_test_result: { processors: ['cycle'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  intermenstrual_bleeding: { processors: ['cycle'], cadence: { kind: 'debounce', minIntervalMs: ONE_HOUR_MS } },
  mood_rating: { processors: ['mood'], cadence: { kind: 'immediate' } },
  energy_rating: { processors: ['cycle', 'recovery'], cadence: { kind: 'immediate' } },
  health_concern: { processors: ['contextual'], cadence: { kind: 'immediate' } },
  health_concern_detail: { processors: ['contextual'], cadence: { kind: 'immediate' } },
  health_concern_recency: { processors: ['contextual'], cadence: { kind: 'immediate' } },
  provider_assessment: { processors: ['provider_feedback'], cadence: { kind: 'immediate' } },
  provider_outcome: { processors: ['provider_feedback'], cadence: { kind: 'immediate' } },
};

const NIGHTLY_PROCESSORS: ProcessorName[] = [
  'cycle',
  'sleep',
  'recovery',
  'mood',
  'contextual',
  'provider_feedback',
];

const IMMEDIATE_TYPES = new Set(
  Object.entries(ROUTES)
    .filter(([, route]) => route.cadence.kind === 'immediate')
    .map(([type]) => type)
);

function uniqueInOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function processorsForObservationTypes(types: string[]): ProcessorName[] {
  const processors: ProcessorName[] = [];
  for (const type of types) {
    const route = ROUTES[type];
    if (!route) continue;
    processors.push(...route.processors);
  }
  return uniqueInOrder(processors);
}

export function planForMode(mode: EngineMode, observationTypes: string[] = []): RunPlan {
  if (mode === 'nightly') {
    return {
      processors: [...NIGHTLY_PROCESSORS],
      runDecay: true,
      runCrossDomain: true,
      runMorningState: true,
    };
  }
  if (mode === 'morning') {
    return {
      processors: ['sleep'],
      runDecay: false,
      runCrossDomain: false,
      runMorningState: true,
    };
  }
  return {
    processors: processorsForObservationTypes(observationTypes),
    runDecay: false,
    runCrossDomain: false,
    runMorningState: false,
  };
}

export function debounceMsForTypes(types: string[]): number {
  let min = Number.POSITIVE_INFINITY;
  let sawRoute = false;
  for (const type of types) {
    const route = ROUTES[type];
    if (!route) continue;
    sawRoute = true;
    if (route.cadence.kind === 'immediate') return 0;
    if (route.cadence.kind === 'morning') continue;
    min = Math.min(min, route.cadence.minIntervalMs);
  }
  if (!sawRoute || !Number.isFinite(min)) return ONE_HOUR_MS;
  return min;
}

export function shouldRunProcessor(args: {
  processor: ProcessorName;
  mode: EngineMode;
  lastRunAt: string | null;
  now: string;
  meaningfulChange: boolean;
  minIntervalMs?: number;
}): { run: boolean; reason: string } {
  if (args.mode === 'nightly') return { run: true, reason: 'nightly' };
  if (args.mode === 'morning') {
    return args.processor === 'sleep'
      ? { run: true, reason: 'morning-sleep' }
      : { run: false, reason: 'morning-skips-non-sleep' };
  }
  if (args.processor === 'sleep') return { run: false, reason: 'sleep-is-morning' };

  const minIntervalMs = args.minIntervalMs ?? TWO_MINUTES_MS;
  if (args.meaningfulChange) return { run: true, reason: 'meaningful-change' };
  if (!args.lastRunAt) return { run: true, reason: 'never-run' };

  const elapsed = Date.parse(args.now) - Date.parse(args.lastRunAt);
  if (elapsed < minIntervalMs) return { run: false, reason: 'debounced' };
  return { run: true, reason: 'cadence-elapsed' };
}

export function isMeaningfulChange(args: {
  type: string;
  previousValue?: number | null;
  nextValue?: number | null;
  cycleStart?: boolean;
}): boolean {
  if (args.cycleStart) return true;
  if (IMMEDIATE_TYPES.has(args.type)) return true;
  // HR/HRV "real swing" is latestDayIsLowVsPersonalBaseline() in
  // hrvAnalysis.ts — the existing personal-median / 30% low-day rule.
  // A pairwise sample delta here would be a second, weaker threshold.
  if (args.type === 'hrv' || args.type === 'heart_rate') return false;
  if (args.previousValue == null || args.nextValue == null) return false;
  if (args.previousValue === 0) return args.nextValue !== 0;
  const relative = Math.abs(args.nextValue - args.previousValue) / Math.abs(args.previousValue);
  return relative >= MEANINGFUL_RELATIVE_DELTA;
}

export interface PendingWork {
  processors: ProcessorName[];
  observationTypes: string[];
  latestObservationId: string;
  notBeforeMs: number;
}

export function mergePendingWork(existing: PendingWork, incoming: PendingWork): PendingWork {
  return {
    processors: uniqueInOrder([...existing.processors, ...incoming.processors]),
    observationTypes: uniqueInOrder([...existing.observationTypes, ...incoming.observationTypes]),
    latestObservationId: incoming.latestObservationId,
    notBeforeMs: Math.min(existing.notBeforeMs, incoming.notBeforeMs),
  };
}

export function runFingerprint(
  userId: string,
  processors: ProcessorName[],
  latestObservationId: string | null
): string {
  return `${userId}:${[...processors].sort().join(',')}:${latestObservationId ?? ''}`;
}

export interface UnderstandingSnapshot {
  strength: string;
  narrative: string;
  confidenceLabel: string;
  observationsCount: number;
  stillLearning: string[];
}

export function isRedundantUnderstandingWrite(
  existing: UnderstandingSnapshot,
  next: UnderstandingSnapshot
): boolean {
  return (
    existing.strength === next.strength &&
    existing.narrative === next.narrative &&
    existing.confidenceLabel === next.confidenceLabel &&
    existing.observationsCount === next.observationsCount &&
    existing.stillLearning.join('\0') === next.stillLearning.join('\0')
  );
}

export function dueWork(notBeforeMs: number, nowMs: number): boolean {
  return nowMs >= notBeforeMs;
}

export function retryNotBeforeMs(failedAtMs: number): number {
  return failedAtMs + CONTINUOUS_RETRY_MS;
}

export function workBelongsToUser(rowUserId: string, requestedUserId: string | undefined): boolean {
  if (!requestedUserId) return true;
  return rowUserId === requestedUserId;
}

export function continuousPersistTargets(redundant: boolean): {
  evidence: boolean;
  understanding: boolean;
  history: boolean;
} {
  if (redundant) return { evidence: false, understanding: false, history: false };
  return { evidence: true, understanding: true, history: true };
}

export type DrainDecision =
  | { action: 'skip-empty' }
  | { action: 'skip-idempotent' }
  | { action: 'skip-debounced'; nextNotBeforeMs: number }
  | { action: 'run'; processors: ProcessorName[] };

export function decideContinuousDrain(input: {
  userId: string;
  observationTypes: string[];
  latestObservationId: string | null;
  lastFingerprint: string | null;
  lastRunAt: string | null;
  forceRun: boolean;
  nowMs: number;
  meaningfulChange: boolean;
}): DrainDecision {
  if (input.observationTypes.length === 0) return { action: 'skip-empty' };

  const processors = processorsForObservationTypes(input.observationTypes);
  const fingerprint = runFingerprint(input.userId, processors, input.latestObservationId);
  if (fingerprint === input.lastFingerprint) return { action: 'skip-idempotent' };

  const minIntervalMs = debounceMsForTypes(input.observationTypes);
  const nowIso = new Date(input.nowMs).toISOString();
  const runnable = processors.filter(
    (processor) =>
      shouldRunProcessor({
        processor,
        mode: 'continuous',
        lastRunAt: input.lastRunAt,
        now: nowIso,
        meaningfulChange: input.forceRun || input.meaningfulChange,
        minIntervalMs,
      }).run
  );
  if (runnable.length === 0) {
    const lastRunMs = input.lastRunAt ? Date.parse(input.lastRunAt) : input.nowMs;
    return { action: 'skip-debounced', nextNotBeforeMs: lastRunMs + minIntervalMs };
  }
  return { action: 'run', processors: runnable };
}
