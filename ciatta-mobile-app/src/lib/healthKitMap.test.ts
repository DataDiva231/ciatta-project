import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  CATEGORY_SPECS,
  HEALTHKIT_READ_IDENTIFIERS,
  ORIGINAL_HEALTHKIT_TYPES,
  QUANTITY_SPECS,
  menstrualFlowLabel,
  mergeObservationContext,
  provenanceFromSample,
  sleepStageLabel,
  storedQuantityUnit,
  workoutDurationMinutes,
} from './healthKitMap.ts';

Deno.test('keeps the original six Apple Health observation types', () => {
  const types = new Set(QUANTITY_SPECS.map((s) => s.type).concat(CATEGORY_SPECS.map((s) => s.type)));
  for (const type of ORIGINAL_HEALTHKIT_TYPES) {
    assert(types.has(type), `missing original type ${type}`);
  }
});

Deno.test('requests activity, heart, respiratory, sleep, vitals, body, cycle, mobility, and workouts', () => {
  const ids = new Set(HEALTHKIT_READ_IDENTIFIERS);
  for (const id of [
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierOxygenSaturation',
    'HKQuantityTypeIdentifierRespiratoryRate',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierWalkingSpeed',
    'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
    'HKCategoryTypeIdentifierSleepAnalysis',
    'HKCategoryTypeIdentifierMenstrualFlow',
    'HKCategoryTypeIdentifierOvulationTestResult',
    'HKWorkoutTypeIdentifier',
  ]) {
    assert(ids.has(id), `missing permission type ${id}`);
  }
});

Deno.test('does not special case any device name', () => {
  const blob = JSON.stringify({ QUANTITY_SPECS, CATEGORY_SPECS, HEALTHKIT_READ_IDENTIFIERS });
  assertEquals(/da\s*rings/i.test(blob), false);
});

Deno.test('quantity context includes a measurement definition plus source provenance', () => {
  const context = mergeObservationContext(
    {
      uuid: 'hk-uuid',
      sourceRevision: { source: { name: 'Oura', bundleIdentifier: 'com.ouraring.oura' } },
    },
    { measurement: { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', metric: 'sdnn' } }
  );
  assertEquals(context.uuid, 'hk-uuid');
  assertEquals((context.measurement as { metric: string }).metric, 'sdnn');
  assertEquals(context.sourceName, 'Oura');
});

Deno.test('preserves existing step, heart, sleep, and cycle mappings', () => {
  const steps = QUANTITY_SPECS.find((s) => s.type === 'steps')!;
  assertEquals(steps.valueKey, 'count');
  assertEquals(storedQuantityUnit(steps), 'count');

  const hr = QUANTITY_SPECS.find((s) => s.type === 'heart_rate')!;
  assertEquals(hr.valueKey, 'bpm');
  assertEquals(storedQuantityUnit(hr), 'bpm');

  const hrv = QUANTITY_SPECS.find((s) => s.type === 'hrv')!;
  assertEquals(hrv.valueKey, 'ms');
  assertEquals(hrv.window, 'cycle');

  assertEquals(sleepStageLabel(0), 'in_bed');
  assertEquals(sleepStageLabel(4), 'asleep_deep');
  assertEquals(menstrualFlowLabel(3), 'medium');
});

Deno.test('records source and device provenance without dropping the sample uuid', () => {
  const context = mergeObservationContext(
    {
      uuid: 'sample-1',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      sourceRevision: {
        version: '1.2',
        productType: 'Watch6,1',
        source: { name: 'Oura', bundleIdentifier: 'com.ouraring.oura' },
      },
      device: { name: 'Oura Ring', manufacturer: 'Oura Health', model: 'Gen3' },
    },
    { startTime: '2026-08-01T00:00:00.000Z' }
  );

  assertEquals(context.uuid, 'sample-1');
  assertEquals(context.sourceName, 'Oura');
  assertEquals(context.sourceBundle, 'com.ouraring.oura');
  assertEquals(context.deviceName, 'Oura Ring');
  assertEquals(context.startTime, '2026-08-01T00:00:00.000Z');
});

Deno.test('reads source names from HealthKit source proxies', () => {
  const provenance = provenanceFromSample({
    uuid: 'sample-2',
    sourceRevision: {
      source: {
        toJSON: () => ({ name: 'Apple Watch', bundleIdentifier: 'com.apple.health' }),
      },
    },
  });
  assertEquals(provenance.sourceName, 'Apple Watch');
  assertEquals(provenance.sourceBundle, 'com.apple.health');
});

Deno.test('workout duration converts seconds to minutes', () => {
  const start = new Date('2026-08-01T10:00:00.000Z');
  const end = new Date('2026-08-01T10:45:00.000Z');
  assertEquals(workoutDurationMinutes({ unit: 's', quantity: 1800 }, start, end), 30);
  assertEquals(workoutDurationMinutes(undefined, start, end), 45);
});
