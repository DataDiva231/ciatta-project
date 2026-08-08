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
  status: 'pending' | 'named' | 'dismissed';
  discovered_at: string;
}

export async function fetchDiscoveries(userId: string): Promise<DiscoveryRow[]> {
  const { data, error } = await supabase
    .from('discoveries')
    .select('id, name, narrative, status, discovered_at')
    .eq('user_id', userId)
    .order('discovered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DiscoveryRow[];
}

// Re-exported so callers that only need the Discovery UI shape (not the DB
// row) can share one import surface.
export type { Discovery };
