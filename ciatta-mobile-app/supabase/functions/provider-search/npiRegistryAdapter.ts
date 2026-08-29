// The first ProviderDirectoryAdapter — CMS's NPI Registry (NPPES), the
// U.S. government's public directory of every enumerated healthcare
// provider and organization. Chosen for the first adapter specifically
// because it's real, free, requires no API key or vendor contract, and
// returns real provider data today rather than a placeholder — "do not
// use synthetic production providers" ruled out anything that isn't an
// actual live directory.
//
// It's also honestly limited: no distance-radius search, no insurance or
// accepting-new-patients data, no geocoding. Those gaps are declared in
// `capabilities` below rather than papered over, and are exactly the kind
// of thing a commercial adapter (Ribbon/H1, Health Gorilla) would fill in
// later without this file or its callers needing to change.
//
// API docs: https://npiregistry.cms.hhs.gov/api-page
import type {
  Provider,
  ProviderDirectoryAdapter,
  ProviderDirectoryCapabilities,
  ProviderSearchCriteria,
} from './providerDirectory.ts';

const NPI_REGISTRY_URL = 'https://npiregistry.cms.hhs.gov/api/';

interface NpiAddress {
  address_purpose: string;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  telephone_number?: string;
}

interface NpiTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
}

interface NpiBasic {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  credential?: string;
  organization_name?: string;
  last_updated?: string;
  status?: string;
}

interface NpiResult {
  number: string;
  enumeration_type: 'NPI-1' | 'NPI-2';
  basic: NpiBasic;
  addresses: NpiAddress[];
  taxonomies: NpiTaxonomy[];
}

interface NpiResponse {
  result_count: number;
  results?: NpiResult[];
  Errors?: { description: string }[];
}

function pickAddress(addresses: NpiAddress[]): NpiAddress | null {
  return addresses.find((a) => a.address_purpose === 'LOCATION') ?? addresses[0] ?? null;
}

function normalize(result: NpiResult): Provider {
  const isOrg = result.enumeration_type === 'NPI-2';
  const name = isOrg
    ? result.basic.organization_name ?? 'Unknown organization'
    : [result.basic.first_name, result.basic.middle_name, result.basic.last_name]
        .filter(Boolean)
        .join(' ') || 'Unknown provider';

  const address = pickAddress(result.addresses ?? []);
  const primaryTaxonomy = result.taxonomies?.find((t) => t.primary) ?? result.taxonomies?.[0];

  return {
    id: result.number,
    source: 'npi-registry',
    name,
    providerType: isOrg ? 'organization' : 'individual',
    specialty: (result.taxonomies ?? []).map((t) => t.desc),
    organization: isOrg ? result.basic.organization_name ?? null : null,
    address: address
      ? {
          line1: address.address_1,
          line2: address.address_2,
          city: address.city,
          state: address.state,
          postalCode: address.postal_code,
        }
      : null,
    // NPI Registry doesn't geocode addresses — a real lat/lng would need a
    // separate geocoding step this adapter doesn't take on.
    location: null,
    phone: address?.telephone_number ?? null,
    // Not part of this dataset at all.
    website: null,
    acceptingNewPatients: null,
    insurance: null,
    sourceMetadata: {
      npi: result.number,
      enumerationType: result.enumeration_type,
      status: result.basic.status ?? null,
      lastUpdated: result.basic.last_updated ?? null,
      primaryTaxonomyCode: primaryTaxonomy?.code ?? null,
    },
  };
}

export const NPI_REGISTRY_CAPABILITIES: ProviderDirectoryCapabilities = {
  specialty: true,
  distance: false,
  insurance: false,
  acceptingNewPatients: false,
  geocoding: false,
};

/** Exported separately from the adapter object so tests can exercise the
 * pure request-building and normalization logic without a network call. */
export function buildQuery(criteria: ProviderSearchCriteria): URLSearchParams {
  const params = new URLSearchParams({ version: '2.1' });
  if (criteria.specialty) params.set('taxonomy_description', criteria.specialty);
  if (criteria.organization) params.set('organization_name', criteria.organization);
  if (criteria.providerName) {
    const [first, ...rest] = criteria.providerName.trim().split(/\s+/);
    if (rest.length > 0) {
      params.set('first_name', first);
      params.set('last_name', rest.join(' '));
    } else if (first) {
      params.set('last_name', first);
    }
  }
  if (criteria.city) params.set('city', criteria.city);
  if (criteria.state) params.set('state', criteria.state);
  if (criteria.postalCode) params.set('postal_code', criteria.postalCode);
  params.set('limit', String(Math.min(criteria.limit ?? 20, 200)));
  return params;
}

export function normalizeResponse(body: NpiResponse): Provider[] {
  return (body.results ?? []).map(normalize);
}

export function createNpiRegistryAdapter(): ProviderDirectoryAdapter {
  return {
    source: 'npi-registry',
    capabilities: NPI_REGISTRY_CAPABILITIES,
    async search(criteria: ProviderSearchCriteria): Promise<Provider[]> {
      const params = buildQuery(criteria);
      const res = await fetch(`${NPI_REGISTRY_URL}?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`NPI Registry request failed: ${res.status}`);
      }
      const body = (await res.json()) as NpiResponse;
      if (body.Errors && body.Errors.length > 0) {
        const description = body.Errors.map((e) => e.description).join('; ');
        if (/no valid search criteria/i.test(description)) return [];
        throw new Error(description);
      }
      return normalizeResponse(body);
    },
  };
}
