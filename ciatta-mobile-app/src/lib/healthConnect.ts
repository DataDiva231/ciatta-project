import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { insertObservation } from './observations';

const SYNC_WINDOW_HOURS = 48;

const READ_PERMISSIONS: { accessType: 'read'; recordType: 'Steps' | 'HeartRate' | 'SleepSession' }[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
];

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export interface HealthConnectConnectResult {
  granted: boolean;
  observationsSynced: number;
  reason?: 'unavailable' | 'permission-denied';
}

/**
 * Requests read permissions and, if granted, pulls the last two days of
 * data into `observations`. Safe to call repeatedly (e.g. as a manual
 * "sync now" action) — it just re-reads the same recent window.
 */
export async function connectHealthConnect(
  userId: string
): Promise<HealthConnectConnectResult> {
  const available = await isHealthConnectAvailable();
  if (!available) {
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }

  await initialize();
  const granted = await requestPermission(READ_PERMISSIONS);

  if (granted.length === 0) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  const observationsSynced = await syncHealthConnectData(userId);
  return { granted: true, observationsSynced };
}

export async function syncHealthConnectData(userId: string): Promise<number> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - SYNC_WINDOW_HOURS * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  let count = 0;

  try {
    const { records } = await readRecords('Steps', { timeRangeFilter });
    for (const record of records) {
      await insertObservation(userId, {
        source: 'health-connect',
        type: 'steps',
        value: { count: record.count },
        unit: 'count',
        recordedAt: record.endTime,
        context: { startTime: record.startTime },
      });
      count++;
    }
  } catch {
    // Permission not granted for this type, or nothing recorded — skip.
  }

  try {
    const { records } = await readRecords('HeartRate', { timeRangeFilter });
    for (const record of records) {
      for (const sample of record.samples) {
        await insertObservation(userId, {
          source: 'health-connect',
          type: 'heart_rate',
          value: { bpm: sample.beatsPerMinute },
          unit: 'bpm',
          recordedAt: sample.time,
        });
        count++;
      }
    }
  } catch {
    // Ignored — see above.
  }

  try {
    const { records } = await readRecords('SleepSession', { timeRangeFilter });
    for (const record of records) {
      const durationMinutes =
        (new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 60000;
      await insertObservation(userId, {
        source: 'health-connect',
        type: 'sleep_session',
        value: { durationMinutes },
        unit: 'minutes',
        recordedAt: record.endTime,
        context: { startTime: record.startTime, stages: record.stages ?? [] },
      });
      count++;
    }
  } catch {
    // Ignored — see above.
  }

  return count;
}
