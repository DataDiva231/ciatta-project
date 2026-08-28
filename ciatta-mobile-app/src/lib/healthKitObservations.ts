export type HealthKitNewObservation = {
  source: 'apple-health';
  type: string;
  value: unknown;
  unit?: string | null;
  recordedAt?: string;
  sourceSampleId?: string | null;
  context?: Record<string, unknown>;
};

import {
  CATEGORY_SPECS,
  QUANTITY_SPECS,
  mergeObservationContext,
  storedQuantityUnit,
  workoutDurationMinutes,
  measurementContext,
  type CategorySpec,
  type QuantitySpec,
} from './healthKitMap';

export const WRITE_BATCH_SIZE = 250;
export const QUERY_CONCURRENCY = 8;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type QuantitySampleLike = {
  uuid: string;
  quantity: number;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, unknown>;
  device?: SampleProvenanceDevice;
  sourceRevision?: SampleProvenanceSource;
};

type SampleProvenanceDevice = {
  name?: string;
  manufacturer?: string;
  model?: string;
  hardwareVersion?: string;
  softwareVersion?: string;
};

type SampleProvenanceSource = {
  version?: string;
  productType?: string;
  source?: {
    name?: string;
    bundleIdentifier?: string;
    toJSON?: (key?: string) => { name?: string; bundleIdentifier?: string };
  };
};

export type CategorySampleLike = {
  uuid: string;
  value: number;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, unknown>;
  device?: SampleProvenanceDevice;
  sourceRevision?: SampleProvenanceSource;
};

export type WorkoutSampleLike = {
  uuid: string;
  startDate: Date;
  endDate: Date;
  duration?: { unit?: string; quantity?: number };
  workoutActivityType?: unknown;
  totalEnergyBurned?: { quantity?: number | null };
  totalDistance?: { quantity?: number | null };
  metadata?: Record<string, unknown>;
  device?: SampleProvenanceDevice;
  sourceRevision?: SampleProvenanceSource;
};

export function quantityToObservation(spec: QuantitySpec, sample: QuantitySampleLike): HealthKitNewObservation {
  const extra: Record<string, unknown> = {
    startTime: sample.startDate.toISOString(),
  };
  if (spec.type === 'hrv') extra.metric = 'sdnn';
  extra.measurement = measurementContext(spec.identifier, {
    nativeUnit: spec.unit,
    storedUnit: storedQuantityUnit(spec),
    ...(spec.type === 'hrv' ? { metric: 'sdnn' } : {}),
  });
  return {
    source: 'apple-health',
    type: spec.type,
    value: { [spec.valueKey]: sample.quantity },
    unit: storedQuantityUnit(spec),
    recordedAt: sample.endDate.toISOString(),
    sourceSampleId: sample.uuid,
    context: mergeObservationContext(sample, extra),
  };
}

export function categoryToObservation(spec: CategorySpec, sample: CategorySampleLike): HealthKitNewObservation {
  const extra: Record<string, unknown> = {
    startTime: sample.startDate.toISOString(),
  };
  let value = spec.mapValue(sample.value as number);
  if (spec.type === 'sleep_segment') {
    const durationMinutes =
      (sample.endDate.getTime() - sample.startDate.getTime()) / 60000;
    value = { ...value, durationMinutes };
  }
  if (spec.type === 'menstrual_flow') {
    extra.cycleStart = sample.metadata?.HKMenstrualCycleStart ?? null;
  }
  extra.measurement = measurementContext(spec.identifier);
  return {
    source: 'apple-health',
    type: spec.type,
    value,
    unit: spec.type === 'sleep_segment' ? 'minutes' : undefined,
    recordedAt:
      spec.type === 'menstrual_flow'
        ? sample.startDate.toISOString()
        : sample.endDate.toISOString(),
    sourceSampleId: sample.uuid,
    context: mergeObservationContext(sample, extra),
  };
}

export function workoutToObservation(workout: WorkoutSampleLike): HealthKitNewObservation {
  const durationMinutes = workoutDurationMinutes(
    workout.duration,
    workout.startDate,
    workout.endDate
  );
  return {
    source: 'apple-health',
    type: 'workout',
    value: {
      activityType: workout.workoutActivityType,
      durationMinutes,
      energyKcal: workout.totalEnergyBurned?.quantity ?? null,
      distanceMeters: workout.totalDistance?.quantity ?? null,
    },
    unit: 'minutes',
    recordedAt: workout.endDate.toISOString(),
    sourceSampleId: workout.uuid,
    context: mergeObservationContext(workout, {
      startTime: workout.startDate.toISOString(),
      measurement: measurementContext('HKWorkoutTypeIdentifier'),
    }),
  };
}

export const DEFAULT_QUANTITY_SPECS = QUANTITY_SPECS;
export const DEFAULT_CATEGORY_SPECS = CATEGORY_SPECS;
