import { Platform } from 'react-native';
import {
  isHealthDataAvailableAsync,
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import { insertObservation } from './observations';

const SYNC_WINDOW_HOURS = 48;

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

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
  reason?: 'unavailable' | 'permission-denied';
}

/**
 * Requests read permissions and, if the request completes, pulls the last
 * two days of data into `observations`. HealthKit's privacy model never
 * confirms per-type grant/denial to the app — `requestAuthorization`
 * resolves `true` as long as the user didn't cancel the sheet, even if they
 * denied every type. A denial just means the later queries come back empty,
 * so `observationsSynced` staying at 0 is the only signal we ever get.
 */
export async function connectHealthKit(userId: string): Promise<HealthKitConnectResult> {
  const available = await isHealthKitAvailable();
  if (!available) {
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }

  let granted: boolean;
  try {
    granted = await requestAuthorization({ toRead: READ_TYPES });
  } catch {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  if (!granted) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  const observationsSynced = await syncHealthKitData(userId);
  return { granted: true, observationsSynced };
}

function sleepStageLabel(value: CategoryValueSleepAnalysis): string {
  switch (value) {
    case CategoryValueSleepAnalysis.inBed:
      return 'in_bed';
    case CategoryValueSleepAnalysis.awake:
      return 'awake';
    case CategoryValueSleepAnalysis.asleepCore:
      return 'asleep_core';
    case CategoryValueSleepAnalysis.asleepDeep:
      return 'asleep_deep';
    case CategoryValueSleepAnalysis.asleepREM:
      return 'asleep_rem';
    default:
      return 'asleep';
  }
}

export async function syncHealthKitData(userId: string): Promise<number> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - SYNC_WINDOW_HOURS * 60 * 60 * 1000);
  const dateFilter = { filter: { date: { startDate, endDate } }, limit: 0 };

  let count = 0;

  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      ...dateFilter,
      unit: 'count',
    });
    for (const sample of samples) {
      await insertObservation(userId, {
        source: 'apple-health',
        type: 'steps',
        value: { count: sample.quantity },
        unit: 'count',
        recordedAt: sample.endDate.toISOString(),
        context: { startTime: sample.startDate.toISOString() },
      });
      count++;
    }
  } catch {
    // Not granted for this type, or nothing recorded — skip.
  }

  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      ...dateFilter,
      unit: 'count/min',
    });
    for (const sample of samples) {
      await insertObservation(userId, {
        source: 'apple-health',
        type: 'heart_rate',
        value: { bpm: sample.quantity },
        unit: 'bpm',
        recordedAt: sample.endDate.toISOString(),
      });
      count++;
    }
  } catch {
    // Ignored — see above.
  }

  try {
    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', dateFilter);
    for (const sample of samples) {
      const durationMinutes = (sample.endDate.getTime() - sample.startDate.getTime()) / 60000;
      await insertObservation(userId, {
        source: 'apple-health',
        type: 'sleep_segment',
        value: { durationMinutes, stage: sleepStageLabel(sample.value) },
        unit: 'minutes',
        recordedAt: sample.endDate.toISOString(),
        context: { startTime: sample.startDate.toISOString() },
      });
      count++;
    }
  } catch {
    // Ignored — see above.
  }

  return count;
}
