import { assertEquals } from 'jsr:@std/assert@1';
import {
  isMissingOnConflictConstraint,
  isMissingSourceSampleIdColumn,
  observationIdentity,
} from './observationIdentity.ts';

Deno.test('HealthKit UUID is the observation identity, not timestamp', () => {
  const a = observationIdentity({
    source: 'apple-health',
    type: 'hrv',
    recordedAt: '2026-08-01T08:00:00.000Z',
    sourceSampleId: 'uuid-watch',
  });
  const b = observationIdentity({
    source: 'apple-health',
    type: 'hrv',
    recordedAt: '2026-08-01T08:00:00.000Z',
    sourceSampleId: 'uuid-ring',
  });
  assertEquals(a.sourceSampleId === b.sourceSampleId, false);
  assertEquals(a.sourceSampleId, 'uuid-watch');
  assertEquals(b.sourceSampleId, 'uuid-ring');
});

Deno.test('the same HealthKit UUID is stable across re-syncs', () => {
  const first = observationIdentity({
    source: 'apple-health',
    type: 'heart_rate',
    recordedAt: '2026-08-01T08:00:00.000Z',
    sourceSampleId: 'same-uuid',
  });
  const again = observationIdentity({
    source: 'apple-health',
    type: 'heart_rate',
    recordedAt: '2026-08-01T09:00:00.000Z',
    sourceSampleId: 'same-uuid',
  });
  assertEquals(first.sourceSampleId, again.sourceSampleId);
});

Deno.test('ingest sources stay namespaced so a Health Connect id cannot collide with a HealthKit UUID', () => {
  const apple = observationIdentity({
    source: 'apple-health',
    type: 'hrv',
    recordedAt: '2026-08-01T08:00:00.000Z',
    sourceSampleId: 'abc',
  });
  const android = observationIdentity({
    source: 'health-connect',
    type: 'hrv',
    recordedAt: '2026-08-01T08:00:00.000Z',
    sourceSampleId: 'abc',
  });
  assertEquals(apple.source, 'apple-health');
  assertEquals(android.source, 'health-connect');
  assertEquals(apple.sourceSampleId, 'abc');
  assertEquals(android.sourceSampleId, 'abc');
});

Deno.test('observations without a native sample id fall back to type plus timestamp so existing inserts still dedupe', () => {
  const id = observationIdentity({
    source: 'manual',
    type: 'mood_rating',
    recordedAt: '2026-08-01T12:00:00.000Z',
  });
  assertEquals(id.sourceSampleId, 'legacy:mood_rating:2026-08-01T12:00:00.000Z');
});

Deno.test('detects a missing source_sample_id column so ingest can fall back', () => {
  assertEquals(
    isMissingSourceSampleIdColumn({
      code: '42703',
      message: 'column observations.source_sample_id does not exist',
    }),
    true
  );
  assertEquals(isMissingSourceSampleIdColumn({ code: '23505', message: 'duplicate' }), false);
});

Deno.test('detects a missing identity unique key so ingest can insert without upsert', () => {
  assertEquals(
    isMissingOnConflictConstraint({
      code: '42P10',
      message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
    }),
    true
  );
  assertEquals(isMissingOnConflictConstraint({ code: '23505', message: 'duplicate' }), false);
});
