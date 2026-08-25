import { supabase } from './supabase';

// Mirrors supabase/functions/provider-search/providerDirectory.ts field for
// field — the two can't share an import across the Deno/RN boundary (every
// other cross-runtime type in this codebase repeats itself the same way,
// e.g. queries.ts's UnderstandingRow vs. the Understanding Engine's own
// draft types). The client never talks to a provider-directory API
// directly; this is purely the shape of what provider-search already
// normalized server-side.
export interface ProviderAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface Provider {
  id: string;
  source: string;
  name: string;
  providerType: 'individual' | 'organization';
  specialty: string[];
  organization: string | null;
  address: ProviderAddress | null;
  location: { lat: number; lng: number } | null;
  phone: string | null;
  website: string | null;
  acceptingNewPatients: boolean | null;
  insurance: string[] | null;
  sourceMetadata: Record<string, unknown>;
}

export interface ProviderSearchCriteria {
  specialty?: string;
  providerName?: string;
  organization?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  distanceMiles?: number;
  insurance?: string;
  limit?: number;
}

export interface ProviderDirectoryCapabilities {
  specialty: boolean;
  distance: boolean;
  insurance: boolean;
  acceptingNewPatients: boolean;
  geocoding: boolean;
}

export interface ProviderSearchResult {
  source: string;
  capabilities: ProviderDirectoryCapabilities;
  criteria: ProviderSearchCriteria;
  providers: Provider[];
}

/**
 * The primary path: derives what to search for from an existing
 * Understanding's own Care Connection recommendation (care_recommendation_
 * type), server-side — this never re-decides a specialty client-side.
 * `locationOverride` is the only thing the client adds, since the server
 * doesn't parse the user's free-text profile location for them.
 */
export async function searchProvidersForUnderstanding(
  understandingId: string,
  locationOverride?: Pick<ProviderSearchCriteria, 'city' | 'state' | 'postalCode'>
): Promise<ProviderSearchResult> {
  const { data, error } = await supabase.functions.invoke('provider-search', {
    body: { understanding_id: understandingId, criteria: locationOverride ?? {} },
  });
  if (error) throw error;
  return data as ProviderSearchResult;
}

/** The fallback path — a freeform search with no Understanding behind it,
 * for a general "find a provider" entry point rather than a Care
 * Connection-driven one. Not currently wired into any screen, but the
 * server endpoint already supports it, so the client-side seam exists
 * too. */
export async function searchProviders(criteria: ProviderSearchCriteria): Promise<ProviderSearchResult> {
  const { data, error } = await supabase.functions.invoke('provider-search', {
    body: { criteria },
  });
  if (error) throw error;
  return data as ProviderSearchResult;
}
