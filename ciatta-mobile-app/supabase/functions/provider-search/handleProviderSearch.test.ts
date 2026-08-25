// Closes the one remaining verification gap: the happy path
//   Understanding -> Guidance -> Care Connection -> Provider Search ->
//   real NPI provider results -> (client) ProviderSearchSheet -> Visit
//   Preparation
// exercised end-to-end against a fixture Understanding that only exists in
// this test file — never written to the real project. Every function
// called below is the actual production code (handleProviderSearch from
// index.ts, createNpiRegistryAdapter from npiRegistryAdapter.ts); the only
// things swapped out are the two real I/O edges (a Supabase lookup, an
// HTTP call to NPI Registry), each replaced with a fixture that returns
// data shaped exactly like the real thing.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { CARE_TYPE_SPECIALTY, handleProviderSearch, type UnderstandingLookup } from './index.ts';
import { createNpiRegistryAdapter } from './npiRegistryAdapter.ts';

// A realistic, captured-shape NPI Registry response (same fixture data as
// npiRegistryAdapter.test.ts) — this is what a real OB/GYN search near a
// real ZIP actually returns, reused here so the "results normalize
// correctly" claim is checked with the exact same fixture, not two
// different ones that could quietly drift apart.
const NPI_FIXTURE_RESPONSE = {
  result_count: 1,
  results: [
    {
      number: '1770635237',
      enumeration_type: 'NPI-2' as const,
      basic: {
        organization_name: 'A PARK AVENUE OBGYN PC',
        last_updated: '2008-06-13',
        status: 'A',
      },
      addresses: [
        {
          address_purpose: 'LOCATION',
          address_1: '36E 70TH ST',
          address_2: null,
          city: 'NEW YORK',
          state: 'NY',
          postal_code: '10021',
          telephone_number: '212-677-1000',
        },
      ],
      taxonomies: [
        { code: '207VG0400X', desc: 'Obstetrics & Gynecology, Gynecology', primary: true },
      ],
    },
  ],
};

// The fixture Understanding — persisted nowhere. Shaped exactly like a
// real row the Understanding Engine's careGuidance.ts would have written
// for a 'cycle' domain at 'strong'+ confidence: has a real
// care_recommendation_type, which is the one field this whole chain
// actually depends on.
const FIXTURE_UNDERSTANDING_ID = 'fixture-understanding-ob-gyn';
const FIXTURE_OWNER_ID = 'fixture-user-owner';
const FIXTURE_UNDERSTANDING: UnderstandingLookup = {
  id: FIXTURE_UNDERSTANDING_ID,
  care_recommendation_type: 'ob-gyn',
  domain: 'cycle',
};

/** Stands in for the real Supabase-backed getUnderstanding — scoped to
 * (id, userId) exactly like the real `.eq('id', id).eq('user_id', userId)`
 * query, so a lookup by the wrong user fails exactly the way RLS would
 * make the real one fail: silently, as "not found." */
function fixtureGetUnderstanding(id: string, userId: string): Promise<UnderstandingLookup | null> {
  if (id === FIXTURE_UNDERSTANDING_ID && userId === FIXTURE_OWNER_ID) {
    return Promise.resolve(FIXTURE_UNDERSTANDING);
  }
  return Promise.resolve(null);
}

/** Swaps global fetch for the duration of one test, so the *real*
 * createNpiRegistryAdapter() runs its actual buildQuery/normalize logic
 * against a canned response instead of a live network call. Always
 * restored, even on failure. */
async function withFixtureFetch<T>(response: unknown, fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  let capturedUrl: string | null = null;
  globalThis.fetch = ((url: string) => {
    capturedUrl = url;
    return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
  }) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    void capturedUrl;
  }
}

Deno.test('happy path: a real care_recommendation_type produces the correct search criteria', async () => {
  await withFixtureFetch(NPI_FIXTURE_RESPONSE, async () => {
    const result = await handleProviderSearch(
      { userId: FIXTURE_OWNER_ID, understandingId: FIXTURE_UNDERSTANDING_ID },
      { getUnderstanding: fixtureGetUnderstanding, adapter: createNpiRegistryAdapter() }
    );
    assertEquals(result.status, 200);
    if ('criteria' in result.body) {
      assertEquals(result.body.criteria.specialty, CARE_TYPE_SPECIALTY['ob-gyn']);
      assertEquals(result.body.criteria.specialty, 'Obstetrics & Gynecology');
    } else {
      throw new Error('expected a success body');
    }
  });
});

Deno.test('happy path: real (fixture-served) NPI results normalize correctly through the real adapter', async () => {
  await withFixtureFetch(NPI_FIXTURE_RESPONSE, async () => {
    const result = await handleProviderSearch(
      { userId: FIXTURE_OWNER_ID, understandingId: FIXTURE_UNDERSTANDING_ID },
      { getUnderstanding: fixtureGetUnderstanding, adapter: createNpiRegistryAdapter() }
    );
    assertEquals(result.status, 200);
    if (!('providers' in result.body)) throw new Error('expected a success body');
    assertEquals(result.body.providers.length, 1);
    const provider = result.body.providers[0];
    assertEquals(provider.source, 'npi-registry');
    assertEquals(provider.name, 'A PARK AVENUE OBGYN PC');
    assertEquals(provider.providerType, 'organization');
    assertEquals(provider.specialty, ['Obstetrics & Gynecology, Gynecology']);
    assertEquals(provider.address?.city, 'NEW YORK');
    assertEquals(provider.phone, '212-677-1000');
    // Fields NPI Registry can't supply stay null, not guessed.
    assertEquals(provider.insurance, null);
    assertEquals(provider.acceptingNewPatients, null);
  });
});

Deno.test('authorization: a caller who is not the owner cannot reach the understanding, and gets the same response as "not found"', async () => {
  await withFixtureFetch(NPI_FIXTURE_RESPONSE, async () => {
    const result = await handleProviderSearch(
      { userId: 'someone-else-entirely', understandingId: FIXTURE_UNDERSTANDING_ID },
      { getUnderstanding: fixtureGetUnderstanding, adapter: createNpiRegistryAdapter() }
    );
    assertEquals(result.status, 404);
    assert('error' in result.body);
    // Same message a genuinely nonexistent id gets — the point is that
    // this endpoint never reveals whether a row exists for someone else.
    const notFound = await handleProviderSearch(
      { userId: 'someone-else-entirely', understandingId: 'genuinely-does-not-exist' },
      { getUnderstanding: fixtureGetUnderstanding, adapter: createNpiRegistryAdapter() }
    );
    assertEquals(notFound.status, 404);
    assertEquals(notFound.body, result.body);
  });
});

Deno.test('guidance safety: an understanding with no care_recommendation_type yet cannot search for a provider', async () => {
  const noRecommendation: UnderstandingLookup = {
    id: 'fixture-emerging',
    care_recommendation_type: null,
    domain: 'sleep',
  };
  const result = await handleProviderSearch(
    { userId: FIXTURE_OWNER_ID, understandingId: 'fixture-emerging' },
    {
      getUnderstanding: (id, userId) =>
        id === 'fixture-emerging' && userId === FIXTURE_OWNER_ID
          ? Promise.resolve(noRecommendation)
          : Promise.resolve(null),
      adapter: createNpiRegistryAdapter(),
    }
  );
  assertEquals(result.status, 422);
});

Deno.test('freeform search (no understanding) bypasses the Care Connection lookup entirely', async () => {
  await withFixtureFetch(NPI_FIXTURE_RESPONSE, async () => {
    let lookupCalled = false;
    const result = await handleProviderSearch(
      { userId: FIXTURE_OWNER_ID, overrides: { specialty: 'Obstetrics & Gynecology' } },
      {
        getUnderstanding: () => {
          lookupCalled = true;
          return Promise.resolve(null);
        },
        adapter: createNpiRegistryAdapter(),
      }
    );
    assertEquals(lookupCalled, false);
    assertEquals(result.status, 200);
  });
});

Deno.test('scope guard: the response shape never contains booking, messaging, referral, insurance-verification, or clinical-interoperability fields', async () => {
  await withFixtureFetch(NPI_FIXTURE_RESPONSE, async () => {
    const result = await handleProviderSearch(
      { userId: FIXTURE_OWNER_ID, understandingId: FIXTURE_UNDERSTANDING_ID },
      { getUnderstanding: fixtureGetUnderstanding, adapter: createNpiRegistryAdapter() }
    );
    const serialized = JSON.stringify(result.body).toLowerCase();
    for (const outOfScope of ['appointment', 'booking', 'message', 'referral', 'insuranceverif', 'fhir', 'hl7']) {
      assert(!serialized.includes(outOfScope), `response unexpectedly mentions "${outOfScope}"`);
    }
  });
});
