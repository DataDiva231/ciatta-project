import { assertEquals } from 'jsr:@std/assert@1';
import { featuredUnderstanding, selectMorningDomain } from './morningState.ts';

Deno.test('selectMorningDomain: prefers sleep when the nightly/morning run actually wrote it', () => {
  assertEquals(
    selectMorningDomain([
      { domain: 'recovery', wroteThisRun: true },
      { domain: 'sleep', wroteThisRun: true },
      { domain: 'mood', wroteThisRun: false },
    ]),
    'sleep'
  );
});

Deno.test('selectMorningDomain: if sleep did not write, uses the first domain this run did write', () => {
  assertEquals(
    selectMorningDomain([
      { domain: 'cycle', wroteThisRun: false },
      { domain: 'recovery', wroteThisRun: true },
      { domain: 'mood', wroteThisRun: true },
    ]),
    'recovery'
  );
});

Deno.test('selectMorningDomain: writes nothing extra when reconciliation produced no Understanding change', () => {
  assertEquals(
    selectMorningDomain([
      { domain: 'sleep', wroteThisRun: false },
      { domain: 'recovery', wroteThisRun: false },
    ]),
    null
  );
});

Deno.test('featuredUnderstanding: Today still surfaces the most recently updated Understanding', () => {
  const featured = featuredUnderstanding([
    { domain: 'cycle', lastUpdated: '2026-08-25T09:00:00.000Z' },
    { domain: 'sleep', lastUpdated: '2026-08-26T09:00:01.000Z' },
    { domain: 'mood', lastUpdated: '2026-08-26T09:00:00.000Z' },
  ]);
  assertEquals(featured, 'sleep');
});

Deno.test('featuredUnderstanding: bumping the morning domain is what propagates it to Today without a UI change', () => {
  const afterMorning = [
    { domain: 'recovery', lastUpdated: '2026-08-26T09:00:00.000Z' },
    { domain: 'sleep', lastUpdated: '2026-08-26T09:00:02.000Z' },
  ];
  assertEquals(featuredUnderstanding(afterMorning), 'sleep');
});
