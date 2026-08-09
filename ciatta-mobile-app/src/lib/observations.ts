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
