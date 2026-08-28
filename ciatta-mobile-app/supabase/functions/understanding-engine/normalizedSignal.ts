export type SignalKind = 'state' | 'additive' | 'event';

export interface MeasurementDefinition {
  identifier?: string;
  metric?: string | null;
  nativeUnit?: string;
  storedUnit: string;
  samplingWindowMinutes: number | null;
}

export interface NormalizedSignal {
  observationId: string;
  ingestSource: string;
  originName?: string;
  originBundle?: string;
  signalType: string;
  kind: SignalKind;
  value: number;
  unit: string;
  recordedAt: string;
  startTime?: string;
  measurement: MeasurementDefinition;
  quality: {
    completeness: number;
    userEntered: boolean;
  };
}

export interface RawObservation {
  id: string;
  type: string;
  source?: string;
  recorded_at: string;
  unit?: string | null;
  value: unknown;
  context?: Record<string, unknown> | null;
}

const ADDITIVE_TYPES = new Set([
  'steps',
  'active_energy',
  'basal_energy',
  'distance_walking_running',
  'distance_cycling',
  'distance_swimming',
  'flights_climbed',
  'exercise_time',
  'stand_time',
  'move_time',
  'swimming_stroke_count',
]);

const EVENT_TYPES = new Set([
  'menstrual_flow',
  'intermenstrual_bleeding',
  'high_heart_rate_event',
  'low_heart_rate_event',
  'irregular_heart_rhythm_event',
  'workout',
]);

function kindFor(type: string): SignalKind {
  if (ADDITIVE_TYPES.has(type)) return 'additive';
  if (EVENT_TYPES.has(type)) return 'event';
  return 'state';
}

function numberFromValue(type: string, value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const keys = [
    'ms',
    'bpm',
    'count',
    'durationMinutes',
    'percent',
    'celsius',
    'kg',
    'meters',
    'kcal',
    'mmHg',
    'breathsPerMinute',
    'mlPerKgMin',
    'mgDl',
    'minutes',
    'index',
    'metersPerSecond',
    'watts',
    'liters',
    'litersPerMinute',
    'rating',
  ];
  if (type === 'hrv' && typeof v.ms === 'number') return v.ms;
  if ((type === 'heart_rate' || type === 'resting_heart_rate' || type === 'walking_heart_rate_average') && typeof v.bpm === 'number') {
    return v.bpm;
  }
  if (type === 'steps' && typeof v.count === 'number') return v.count;
  if ((type === 'sleep_session' || type === 'sleep_segment') && typeof v.durationMinutes === 'number') {
    return v.durationMinutes;
  }
  for (const key of keys) {
    if (typeof v[key] === 'number') return v[key] as number;
  }
  return null;
}

function samplingWindowMinutes(recordedAt: string, startTime?: string): number | null {
  if (!startTime) return null;
  const ms = Date.parse(recordedAt) - Date.parse(startTime);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

function samplingBucket(minutes: number | null): string {
  if (minutes == null) return 'unspecified';
  if (minutes <= 15) return 'spot';
  if (minutes <= 6 * 60) return 'session';
  return 'daylike';
}

export function comparableKey(signal: NormalizedSignal): string {
  if (signal.kind === 'additive') {
    return [signal.signalType, signal.unit].join('|');
  }
  return [
    signal.signalType,
    signal.measurement.metric ?? '',
    signal.unit,
    samplingBucket(signal.measurement.samplingWindowMinutes),
  ].join('|');
}

export function originKey(signal: NormalizedSignal): string {
  return signal.originBundle || signal.originName || signal.ingestSource;
}

export function normalizeObservation(row: RawObservation): NormalizedSignal | null {
  let value = numberFromValue(row.type, row.value);
  if (value == null) return null;

  const context = row.context ?? {};
  const measurement = (context.measurement as Record<string, unknown> | undefined) ?? {};
  let unit = (typeof row.unit === 'string' && row.unit) || (typeof measurement.storedUnit === 'string' && measurement.storedUnit) || '';

  if (row.type === 'oxygen_saturation' && value <= 1) {
    value = value * 100;
    unit = unit || '%';
  }

  const recordedAt = new Date(row.recorded_at).toISOString();
  const startTime = typeof context.startTime === 'string' ? new Date(context.startTime).toISOString() : undefined;
  const metricFromContext = typeof context.metric === 'string' ? context.metric : null;
  const identifier = typeof measurement.identifier === 'string' ? measurement.identifier : undefined;
  const userEntered = context.HKWasUserEntered === true || measurement.userEntered === true;

  const completeness = [
    identifier,
    metricFromContext || identifier,
    context.uuid || context.sourceSampleId,
    startTime,
  ].filter(Boolean).length / 4;

  return {
    observationId: row.id,
    ingestSource: row.source ?? 'unknown',
    originName: typeof context.sourceName === 'string' ? context.sourceName : undefined,
    originBundle: typeof context.sourceBundle === 'string' ? context.sourceBundle : undefined,
    signalType: row.type,
    kind: kindFor(row.type),
    value,
    unit: unit || (row.type === 'hrv' ? 'ms' : ''),
    recordedAt,
    startTime,
    measurement: {
      identifier,
      metric: metricFromContext,
      nativeUnit: typeof measurement.nativeUnit === 'string' ? measurement.nativeUnit : undefined,
      storedUnit: unit || (row.type === 'hrv' ? 'ms' : ''),
      samplingWindowMinutes: samplingWindowMinutes(recordedAt, startTime),
    },
    quality: {
      completeness,
      userEntered,
    },
  };
}
