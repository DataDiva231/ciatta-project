import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  debounceMsForTypes,
  isMeaningfulChange,
  isRedundantUnderstandingWrite,
  mergePendingWork,
  planForMode,
  processorsForObservationTypes,
  runFingerprint,
  shouldRunProcessor,
  dueWork,
  decideContinuousDrain,
  retryNotBeforeMs,
  workBelongsToUser,
  continuousPersistTargets,
  CONTINUOUS_RETRY_MS,
} from './continuousIntelligence.ts';

Deno.test('processorsForObservationTypes: HR/HRV map to recovery only, never the full engine', () => {
  assertEquals(processorsForObservationTypes(['hrv']), ['recovery']);
  assertEquals(processorsForObservationTypes(['heart_rate']), ['recovery']);
});

Deno.test('processorsForObservationTypes: activity maps to recovery; cycle signals map to cycle', () => {
  assertEquals(processorsForObservationTypes(['steps']), ['recovery']);
  assertEquals(processorsForObservationTypes(['resting_heart_rate']), ['cycle']);
  assertEquals(processorsForObservationTypes(['menstrual_flow']), ['cycle']);
});

Deno.test('processorsForObservationTypes: new HealthKit vitals and workouts debounce to recovery or stay unprocessed', () => {
  assertEquals(processorsForObservationTypes(['workout']), ['recovery']);
  assertEquals(processorsForObservationTypes(['oxygen_saturation']), ['recovery']);
  assertEquals(processorsForObservationTypes(['basal_body_temperature']), []);
  assertEquals(processorsForObservationTypes(['ovulation_test_result']), ['cycle']);
});

Deno.test('processorsForObservationTypes: mood, onboarding context, and provider feedback are targeted', () => {
  assertEquals(processorsForObservationTypes(['mood_rating']), ['mood']);
  assertEquals(processorsForObservationTypes(['health_concern']), ['contextual']);
  assertEquals(processorsForObservationTypes(['health_concern_detail']), ['contextual']);
  assertEquals(processorsForObservationTypes(['provider_assessment']), ['provider_feedback']);
  assertEquals(processorsForObservationTypes(['provider_outcome']), ['provider_feedback']);
});

Deno.test('processorsForObservationTypes: energy check-ins only re-run relationship-capable processors, not sleep (sleep waits for morning)', () => {
  const processors = processorsForObservationTypes(['energy_rating']);
  assertEquals(processors.includes('sleep'), false);
  assert(processors.includes('cycle'));
  assert(processors.includes('recovery'));
});

Deno.test('processorsForObservationTypes: sleep observations do not enqueue daytime processors', () => {
  assertEquals(processorsForObservationTypes(['sleep_session']), []);
  assertEquals(processorsForObservationTypes(['sleep_segment']), []);
});

Deno.test('processorsForObservationTypes: temperature is cadence-tracked but has no processor yet', () => {
  assertEquals(processorsForObservationTypes(['body_temperature']), []);
  assertEquals(processorsForObservationTypes(['wrist_temperature']), []);
});

Deno.test('processorsForObservationTypes: a mixed batch is unioned and deduped, never expanded to decay/cross-domain', () => {
  const processors = processorsForObservationTypes(['hrv', 'mood_rating', 'hrv']);
  assertEquals(processors, ['recovery', 'mood']);
});

Deno.test('planForMode: nightly still runs every processor plus decay, cross-domain, and morning state', () => {
  const plan = planForMode('nightly');
  assertEquals(plan.processors.sort(), [
    'contextual',
    'cycle',
    'mood',
    'provider_feedback',
    'recovery',
    'sleep',
  ]);
  assertEquals(plan.runDecay, true);
  assertEquals(plan.runCrossDomain, true);
  assertEquals(plan.runMorningState, true);
});

Deno.test('planForMode: continuous never runs decay, cross-domain, or morning state', () => {
  const plan = planForMode('continuous', ['hrv', 'mood_rating']);
  assertEquals(plan.processors, ['recovery', 'mood']);
  assertEquals(plan.runDecay, false);
  assertEquals(plan.runCrossDomain, false);
  assertEquals(plan.runMorningState, false);
});

Deno.test('planForMode: morning is sleep plus morning-state, not a second full engine', () => {
  const plan = planForMode('morning');
  assertEquals(plan.processors, ['sleep']);
  assertEquals(plan.runDecay, false);
  assertEquals(plan.runCrossDomain, false);
  assertEquals(plan.runMorningState, true);
});

Deno.test('debounceMsForTypes: mood/context/provider are immediate; HR is minutes; activity/temperature/cycle are hourly', () => {
  assertEquals(debounceMsForTypes(['mood_rating']), 0);
  assertEquals(debounceMsForTypes(['health_concern']), 0);
  assertEquals(debounceMsForTypes(['provider_assessment']), 0);
  assertEquals(debounceMsForTypes(['hrv']), 2 * 60 * 1000);
  assertEquals(debounceMsForTypes(['heart_rate']), 2 * 60 * 1000);
  assertEquals(debounceMsForTypes(['steps']), 60 * 60 * 1000);
  assertEquals(debounceMsForTypes(['body_temperature']), 60 * 60 * 1000);
  assertEquals(debounceMsForTypes(['menstrual_flow']), 60 * 60 * 1000);
});

Deno.test('debounceMsForTypes: a mixed batch uses the most urgent cadence (immediate wins)', () => {
  assertEquals(debounceMsForTypes(['steps', 'mood_rating']), 0);
  assertEquals(debounceMsForTypes(['steps', 'hrv']), 2 * 60 * 1000);
});

Deno.test('shouldRunProcessor: nightly always runs; continuous skips sleep; morning only runs sleep', () => {
  const now = '2026-08-26T12:00:00.000Z';
  assertEquals(
    shouldRunProcessor({ processor: 'recovery', mode: 'nightly', lastRunAt: now, now, meaningfulChange: false }).run,
    true
  );
  assertEquals(
    shouldRunProcessor({ processor: 'sleep', mode: 'continuous', lastRunAt: null, now, meaningfulChange: true }).run,
    false
  );
  assertEquals(
    shouldRunProcessor({ processor: 'sleep', mode: 'morning', lastRunAt: null, now, meaningfulChange: false }).run,
    true
  );
  assertEquals(
    shouldRunProcessor({ processor: 'recovery', mode: 'morning', lastRunAt: null, now, meaningfulChange: true }).run,
    false
  );
});

Deno.test('shouldRunProcessor: continuous respects debounce unless a meaningful change arrives', () => {
  const now = Date.parse('2026-08-26T12:00:00.000Z');
  const recent = new Date(now - 30 * 1000).toISOString();
  const iso = new Date(now).toISOString();
  const blocked = shouldRunProcessor({
    processor: 'recovery',
    mode: 'continuous',
    lastRunAt: recent,
    now: iso,
    meaningfulChange: false,
    minIntervalMs: 2 * 60 * 1000,
  });
  assertEquals(blocked.run, false);
  const forced = shouldRunProcessor({
    processor: 'recovery',
    mode: 'continuous',
    lastRunAt: recent,
    now: iso,
    meaningfulChange: true,
    minIntervalMs: 2 * 60 * 1000,
  });
  assertEquals(forced.run, true);
});

Deno.test('isMeaningfulChange: HR/HRV do not use a pairwise sample delta — that lives in hrvAnalysis as the personal baseline', () => {
  assertEquals(isMeaningfulChange({ type: 'hrv', previousValue: 50, nextValue: 40 }), false);
  assertEquals(isMeaningfulChange({ type: 'heart_rate', previousValue: 70, nextValue: 95 }), false);
  assertEquals(isMeaningfulChange({ type: 'resting_heart_rate', previousValue: 62, nextValue: 63 }), false);
  assertEquals(isMeaningfulChange({ type: 'resting_heart_rate', previousValue: 60, nextValue: 80 }), true);
});

Deno.test('isMeaningfulChange: a cycle-start flag is always meaningful; user-logged types are always meaningful', () => {
  assertEquals(isMeaningfulChange({ type: 'menstrual_flow', cycleStart: true }), true);
  assertEquals(isMeaningfulChange({ type: 'mood_rating' }), true);
  assertEquals(isMeaningfulChange({ type: 'provider_outcome' }), true);
});

Deno.test('mergePendingWork: batches types/processors and keeps the soonest not_before (dedupe + debounce)', () => {
  const merged = mergePendingWork(
    {
      processors: ['recovery'],
      observationTypes: ['hrv'],
      latestObservationId: 'a',
      notBeforeMs: Date.parse('2026-08-26T12:05:00.000Z'),
    },
    {
      processors: ['mood'],
      observationTypes: ['mood_rating', 'hrv'],
      latestObservationId: 'b',
      notBeforeMs: Date.parse('2026-08-26T12:00:00.000Z'),
    }
  );
  assertEquals(merged.processors, ['recovery', 'mood']);
  assertEquals(merged.observationTypes, ['hrv', 'mood_rating']);
  assertEquals(merged.latestObservationId, 'b');
  assertEquals(merged.notBeforeMs, Date.parse('2026-08-26T12:00:00.000Z'));
});

Deno.test('runFingerprint: identical work is idempotent; a new observation is a new run', () => {
  const a = runFingerprint('user-1', ['recovery', 'mood'], 'obs-1');
  const b = runFingerprint('user-1', ['mood', 'recovery'], 'obs-1');
  const c = runFingerprint('user-1', ['recovery', 'mood'], 'obs-2');
  assertEquals(a, b);
  assertEquals(a === c, false);
});

Deno.test('dueWork: the queue only drains once not_before has arrived', () => {
  assertEquals(dueWork(100, 99), false);
  assertEquals(dueWork(100, 100), true);
  assertEquals(dueWork(100, 150), true);
});

Deno.test('isRedundantUnderstandingWrite: same living Understanding is not rewritten (evidence/history stay put)', () => {
  const existing = {
    strength: 'moderate' as const,
    narrative: 'A pattern in recovery.',
    confidenceLabel: 'fairly confident',
    observationsCount: 20,
    stillLearning: ['nights'],
  };
  assertEquals(isRedundantUnderstandingWrite(existing, { ...existing }), true);
  assertEquals(
    isRedundantUnderstandingWrite(existing, { ...existing, observationsCount: 21 }),
    false
  );
  assertEquals(
    isRedundantUnderstandingWrite(existing, { ...existing, strength: 'strong' }),
    false
  );
});

Deno.test('continuousPersistTargets: a redundant Understanding writes nothing — not evidence, not the row, not history', () => {
  assertEquals(continuousPersistTargets(true), {
    evidence: false,
    understanding: false,
    history: false,
  });
  assertEquals(continuousPersistTargets(false), {
    evidence: true,
    understanding: true,
    history: true,
  });
});

Deno.test('decideContinuousDrain: empty types are not processed', () => {
  assertEquals(
    decideContinuousDrain({
      userId: 'user-a',
      observationTypes: [],
      latestObservationId: null,
      lastFingerprint: null,
      lastRunAt: null,
      forceRun: false,
      nowMs: Date.parse('2026-08-26T12:00:00.000Z'),
      meaningfulChange: false,
    }).action,
    'skip-empty'
  );
});

Deno.test('decideContinuousDrain: the same fingerprint is idempotent and does not re-run', () => {
  const fp = runFingerprint('user-a', ['recovery'], 'obs-1');
  assertEquals(
    decideContinuousDrain({
      userId: 'user-a',
      observationTypes: ['hrv'],
      latestObservationId: 'obs-1',
      lastFingerprint: fp,
      lastRunAt: '2026-08-26T11:00:00.000Z',
      forceRun: true,
      nowMs: Date.parse('2026-08-26T12:00:00.000Z'),
      meaningfulChange: true,
    }).action,
    'skip-idempotent'
  );
});

Deno.test('decideContinuousDrain: batches stay on the recovery processor; debounce reschedules instead of spinning', () => {
  const nowMs = Date.parse('2026-08-26T12:00:00.000Z');
  const lastRunAt = new Date(nowMs - 30 * 1000).toISOString();
  const decision = decideContinuousDrain({
    userId: 'user-a',
    observationTypes: ['hrv', 'hrv'],
    latestObservationId: 'obs-9',
    lastFingerprint: null,
    lastRunAt,
    forceRun: false,
    nowMs,
    meaningfulChange: false,
  });
  assertEquals(decision.action, 'skip-debounced');
  if (decision.action === 'skip-debounced') {
    assertEquals(decision.nextNotBeforeMs, Date.parse(lastRunAt) + 2 * 60 * 1000);
  }
});

Deno.test('decideContinuousDrain: a baseline-qualified HRV swing (or force_run) bypasses debounce and runs recovery only', () => {
  const nowMs = Date.parse('2026-08-26T12:00:00.000Z');
  const decision = decideContinuousDrain({
    userId: 'user-a',
    observationTypes: ['hrv'],
    latestObservationId: 'obs-9',
    lastFingerprint: null,
    lastRunAt: new Date(nowMs - 30 * 1000).toISOString(),
    forceRun: false,
    nowMs,
    meaningfulChange: true,
  });
  assertEquals(decision, { action: 'run', processors: ['recovery'] });
});

Deno.test('retryNotBeforeMs: a failed drain is deferred 5 minutes, not dropped', () => {
  const failedAt = Date.parse('2026-08-26T12:00:00.000Z');
  assertEquals(retryNotBeforeMs(failedAt), failedAt + CONTINUOUS_RETRY_MS);
  assertEquals(CONTINUOUS_RETRY_MS, 5 * 60 * 1000);
});

Deno.test('workBelongsToUser: a targeted drain never includes another user\'s row', () => {
  assertEquals(workBelongsToUser('user-a', 'user-a'), true);
  assertEquals(workBelongsToUser('user-a', 'user-b'), false);
  assertEquals(workBelongsToUser('user-a', undefined), true);
});

Deno.test('runFingerprint: two users with the same observation id never collide', () => {
  const a = runFingerprint('user-a', ['recovery'], 'obs-1');
  const b = runFingerprint('user-b', ['recovery'], 'obs-1');
  assertEquals(a === b, false);
});
