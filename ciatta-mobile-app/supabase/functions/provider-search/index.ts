// Provider Search — the newest link in the existing chain:
//   Understanding -> Guidance -> Care Connection -> Provider Search ->
//   Provider Results -> Visit Preparation -> Provider Feedback ->
//   Updated Understanding
//
// This never calls a provider-directory API from the mobile client (see
// providerDirectory.ts) and never invents a provider-matching heuristic of
// its own — the "which specialty" decision was already made by
// careGuidance.ts and is sitting on the caller's own understandings row as
// care_recommendation_type; this function's only job is turning that
// existing decision into a directory query, plus the caller's own location.
//
// Auth pattern mirrors delete-account: the caller's own bearer token
// resolves their identity, and everything this function reads (their own
// understandings row, their own profile) goes through a client scoped to
// that token — RLS does the access control, not this code. No
// service_role key anywhere in this file.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createNpiRegistryAdapter } from './npiRegistryAdapter.ts';
import type { ProviderDirectoryAdapter, ProviderSearchCriteria } from './providerDirectory.ts';

// Read lazily, inside the server entrypoint below, rather than at module
// top level — this module is also imported directly by
// handleProviderSearch.test.ts to test the real handler logic against
// fixture dependencies, and a top-level Deno.env.get() would require the
// test run itself to have env access for no reason (the tests never touch
// Supabase at all; only the HTTP entrypoint does).
function getSupabaseConfig() {
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  };
}

// A one-line factory, deliberately — swapping in a commercial adapter
// later (Ribbon/H1, Health Gorilla) means adding one more case here (or
// reading Deno.env.get('PROVIDER_DIRECTORY_ADAPTER') once there's more
// than one to choose between) and nothing else in this file, or in the
// mobile client, changes.
function getAdapter(): ProviderDirectoryAdapter {
  return createNpiRegistryAdapter();
}

// What each of Care Connection's three recommendation types searches for
// in a directory that speaks NPI taxonomy descriptions — a query mapping,
// not a diagnosis. If a future adapter needs different vocabulary for the
// same recommendation type, it translates this same
// care_recommendation_type itself; this function stays adapter-agnostic
// by asking the adapter to interpret `specialty` as a human-readable hint.
export const CARE_TYPE_SPECIALTY: Record<string, string> = {
  'primary-care': 'Family Medicine',
  'ob-gyn': 'Obstetrics & Gynecology',
  'mental-health': 'Psychiatry',
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface UnderstandingLookup {
  id: string;
  care_recommendation_type: string | null;
  domain: string;
}

export interface ProviderSearchDeps {
  // Scoped to (id, userId) rather than id alone — mirrors the real
  // implementation's `.eq('id', id).eq('user_id', userId)` query exactly:
  // "not found" and "found but not this caller's" are the same outcome
  // here, on purpose, so a lookup miss can never leak whether a row exists
  // for someone else.
  getUnderstanding: (id: string, userId: string) => Promise<UnderstandingLookup | null>;
  adapter: ProviderDirectoryAdapter;
}

export interface ProviderSearchRequest {
  userId: string;
  understandingId?: string;
  overrides?: Partial<ProviderSearchCriteria>;
}

export interface ProviderSearchResponse {
  status: number;
  body:
    | { error: string }
    | {
        source: string;
        capabilities: ProviderDirectoryAdapter['capabilities'];
        criteria: ProviderSearchCriteria;
        providers: Awaited<ReturnType<ProviderDirectoryAdapter['search']>>;
      };
}

/**
 * The actual decision logic behind the HTTP handler below, with its two
 * real dependencies (looking up an Understanding, searching a directory)
 * injected rather than reached for directly — this is what both the real
 * Deno.serve handler and this file's own tests call, so a test exercising
 * this function is exercising the exact same logic production runs, not a
 * reimplementation of it. Only the two I/O edges (Supabase, the directory
 * adapter's HTTP call) are ever swapped for a test.
 */
export async function handleProviderSearch(
  request: ProviderSearchRequest,
  deps: ProviderSearchDeps
): Promise<ProviderSearchResponse> {
  const { userId, understandingId, overrides = {} } = request;
  let criteria: ProviderSearchCriteria = { ...overrides };

  // Deriving from an existing Understanding is the primary path this
  // product actually wants ("Based on what Ciatta understands, who should
  // I talk to?") — a caller can still search freeform (no understandingId,
  // just criteria) for the general "find a provider" case, but that's the
  // fallback, not what Care Connection uses.
  if (understandingId) {
    const understanding = await deps.getUnderstanding(understandingId, userId);
    if (!understanding) return { status: 404, body: { error: 'Understanding not found' } };
    if (!understanding.care_recommendation_type) {
      // Exactly the "remain silent when evidence does not justify
      // guidance" rule, one hop further down the chain: no Care
      // Connection recommendation means no provider search either.
      return {
        status: 422,
        body: { error: 'No care recommendation exists for this understanding yet' },
      };
    }

    const specialty = CARE_TYPE_SPECIALTY[understanding.care_recommendation_type];
    criteria = { specialty, ...overrides };
    // The user's own free-text location, already collected in Profile, is
    // merged in by the HTTP handler's overrides before this function is
    // ever called — this function only ever sees the already-resolved
    // criteria object.
  }

  const providers = await deps.adapter.search(criteria);
  return {
    status: 200,
    body: { source: deps.adapter.source, capabilities: deps.adapter.capabilities, criteria, providers },
  };
}

// Guarded so importing this module (as handleProviderSearch.test.ts does,
// to test against the real handler with fixture dependencies) never starts
// a live server as a side effect — only the real deployed invocation, run
// as the entrypoint, does.
if (import.meta.main) {
  Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { supabaseUrl, anonKey } = getSupabaseConfig();
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);
    const userId = userData.user.id;

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const understandingId = body?.understanding_id as string | undefined;
    const overrides = (body?.criteria ?? {}) as Partial<ProviderSearchCriteria>;

    const result = await handleProviderSearch(
      { userId, understandingId, overrides },
      {
        getUnderstanding: async (id, uid) => {
          const { data, error } = await caller
            .from('understandings')
            .select('id, care_recommendation_type, domain')
            .eq('id', id)
            .eq('user_id', uid)
            .maybeSingle();
          if (error) throw error;
          if (data) return data as UnderstandingLookup;

          // Not a domain-level Understanding — try Cross-Domain
          // Understanding before giving up. Same RLS-scoped caller client,
          // same (id, user_id) ownership check, same UnderstandingLookup
          // shape this function already speaks; `label` (e.g.
          // "sleep-related") stands in for `domain`, which nothing in this
          // file's own logic ever branches on.
          const { data: crossDomain, error: crossDomainError } = await caller
            .from('cross_domain_understandings')
            .select('id, care_recommendation_type, label')
            .eq('id', id)
            .eq('user_id', uid)
            .maybeSingle();
          if (crossDomainError) throw crossDomainError;
          if (!crossDomain) return null;
          return {
            id: crossDomain.id,
            care_recommendation_type: crossDomain.care_recommendation_type,
            domain: crossDomain.label,
          } as UnderstandingLookup;
        },
        adapter: getAdapter(),
      }
    );

    return json(result.body, result.status);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
  });
}
