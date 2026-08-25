import { supabase } from './supabase';

// 'provider' — a patient-mediated report of what a provider said or
// determined (see UnderstandingSheet's "Log what your provider said"),
// distinct from 'manual' (the user's own unprompted note) even though
// both are typed in by the user: who the information originated FROM is
// what this field tracks, and provider assessments are their own source
// of evidence for future intelligence work, not folded into the user's own
// observations.
export type ObservationSource =
  | 'apple-health'
  | 'health-connect'
  | 'arc'
  | 'manual'
  | 'curiosity'
  | 'provider';

export interface NewObservation {
  source: ObservationSource;
  type: string;
  value: unknown;
  unit?: string | null;
  recordedAt?: string;
  context?: Record<string, unknown>;
}

export async function insertObservation(userId: string, observation: NewObservation) {
  const { error } = await supabase.from('observations').upsert(
    {
      user_id: userId,
      source: observation.source,
      type: observation.type,
      value: observation.value,
      unit: observation.unit ?? null,
      recorded_at: observation.recordedAt ?? new Date().toISOString(),
      context: observation.context ?? {},
    },
    { onConflict: 'user_id,source,type,recorded_at', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export interface SyncReflection {
  sleepMinutes: number | null;
  steps: number | null;
  restingHeartRateBpm: number | null;
}

export function formatSleepMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Reads back what a sync just wrote, in plain terms — a same-second "here's
 * what I just learned" reflection, distinct from the Understanding Engine's
 * nightly pattern analysis. No pattern claims here, just the raw numbers, so
 * it's safe to show immediately without waiting for enough history to be
 * meaningful.
 */
export async function fetchSyncReflection(userId: string): Promise<SyncReflection> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [sleepSessions, sleepSegments, stepsRows, restingHr] = await Promise.all([
    supabase
      .from('observations')
      .select('value')
      .eq('user_id', userId)
      .eq('type', 'sleep_session')
      .order('recorded_at', { ascending: false })
      .limit(1),
    supabase
      .from('observations')
      .select('value')
      .eq('user_id', userId)
      .eq('type', 'sleep_segment')
      .gte('recorded_at', since),
    supabase
      .from('observations')
      .select('value')
      .eq('user_id', userId)
      .eq('type', 'steps')
      .gte('recorded_at', since),
    supabase
      .from('observations')
      .select('value')
      .eq('user_id', userId)
      .eq('type', 'resting_heart_rate')
      .order('recorded_at', { ascending: false })
      .limit(1),
  ]);

  let sleepMinutes: number | null = null;
  const latestSession = sleepSessions.data?.[0]?.value as { durationMinutes?: number } | undefined;
  if (latestSession?.durationMinutes) {
    sleepMinutes = latestSession.durationMinutes;
  } else if (sleepSegments.data && sleepSegments.data.length > 0) {
    sleepMinutes = sleepSegments.data.reduce((sum, row) => {
      const v = row.value as { durationMinutes?: number };
      return sum + (v.durationMinutes ?? 0);
    }, 0);
  }

  let steps: number | null = null;
  if (stepsRows.data && stepsRows.data.length > 0) {
    steps = stepsRows.data.reduce((sum, row) => {
      const v = row.value as { count?: number };
      return sum + (v.count ?? 0);
    }, 0);
  }

  const restingHeartRateBpm =
    (restingHr.data?.[0]?.value as { bpm?: number } | undefined)?.bpm ?? null;

  return { sleepMinutes, steps, restingHeartRateBpm };
}

const RECENT_SYNC_WINDOW_HOURS = 24;

export interface RecentSyncSummary {
  syncedAt: string;
  reflection: SyncReflection;
}

/**
 * The most recent time any health-source observation was written, with no
 * time window applied — used to decide whether an auto-sync is due, as
 * opposed to `fetchRecentSyncSummary` below which is scoped to "recent
 * enough to show on screen."
 */
export async function fetchLastHealthSyncAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('observations')
    .select('created_at')
    .eq('user_id', userId)
    .in('source', ['health-connect', 'apple-health'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.created_at as string | undefined) ?? null;
}

/**
 * For a quiet "synced recently" note on the Today screen — only returns
 * something if a health-source observation actually landed within the last
 * day, so this never shows a stale "synced 3 days ago" once the moment has
 * passed. Reuses the same reflection numbers as the sync sheet so the two
 * surfaces never disagree.
 */
export async function fetchRecentSyncSummary(userId: string): Promise<RecentSyncSummary | null> {
  const syncedAt = await fetchLastHealthSyncAt(userId);
  if (!syncedAt) return null;
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  if (ageMs > RECENT_SYNC_WINDOW_HOURS * 60 * 60 * 1000) return null;

  const reflection = await fetchSyncReflection(userId);
  return { syncedAt, reflection };
}
