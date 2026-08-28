import { supabase } from './supabase';
import { displayCopy, displayCopyList, displayCopyMaybe } from './displayCopy';
import { presentPersistedUnderstanding } from './intelligenceStatus';
import type { Discovery, Domain, Strength } from './types';

// 'primary-care' | 'ob-gyn' | 'mental-health' — mirrors
// understanding-engine/careGuidance.ts's CareRecommendationType. Kept as a
// plain string here rather than re-exporting a union: the client only ever
// displays this value, never branches on it, so a mismatch would show up
// as a wrong label, not a type error worth chasing across the Deno/RN
// boundary.
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
  // Guidance and Care Connection — written by the same Understanding
  // Engine run that writes `narrative`, gated on the same `strength`. Null
  // on any row where the evidence didn't clear the bar; that IS "Ciatta
  // stays silent," not a missing value to fall back on.
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
}

export async function fetchUnderstandings(userId: string): Promise<UnderstandingRow[]> {
  const { data, error } = await supabase
    .from('understandings')
    .select(
      'id, domain, strength, narrative, observations_count, confidence_label, learning_since, first_observed, last_updated, still_learning, guidance, care_recommendation_type, care_recommendation_reason'
    )
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as UnderstandingRow[]).map(sanitizeUnderstanding);
}

function sanitizeUnderstanding(row: UnderstandingRow): UnderstandingRow {
  return presentPersistedUnderstanding({
    ...row,
    narrative: displayCopyMaybe(row.narrative) ?? '',
    confidence_label: displayCopyMaybe(row.confidence_label),
    still_learning: displayCopyList(row.still_learning),
    guidance: displayCopyMaybe(row.guidance),
    care_recommendation_reason: displayCopyMaybe(row.care_recommendation_reason),
  });
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
  return ((data ?? []) as UnderstandingHistoryRow[]).map((row) => ({
    ...row,
    label: displayCopy(row.label),
  }));
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

// A Cross-Domain Understanding — the Understanding Engine's own promotion
// of an already-qualifying Relationship between two independently
// actionable-strength, health_data Domain Understandings (see
// crossDomainSynthesis.ts) into a higher-level row. Same shape/meaning as
// UnderstandingRow's own guidance/care fields, deliberately: the client
// renders these with the same components, it never needs a second
// vocabulary. `label` (e.g. "sleep-related") is display-only categorization
// picked by the engine; `from_domain`/`to_domain` are the real provenance —
// see contributing_understanding_ids on the row itself, which the client
// doesn't need since it already has both contributing UnderstandingRows
// loaded by domain.
export interface CrossDomainUnderstandingRow {
  id: string;
  from_domain: Domain;
  to_domain: Domain;
  label: string;
  narrative: string;
  strength: Strength;
  confidence_label: string | null;
  still_learning: string[];
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
  first_observed: string | null;
  last_updated: string;
}

export async function fetchCrossDomainUnderstandings(
  userId: string
): Promise<CrossDomainUnderstandingRow[]> {
  const { data, error } = await supabase
    .from('cross_domain_understandings')
    .select(
      'id, from_domain, to_domain, label, narrative, strength, confidence_label, still_learning, guidance, care_recommendation_type, care_recommendation_reason, first_observed, last_updated'
    )
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as CrossDomainUnderstandingRow[]).map((row) => ({
    ...row,
    label: displayCopy(row.label),
    narrative: displayCopy(row.narrative),
    confidence_label: displayCopyMaybe(row.confidence_label),
    still_learning: displayCopyList(row.still_learning),
    guidance: displayCopyMaybe(row.guidance),
    care_recommendation_reason: displayCopyMaybe(row.care_recommendation_reason),
  }));
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
  return ((data ?? []) as DiscoveryRow[]).map((row) => ({
    ...row,
    name: displayCopyMaybe(row.name),
    narrative: displayCopy(row.narrative),
    detail: displayCopyMaybe(row.detail),
    confidence_label: displayCopyMaybe(row.confidence_label),
    suggested_names: displayCopyList(row.suggested_names),
  }));
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
