import { supabase } from './supabase';
import {
  INSIGHT_LOOKBACK_DAYS,
  INSIGHT_OBSERVATION_TYPES,
  seriesFromObservations,
  type ObservationRow,
} from './observationFold';
import type { SeriesPack } from './insightViz';

export async function fetchInsightSeries(userId: string, now = new Date()): Promise<SeriesPack> {
  const since = new Date(now);
  since.setDate(now.getDate() - INSIGHT_LOOKBACK_DAYS);
  const { data, error } = await supabase
    .from('observations')
    .select('type, value, recorded_at')
    .eq('user_id', userId)
    .in('type', [...INSIGHT_OBSERVATION_TYPES])
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return seriesFromObservations((data ?? []) as ObservationRow[], now);
}
