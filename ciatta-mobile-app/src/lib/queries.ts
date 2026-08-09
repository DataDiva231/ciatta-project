import { supabase } from './supabase';
import type { Discovery, Domain, Strength } from './types';

export interface UnderstandingRow {
  id: string;
  domain: Domain;
  strength: Strength;
  narrative: string;
  observations_count: number;
}

export async function fetchUnderstandings(userId: string): Promise<UnderstandingRow[]> {
  const { data, error } = await supabase
    .from('understandings')
    .select('id, domain, strength, narrative, observations_count')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as UnderstandingRow[];
}

export interface DiscoveryRow {
  id: string;
  name: string | null;
  narrative: string;
  detail: string | null;
  confidence: number | null;
  confidence_label: string | null;
  suggested_names: string[];
  status: 'pending' | 'named' | 'dismissed';
  discovered_at: string;
}

export async function fetchDiscoveries(userId: string): Promise<DiscoveryRow[]> {
  const { data, error } = await supabase
    .from('discoveries')
    .select(
      'id, name, narrative, detail, confidence, confidence_label, suggested_names, status, discovered_at'
    )
    .eq('user_id', userId)
    .order('discovered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DiscoveryRow[];
}

export async function nameDiscovery(
  userId: string,
  discoveryId: string,
  name: string
): Promise<void> {
  const { error } = await supabase
    .from('discoveries')
    .update({
      name,
      user_named: true,
      named_at: new Date().toISOString(),
      status: 'named',
    })
    .eq('id', discoveryId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Re-exported so callers that only need the Discovery UI shape (not the DB
// row) can share one import surface.
export type { Discovery };
