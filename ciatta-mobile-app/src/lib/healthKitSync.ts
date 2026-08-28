import type { CategorySpec, QuantitySpec } from './healthKitMap';
import {
  QUERY_CONCURRENCY,
  categoryToObservation,
  quantityToObservation,
  workoutToObservation,
  type CategorySampleLike,
  type HealthKitNewObservation,
  type QuantitySampleLike,
  type WorkoutSampleLike,
} from './healthKitObservations';
import {
  elapsedMs,
  emptyHealthKitTelemetry,
  logHealthKitTelemetry,
  type HealthKitSyncTelemetry,
} from './healthKitTelemetry';

export { chunk, WRITE_BATCH_SIZE, QUERY_CONCURRENCY } from './healthKitObservations';
export { emptyHealthKitTelemetry } from './healthKitTelemetry';
export type { HealthKitSyncTelemetry };

const SYNC_WINDOW_HOURS = 24 * 30;
const CYCLE_HISTORY_DAYS = 365;

export type HealthKitAnchorStore = {
  get: (identifier: string) => Promise<string | null>;
  set: (identifier: string, anchor: string) => Promise<void>;
};

export type AnchoredQueryOptions = {
  anchor?: string;
  filter?: { date?: { startDate: Date; endDate: Date } };
  limit: number;
  unit?: string;
};

export type HealthKitSyncPort = {
  quantitySpecs: readonly QuantitySpec[];
  categorySpecs: readonly CategorySpec[];
  queryQuantity: (
    identifier: string,
    opts: AnchoredQueryOptions
  ) => Promise<{
    samples: readonly QuantitySampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  queryCategory: (
    identifier: string,
    opts: AnchoredQueryOptions
  ) => Promise<{
    samples: readonly CategorySampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  queryWorkouts: (opts: AnchoredQueryOptions) => Promise<{
    workouts: readonly WorkoutSampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  write: (rows: HealthKitNewObservation[]) => Promise<void>;
};

export type HealthKitSyncProgress = {
  phase: 'query' | 'normalize' | 'write';
  samplesFetched: number;
  samplesWritten: number;
  typesDone: number;
  typesTotal: number;
};

export type HealthKitSyncResult = {
  observationsSynced: number;
  telemetry: HealthKitSyncTelemetry;
};

function dateFilterFor(window: 'recent' | 'cycle', endDate: Date) {
  const startDate =
    window === 'cycle'
      ? new Date(endDate.getTime() - CYCLE_HISTORY_DAYS * 24 * 60 * 60 * 1000)
      : new Date(endDate.getTime() - SYNC_WINDOW_HOURS * 60 * 60 * 1000);
  return { date: { startDate, endDate } };
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => worker())
  );
  return out;
}

export async function runHealthKitSync(
  _userId: string,
  deps: {
    port: HealthKitSyncPort;
    anchors: HealthKitAnchorStore;
    queryConcurrency?: number;
    onProgress?: (progress: HealthKitSyncProgress) => void;
  }
): Promise<HealthKitSyncResult> {
  const started = Date.now();
  const telemetry = emptyHealthKitTelemetry();
  const { port, anchors } = deps;
  const concurrency = deps.queryConcurrency ?? QUERY_CONCURRENCY;
  const typesTotal = port.quantitySpecs.length + port.categorySpecs.length + 1;
  const endDate = new Date();
  const pendingAnchors: { identifier: string; anchor: string }[] = [];
  const observations: HealthKitNewObservation[] = [];
  let typesDone = 0;
  let typesWithNewSamples = 0;
  let samplesDeleted = 0;
  const usedStoredAnchor: boolean[] = [];

  const report = (phase: HealthKitSyncProgress['phase'], samplesWritten = 0) => {
    deps.onProgress?.({
      phase,
      samplesFetched: telemetry.samplesFetched,
      samplesWritten,
      typesDone,
      typesTotal,
    });
  };

  const queryStarted = Date.now();

  const quantityResults = await mapPool(port.quantitySpecs, concurrency, async (spec) => {
    const stored = await anchors.get(spec.identifier);
    usedStoredAnchor.push(Boolean(stored));
    const opts: AnchoredQueryOptions = {
      limit: 0,
      unit: spec.unit,
      ...(stored
        ? { anchor: stored }
        : { filter: dateFilterFor(spec.window, endDate) }),
    };
    try {
      const result = await port.queryQuantity(spec.identifier, opts);
      return { spec, result, ok: true as const };
    } catch (e) {
      console.log('[healthkit] query failed', spec.type, e instanceof Error ? e.message : e);
      return { spec, result: null, ok: false as const };
    }
  });

  const categoryResults = await mapPool(port.categorySpecs, concurrency, async (spec) => {
    const stored = await anchors.get(spec.identifier);
    usedStoredAnchor.push(Boolean(stored));
    const opts: AnchoredQueryOptions = {
      limit: 0,
      ...(stored
        ? { anchor: stored }
        : { filter: dateFilterFor(spec.window, endDate) }),
    };
    try {
      const result = await port.queryCategory(spec.identifier, opts);
      return { spec, result, ok: true as const };
    } catch (e) {
      console.log('[healthkit] query failed', spec.type, e instanceof Error ? e.message : e);
      return { spec, result: null, ok: false as const };
    }
  });

  const workoutIdentifier = 'HKWorkoutTypeIdentifier';
  const workoutStored = await anchors.get(workoutIdentifier);
  usedStoredAnchor.push(Boolean(workoutStored));
  let workoutResult: {
    workouts: readonly WorkoutSampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  } | null = null;
  try {
    workoutResult = await port.queryWorkouts({
      limit: 0,
      ...(workoutStored
        ? { anchor: workoutStored }
        : { filter: dateFilterFor('recent', endDate) }),
    });
  } catch (e) {
    console.log('[healthkit] query failed', 'workout', e instanceof Error ? e.message : e);
  }

  telemetry.healthKitQueryMs = elapsedMs(queryStarted);
  telemetry.typesQueried = typesTotal;
  telemetry.incremental = usedStoredAnchor.length > 0 && usedStoredAnchor.every(Boolean);

  const normalizeStarted = Date.now();
  for (const row of quantityResults) {
    typesDone += 1;
    if (!row.ok || !row.result) {
      report('query');
      continue;
    }
    telemetry.samplesFetched += row.result.samples.length;
    samplesDeleted += row.result.deletedSamples.length;
    if (row.result.samples.length > 0) typesWithNewSamples += 1;
    for (const sample of row.result.samples) {
      observations.push(quantityToObservation(row.spec, sample));
    }
    pendingAnchors.push({ identifier: row.spec.identifier, anchor: row.result.newAnchor });
    report('query');
  }
  for (const row of categoryResults) {
    typesDone += 1;
    if (!row.ok || !row.result) {
      report('query');
      continue;
    }
    telemetry.samplesFetched += row.result.samples.length;
    samplesDeleted += row.result.deletedSamples.length;
    if (row.result.samples.length > 0) typesWithNewSamples += 1;
    for (const sample of row.result.samples) {
      observations.push(categoryToObservation(row.spec, sample));
    }
    pendingAnchors.push({ identifier: row.spec.identifier, anchor: row.result.newAnchor });
    report('query');
  }
  typesDone += 1;
  if (workoutResult) {
    telemetry.samplesFetched += workoutResult.workouts.length;
    samplesDeleted += workoutResult.deletedSamples.length;
    if (workoutResult.workouts.length > 0) typesWithNewSamples += 1;
    for (const workout of workoutResult.workouts) {
      observations.push(workoutToObservation(workout));
    }
    pendingAnchors.push({ identifier: workoutIdentifier, anchor: workoutResult.newAnchor });
  }
  report('normalize');
  telemetry.normalizationMs = elapsedMs(normalizeStarted);
  telemetry.samplesDeleted = samplesDeleted;
  telemetry.typesWithNewSamples = typesWithNewSamples;

  const writeStarted = Date.now();
  report('write', 0);
  if (observations.length > 0) {
    await port.write(observations);
  }
  telemetry.databaseWriteMs = elapsedMs(writeStarted);
  telemetry.intelligenceProcessingMs = 0;

  for (const pending of pendingAnchors) {
    await anchors.set(pending.identifier, pending.anchor);
  }

  telemetry.totalMs = elapsedMs(started);
  logHealthKitTelemetry(telemetry);

  return {
    observationsSynced: observations.length,
    telemetry,
  };
}
