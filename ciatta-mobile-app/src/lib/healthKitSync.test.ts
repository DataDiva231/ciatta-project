import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  chunk,
  emptyHealthKitTelemetry,
  runHealthKitSync,
  type HealthKitSyncPort,
  type HealthKitAnchorStore,
} from './healthKitSync.ts';
import type { QuantitySpec } from './healthKitMap.ts';

function memoryAnchors(initial: Record<string, string> = {}): HealthKitAnchorStore {
  const data = { ...initial };
  return {
    async get(identifier: string) {
      return data[identifier] ?? null;
    },
    async set(identifier: string, anchor: string) {
      data[identifier] = anchor;
    },
  };
}

const stepsSpec: QuantitySpec = {
  identifier: 'HKQuantityTypeIdentifierStepCount',
  type: 'steps',
  unit: 'count',
  valueKey: 'count',
  window: 'recent',
};

Deno.test('chunk splits writes so the first import is batched instead of one row per request', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('empty telemetry starts at zero so a sync report cannot omit a stage', () => {
  const t = emptyHealthKitTelemetry();
  assertEquals(t.healthKitQueryMs, 0);
  assertEquals(t.samplesFetched, 0);
  assertEquals(t.normalizationMs, 0);
  assertEquals(t.databaseWriteMs, 0);
  assertEquals(t.intelligenceProcessingMs, 0);
  assertEquals(t.totalMs, 0);
});

Deno.test('the second sync passes stored HKQueryAnchors and does not refetch historical samples', async () => {
  const anchors = memoryAnchors();
  const requested: { identifier: string; anchor?: string }[] = [];
  let round = 0;
  const written: number[] = [];

  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async (identifier, opts) => {
      requested.push({ identifier, anchor: opts.anchor });
      round += 1;
      if (round === 1) {
        return {
          samples: [
            {
              uuid: 'hk-1',
              quantity: 12,
              startDate: new Date('2026-08-28T12:00:00Z'),
              endDate: new Date('2026-08-28T12:05:00Z'),
            },
          ],
          deletedSamples: [],
          newAnchor: 'anchor-v1',
        };
      }
      assertEquals(opts.anchor, 'anchor-v1');
      return { samples: [], deletedSamples: [], newAnchor: 'anchor-v1' };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'cat' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'wo' }),
    write: async (rows) => {
      written.push(rows.length);
    },
  };

  const first = await runHealthKitSync('user-1', { port, anchors });
  const second = await runHealthKitSync('user-1', { port, anchors });

  assertEquals(first.telemetry.samplesFetched, 1);
  assertEquals(first.observationsSynced, 1);
  assertEquals(first.telemetry.incremental, false);
  assertEquals(written, [1]);

  assertEquals(second.telemetry.samplesFetched, 0);
  assertEquals(second.observationsSynced, 0);
  assertEquals(second.telemetry.incremental, true);
  assertEquals(requested[1]?.anchor, 'anchor-v1');
  assertEquals(written.length, 1);
});

Deno.test('first historical sync uses a date window when no anchor exists', async () => {
  let sawDateFilter = false;
  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async (_id, opts) => {
      sawDateFilter = Boolean(opts.filter?.date?.startDate && opts.filter?.date?.endDate);
      assertEquals(opts.anchor, undefined);
      return { samples: [], deletedSamples: [], newAnchor: 'a0' };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'c' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'w' }),
    write: async () => {},
  };
  await runHealthKitSync('user-1', { port, anchors: memoryAnchors() });
  assert(sawDateFilter);
});
