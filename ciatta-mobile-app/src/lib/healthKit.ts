import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isHealthDataAvailableAsync,
  requestAuthorization,
  queryQuantitySamplesWithAnchor,
  queryCategorySamplesWithAnchor,
  queryWorkoutSamplesWithAnchor,
  WorkoutTypeIdentifier,
  areObjectTypesAvailableAsync,
} from '@kingstinct/react-native-healthkit';
import type {
  CategoryTypeIdentifier,
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { insertObservations } from './observations';
import { CATEGORY_SPECS, QUANTITY_SPECS } from './healthKitMap';
import { runHealthKitSync, type HealthKitAnchorStore, type HealthKitSyncProgress } from './healthKitSync';
import type { HealthKitSyncTelemetry } from './healthKitTelemetry';
import { QUERY_CONCURRENCY } from './healthKitObservations';

export const HEALTHKIT_READ_TYPES: ObjectTypeIdentifier[] = [
  ...QUANTITY_SPECS.map((spec) => spec.identifier as QuantityTypeIdentifier),
  ...CATEGORY_SPECS.map((spec) => spec.identifier as CategoryTypeIdentifier),
  WorkoutTypeIdentifier,
];

export async function isHealthKitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export interface HealthKitConnectResult {
  granted: boolean;
  observationsSynced: number;
  telemetry?: HealthKitSyncTelemetry;
  reason?: 'unavailable' | 'permission-denied';
}

async function readableHealthKitTypes(): Promise<ObjectTypeIdentifier[]> {
  try {
    const available = await areObjectTypesAvailableAsync([...HEALTHKIT_READ_TYPES]);
    const readable = HEALTHKIT_READ_TYPES.filter((type) => available[type]);
    return readable.length > 0 ? readable : [...HEALTHKIT_READ_TYPES];
  } catch {
    return [...HEALTHKIT_READ_TYPES];
  }
}

async function requestHealthKitRead(): Promise<HealthKitConnectResult> {
  const available = await isHealthKitAvailable();
  if (!available) {
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }

  let granted: boolean;
  try {
    granted = await requestAuthorization({ toRead: await readableHealthKitTypes() });
  } catch {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  if (!granted) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  return { granted: true, observationsSynced: 0 };
}

export async function connectHealthKit(
  userId: string,
  onProgress?: (progress: HealthKitSyncProgress) => void
): Promise<HealthKitConnectResult> {
  const permission = await requestHealthKitRead();
  if (!permission.granted) {
    console.log('[healthkit] not granted', permission.reason);
    return permission;
  }
  const result = await syncHealthKitData(userId, onProgress);
  console.log('[healthkit] sync complete', {
    observationsSynced: result.observationsSynced,
    telemetry: result.telemetry,
  });
  return { granted: true, ...result };
}

export async function requestHealthKitPermission(): Promise<HealthKitConnectResult> {
  return requestHealthKitRead();
}

function anchorsForUser(userId: string): HealthKitAnchorStore {
  const key = (identifier: string) => `hk-query-anchor:${userId}:${identifier}`;
  return {
    async get(identifier) {
      try {
        return await AsyncStorage.getItem(key(identifier));
      } catch {
        return null;
      }
    },
    async set(identifier, anchor) {
      await AsyncStorage.setItem(key(identifier), anchor);
    },
  };
}

export async function syncHealthKitData(
  userId: string,
  onProgress?: (progress: HealthKitSyncProgress) => void
) {
  return runHealthKitSync(userId, {
    anchors: anchorsForUser(userId),
    queryConcurrency: QUERY_CONCURRENCY,
    onProgress,
    port: {
      quantitySpecs: QUANTITY_SPECS,
      categorySpecs: CATEGORY_SPECS,
      queryQuantity: async (identifier, opts) => {
        const result = await queryQuantitySamplesWithAnchor(
          identifier as QuantityTypeIdentifier,
          {
            limit: opts.limit,
            unit: opts.unit,
            ...(opts.anchor ? { anchor: opts.anchor } : {}),
            ...(opts.filter ? { filter: opts.filter } : {}),
          }
        );
        return {
          samples: result.samples as never,
          deletedSamples: result.deletedSamples,
          newAnchor: result.newAnchor,
        };
      },
      queryCategory: async (identifier, opts) => {
        const result = await queryCategorySamplesWithAnchor(
          identifier as CategoryTypeIdentifier,
          {
            limit: opts.limit,
            ...(opts.anchor ? { anchor: opts.anchor } : {}),
            ...(opts.filter ? { filter: opts.filter } : {}),
          }
        );
        return {
          samples: result.samples as never,
          deletedSamples: result.deletedSamples,
          newAnchor: result.newAnchor,
        };
      },
      queryWorkouts: async (opts) => {
        const result = await queryWorkoutSamplesWithAnchor({
          limit: opts.limit,
          ...(opts.anchor ? { anchor: opts.anchor } : {}),
          ...(opts.filter ? { filter: opts.filter } : {}),
        });
        return {
          workouts: result.workouts as never,
          deletedSamples: result.deletedSamples,
          newAnchor: result.newAnchor,
        };
      },
      write: (rows) => insertObservations(userId, rows),
    },
  });
}
