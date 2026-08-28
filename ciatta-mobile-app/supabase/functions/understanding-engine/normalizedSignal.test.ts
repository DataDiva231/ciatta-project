import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  comparableKey,
  normalizeObservation,
  type RawObservation,
} from './normalizedSignal.ts';
import { selectEvidenceSeries } from './signalEvidence.ts';

function raw(partial: Partial<RawObservation> & Pick<RawObservation, 'id' | 'type' | 'value'>): RawObservation {
  return {
    source: 'apple-health',
    recorded_at: '2026-08-01T08:00:00.000Z',
    unit: 'ms',
    context: {},
    ...partial,
  };
}

Deno.test('normalizeObservation keeps provenance and measurement definition, not a device brand', () => {
  const signal = normalizeObservation(
    raw({
      id: 'obs-1',
      type: 'hrv',
      value: { ms: 45 },
      context: {
        uuid: 'hk-1',
        metric: 'sdnn',
        sourceName: 'Da Rings',
        sourceBundle: 'com.example.rings',
        measurement: {
          identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
          nativeUnit: 'ms',
          storedUnit: 'ms',
        },
        startTime: '2026-08-01T07:55:00.000Z',
      },
    })
  );
  assert(signal);
  assertEquals(signal.value, 45);
  assertEquals(signal.unit, 'ms');
  assertEquals(signal.measurement.metric, 'sdnn');
  assertEquals(signal.originName, 'Da Rings');
  assertEquals(signal.ingestSource, 'apple-health');
});

Deno.test('SDNN from two HealthKit apps is comparable; SDNN and RMSSD are not', () => {
  const watch = normalizeObservation(
    raw({
      id: 'a',
      type: 'hrv',
      value: { ms: 42 },
      context: {
        metric: 'sdnn',
        sourceName: 'Apple Watch',
        measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' },
      },
    })
  )!;
  const rings = normalizeObservation(
    raw({
      id: 'b',
      type: 'hrv',
      value: { ms: 45 },
      context: {
        metric: 'sdnn',
        sourceName: 'Da Rings',
        measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' },
      },
    })
  )!;
  const ouraDirect = normalizeObservation(
    raw({
      id: 'c',
      type: 'hrv',
      source: 'oura',
      value: { ms: 48 },
      context: {
        metric: 'rmssd',
        sourceName: 'Oura',
        measurement: { identifier: 'oura:hrv' },
      },
    })
  )!;

  assertEquals(comparableKey(watch), comparableKey(rings));
  assertEquals(comparableKey(watch) === comparableKey(ouraDirect), false);
});

Deno.test('evidence keeps every HRV observation and lets intelligence use one comparable series', () => {
  const rows: RawObservation[] = [
    raw({
      id: 'watch',
      type: 'hrv',
      value: { ms: 42 },
      context: { metric: 'sdnn', sourceName: 'Apple Watch', measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' } },
    }),
    raw({
      id: 'oura-hk',
      type: 'hrv',
      value: { ms: 48 },
      context: { metric: 'sdnn', sourceName: 'Oura', measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' } },
    }),
    raw({
      id: 'rings',
      type: 'hrv',
      value: { ms: 45 },
      context: { metric: 'sdnn', sourceName: 'Da Rings', measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' } },
    }),
    raw({
      id: 'connect',
      type: 'hrv',
      source: 'health-connect',
      value: { ms: 30 },
      context: { metric: 'rmssd', sourceName: 'Health Connect', measurement: { identifier: 'health-connect:HeartRateVariabilityRmssd' } },
    }),
  ];

  const evidence = selectEvidenceSeries(rows.map((row) => normalizeObservation(row)!), 'hrv');
  assertEquals(evidence.retainedIds.sort(), ['connect', 'oura-hk', 'rings', 'watch']);
  assertEquals(evidence.series.map((s) => s.observationId).sort(), ['oura-hk', 'rings', 'watch']);
  assertEquals(evidence.series.every((s) => s.measurement.metric === 'sdnn'), true);
  assertEquals(evidence.withheld.map((s) => s.observationId), ['connect']);
});

Deno.test('additive signals from two origins on the same day are not summed', () => {
  const phone = normalizeObservation(
    raw({
      id: 'phone-steps',
      type: 'steps',
      unit: 'count',
      value: { count: 4000 },
      context: { sourceName: 'iPhone', measurement: { identifier: 'HKQuantityTypeIdentifierStepCount' } },
    })
  )!;
  const watch = normalizeObservation(
    raw({
      id: 'watch-steps',
      type: 'steps',
      unit: 'count',
      value: { count: 4100 },
      recorded_at: '2026-08-01T08:01:00.000Z',
      context: { sourceName: 'Apple Watch', measurement: { identifier: 'HKQuantityTypeIdentifierStepCount' } },
    })
  )!;
  const evidence = selectEvidenceSeries([phone, watch], 'steps');
  assertEquals(evidence.retainedIds.sort(), ['phone-steps', 'watch-steps']);
  const dayTotal = evidence.series.reduce((sum, s) => sum + s.value, 0);
  assertEquals(dayTotal === 8100, false);
  assertEquals(evidence.series.length, 1);
  assertEquals(evidence.series[0].value, 4100);
});
