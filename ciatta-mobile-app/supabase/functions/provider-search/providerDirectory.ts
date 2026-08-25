// The provider-directory abstraction Care Connection sits behind — the
// intelligence layer (careGuidance.ts, understandings.care_recommendation_*)
// never talks to a vendor directly, only to this interface. Swapping NPI
// Registry for Ribbon/H1/Health Gorilla later means writing one more file
// that implements ProviderDirectoryAdapter and pointing the factory in
// index.ts at it — nothing about Care Connection, Guidance, or the mobile
// client changes.

export interface ProviderAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

// The normalized shape every adapter must produce, regardless of what its
// upstream API actually returns. A source that can't supply a field
// returns null for it — never a guess, never an empty-string stand-in
// that would read as "no insurance accepted" instead of "unknown."
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

// What a given adapter can actually honor — the search criteria interface
// is a superset of every vendor this product might ever add (per the
// product spec's own field list), but no single directory supports all of
// it. Declaring this explicitly means a caller can tell a user "distance
// filtering isn't available for this source" instead of the filter
// silently doing nothing.
export interface ProviderDirectoryCapabilities {
  specialty: boolean;
  distance: boolean;
  insurance: boolean;
  acceptingNewPatients: boolean;
  geocoding: boolean;
}

export interface ProviderDirectoryAdapter {
  readonly source: string;
  readonly capabilities: ProviderDirectoryCapabilities;
  search(criteria: ProviderSearchCriteria): Promise<Provider[]>;
}
