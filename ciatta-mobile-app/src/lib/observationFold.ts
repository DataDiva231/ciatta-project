import { displayCopy } from './displayCopy';
import type { DailyPoint, SeriesPack } from './insightViz';

export type ObservationRow = {
  type: string;
  value: unknown;
  recorded_at: string;
};

export const INSIGHT_LOOKBACK_DAYS = 7;

export const INSIGHT_OBSERVATION_TYPES = [
  'sleep_session',
  'sleep_segment',
  'hrv',
  'resting_heart_rate',
  'steps',
  'energy_rating',
  'mood_rating',
] as const;

export function numberFromObservation(type: string, value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (type === 'hrv' && typeof v.ms === 'number') return v.ms;
  if (type === 'resting_heart_rate' && typeof v.bpm === 'number') return v.bpm;
  if (type === 'steps' && typeof v.count === 'number') return v.count;
  if ((type === 'sleep_session' || type === 'sleep_segment') && typeof v.durationMinutes === 'number') {
    return v.durationMinutes;
  }
  if ((type === 'energy_rating' || type === 'mood_rating') && typeof v.rating === 'number') {
    return v.rating;
  }
  return null;
}

export function localDayKey(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return displayCopy(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
}

function lastDays(n: number, now: Date): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push(key);
  }
  return days;
}

function fold(
  rows: ObservationRow[],
  type: string,
  mode: 'sum' | 'avg',
  now: Date
): DailyPoint[] {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    if (row.type !== type) continue;
    const n = numberFromObservation(type, row.value);
    if (n == null) continue;
    const key = localDayKey(row.recorded_at, now);
    const list = buckets.get(key) ?? [];
    list.push(n);
    buckets.set(key, list);
  }
  const points: DailyPoint[] = [];
  for (const day of lastDays(INSIGHT_LOOKBACK_DAYS, now)) {
    const vals = buckets.get(day);
    if (!vals || vals.length === 0) continue;
    const value =
      mode === 'sum' ? vals.reduce((s, v) => s + v, 0) : vals.reduce((s, v) => s + v, 0) / vals.length;
    points.push({ day, value, label: dayLabel(day) });
  }
  return points;
}

export function seriesFromObservations(rows: ObservationRow[], now = new Date()): SeriesPack {
  const sleepSessions = fold(rows, 'sleep_session', 'sum', now);
  const sleepSegments = fold(rows, 'sleep_segment', 'sum', now);
  return {
    sleepMinutes: sleepSessions.length >= sleepSegments.length ? sleepSessions : sleepSegments,
    hrvMs: fold(rows, 'hrv', 'avg', now),
    rhrBpm: fold(rows, 'resting_heart_rate', 'avg', now),
    steps: fold(rows, 'steps', 'sum', now),
    energyRating: fold(rows, 'energy_rating', 'avg', now),
    moodRating: fold(rows, 'mood_rating', 'avg', now),
  };
}
