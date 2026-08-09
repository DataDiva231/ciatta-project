import { supabase } from './supabase';
import type { Discovery, Domain, Strength } from './types';

export interface UnderstandingRow {
  id: string;
  domain: Domain;
  strength: Strength;
  narrative: string;
  observations_count: number;
  confidence_label: string | null;
  learning_since: string | null;
  first_observed: string | null;
  last_updated: string;
  still_learning: string[];
}

export async function fetchUnderstandings(userId: string): Promise<UnderstandingRow[]> {
  const { data, error } = await supabase
    .from('understandings')
    .select(
      'id, domain, strength, narrative, observations_count, confidence_label, learning_since, first_observed, last_updated, still_learning'
    )
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as UnderstandingRow[];
}

export interface UnderstandingHistoryRow {
  understanding_id: string;
  event_date: string;
  label: string;
}

export async function fetchUnderstandingHistory(
  userId: string
): Promise<UnderstandingHistoryRow[]> {
  const { data, error } = await supabase
    .from('understanding_history')
    .select('understanding_id, event_date, label')
    .eq('user_id', userId)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as UnderstandingHistoryRow[];
}

export interface RelationshipRow {
  from_domain: Domain;
  to_domain: Domain;
  strength: Strength;
  confidence: number | null;
}

export async function fetchRelationships(userId: string): Promise<RelationshipRow[]> {
  const { data, error } = await supabase
    .from('relationships')
    .select('from_domain, to_domain, strength, confidence')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as RelationshipRow[];
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

// "Connected" here means real synced data exists, not just that the user
// once tapped through the permission flow — a revoked OS-level permission
// stops producing new observations, but doesn't retroactively make this
// false, which matches how every other "connected" status in this app
// already means "there's real data," not "a flag was set once."
export async function hasHealthSourceObservations(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('source', ['health-connect', 'apple-health']);
  if (error) throw error;
  return (count ?? 0) > 0;
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
