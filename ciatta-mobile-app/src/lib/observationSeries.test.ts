import { assertEquals } from 'jsr:@std/assert@1';
import { numberFromObservation, seriesFromObservations } from './observationFold.ts';

Deno.test('numberFromObservation reads known health shapes', () => {
  assertEquals(numberFromObservation('hrv', { ms: 42 }), 42);
  assertEquals(numberFromObservation('resting_heart_rate', { bpm: 61 }), 61);
  assertEquals(numberFromObservation('steps', { count: 800 }), 800);
  assertEquals(numberFromObservation('sleep_session', { durationMinutes: 400 }), 400);
  assertEquals(numberFromObservation('energy_rating', { rating: 3 }), 3);
  assertEquals(numberFromObservation('hrv', { bpm: 61 }), null);
});

Deno.test('seriesFromObservations buckets a week of HRV', () => {
  const pack = seriesFromObservations(
    [
      { type: 'hrv', value: { ms: 50 }, recorded_at: '2026-08-21T12:00:00.000Z' },
      { type: 'hrv', value: { ms: 40 }, recorded_at: '2026-08-21T18:00:00.000Z' },
      { type: 'hrv', value: { ms: 30 }, recorded_at: '2026-08-22T12:00:00.000Z' },
    ],
    new Date('2026-08-27T12:00:00.000Z')
  );
  assertEquals(pack.hrvMs.length >= 1, true);
  const first = pack.hrvMs.find((p) => p.value === 45 || p.day.endsWith('21'));
  assertEquals(first != null, true);
});
