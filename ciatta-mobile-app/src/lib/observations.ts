import { supabase } from './supabase';

export type ObservationSource = 'apple-health' | 'health-connect' | 'arc' | 'manual' | 'curiosity';

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
