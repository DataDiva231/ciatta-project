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
// The Understanding Engine needs enough cycle history to compare multiple
// full menstrual cycles against each other, so resting heart rate and
// menstruation get a much longer one-time backfill than the day-to-day
// activity types above.
const CYCLE_HISTORY_DAYS = 365;

type HealthConnectRecordType =
  | 'Steps'
  | 'HeartRate'
  | 'SleepSession'
  | 'RestingHeartRate'
  | 'MenstruationFlow';

const READ_PERMISSIONS: { accessType: 'read'; recordType: HealthConnectRecordType }[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'MenstruationFlow' },
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
 * activity data plus up to a year of resting heart rate and menstruation
 * history into `observations`. Safe to call repeatedly (e.g. as a manual
 * "sync now" action) — inserts are deduped server-side, so re-reading the
 * same window is a no-op for anything already stored.
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

  const cycleHistoryStart = new Date(
    endTime.getTime() - CYCLE_HISTORY_DAYS * 24 * 60 * 60 * 1000
  );
  const cycleHistoryFilter = {
    operator: 'between' as const,
    startTime: cycleHistoryStart.toISOString(),
    endTime: endTime.toISOString(),
  };

  try {
    const { records } = await readRecords('RestingHeartRate', {
      timeRangeFilter: cycleHistoryFilter,
    });
    for (const record of records) {
      await insertObservation(userId, {
        source: 'health-connect',
        type: 'resting_heart_rate',
        value: { bpm: record.beatsPerMinute },
        unit: 'bpm',
        recordedAt: record.time,
      });
      count++;
    }
  } catch {
    // Ignored — see above.
  }

  try {
    const { records } = await readRecords('MenstruationFlow', {
      timeRangeFilter: cycleHistoryFilter,
    });
    for (const record of records) {
      await insertObservation(userId, {
        source: 'health-connect',
        type: 'menstrual_flow',
        value: { flow: menstruationFlowLabel(record.flow) },
        recordedAt: record.time,
      });
      count++;
    }
  } catch {
    // Ignored — see above.
  }

  return count;
}

function menstruationFlowLabel(flow: number | undefined): string {
  switch (flow) {
    case 1:
      return 'light';
    case 2:
      return 'medium';
    case 3:
      return 'heavy';
    default:
      return 'unspecified';
  }
}
