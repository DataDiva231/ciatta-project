import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildQuery, normalizeResponse } from './npiRegistryAdapter.ts';

// NPI Registry has no separate sandbox/mock environment — it's a single
// public, read-only, unauthenticated government dataset, so there's no
// "test" tier distinct from "real" the way a commercial API would have.
// This fixture is a captured, real response shape (individual + organization
// rows) from a live query made while building this adapter, trimmed to the
// fields normalize() actually reads — it exercises the adapter's own logic
// (query building, normalization) without making a network call in tests.
const SAMPLE_RESPONSE = {
  result_count: 2,
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
          address_purpose: 'MAILING',
          address_1: 'PO BOX 2040',
          address_2: 'LENOX HILL STATION',
          city: 'NEW YORK',
          state: 'NY',
          postal_code: '10021',
          telephone_number: '212-677-1000',
        },
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
        {
          code: '207VG0400X',
          desc: 'Obstetrics & Gynecology, Gynecology',
          primary: true,
        },
      ],
    },
    {
      number: '1013979493',
      enumeration_type: 'NPI-1' as const,
      basic: {
        first_name: 'NADEEM',
        last_name: 'ABU-RUSTUM',
        middle_name: 'R',
        credential: 'MD',
        last_updated: '2015-04-07',
        status: 'A',
      },
      addresses: [
        {
          address_purpose: 'MAILING',
          address_1: '633 3RD AVE',
          address_2: 'BOX 3',
          city: 'NEW YORK',
          state: 'NY',
          postal_code: '100176706',
        },
        {
          address_purpose: 'LOCATION',
          address_1: '1275 YORK AVE',
          address_2: null,
          city: 'NEW YORK',
          state: 'NY',
          postal_code: '100216007',
          telephone_number: '212-639-2000',
        },
      ],
      taxonomies: [
        {
          code: '207VX0201X',
          desc: 'Obstetrics & Gynecology, Gynecologic Oncology',
          primary: true,
        },
      ],
    },
  ],
};

Deno.test('buildQuery: specialty maps to taxonomy_description', () => {
  const params = buildQuery({ specialty: 'Obstetrics & Gynecology' });
  assertEquals(params.get('taxonomy_description'), 'Obstetrics & Gynecology');
  assertEquals(params.get('version'), '2.1');
});

Deno.test('buildQuery: a multi-word provider name splits into first/last', () => {
  const params = buildQuery({ providerName: 'Jane Q Public' });
  assertEquals(params.get('first_name'), 'Jane');
  assertEquals(params.get('last_name'), 'Q Public');
});

Deno.test('buildQuery: a single-word provider name is treated as a last name', () => {
  const params = buildQuery({ providerName: 'Public' });
  assertEquals(params.get('first_name'), null);
  assertEquals(params.get('last_name'), 'Public');
});

Deno.test('buildQuery: location fields pass through untouched', () => {
  const params = buildQuery({ city: 'New York', state: 'NY', postalCode: '10021' });
  assertEquals(params.get('city'), 'New York');
  assertEquals(params.get('state'), 'NY');
  assertEquals(params.get('postal_code'), '10021');
});

Deno.test('buildQuery: limit is capped at 200 (the API max) and defaults to 20', () => {
  assertEquals(buildQuery({}).get('limit'), '20');
  assertEquals(buildQuery({ limit: 500 }).get('limit'), '200');
  assertEquals(buildQuery({ limit: 5 }).get('limit'), '5');
});

Deno.test('normalizeResponse: an organization row becomes an organization Provider', () => {
  const providers = normalizeResponse(SAMPLE_RESPONSE);
  const org = providers[0];
  assertEquals(org.providerType, 'organization');
  assertEquals(org.name, 'A PARK AVENUE OBGYN PC');
  assertEquals(org.organization, 'A PARK AVENUE OBGYN PC');
  assertEquals(org.specialty, ['Obstetrics & Gynecology, Gynecology']);
});

Deno.test('normalizeResponse: an individual row becomes an individual Provider with a joined name', () => {
  const providers = normalizeResponse(SAMPLE_RESPONSE);
  const individual = providers[1];
  assertEquals(individual.providerType, 'individual');
  assertEquals(individual.name, 'NADEEM R ABU-RUSTUM');
  assertEquals(individual.organization, null);
});

Deno.test('normalizeResponse: the LOCATION address is preferred over MAILING', () => {
  const providers = normalizeResponse(SAMPLE_RESPONSE);
  assertEquals(providers[0].address?.line1, '36E 70TH ST');
  assertEquals(providers[1].address?.line1, '1275 YORK AVE');
});

Deno.test('normalizeResponse: fields this source cannot supply are null, never guessed', () => {
  for (const provider of normalizeResponse(SAMPLE_RESPONSE)) {
    assertEquals(provider.location, null);
    assertEquals(provider.website, null);
    assertEquals(provider.acceptingNewPatients, null);
    assertEquals(provider.insurance, null);
  }
});

Deno.test('normalizeResponse: id and source are always set for provenance', () => {
  const providers = normalizeResponse(SAMPLE_RESPONSE);
  assert(providers.every((p) => p.source === 'npi-registry'));
  assertEquals(providers[0].id, '1770635237');
  assertEquals(providers[1].id, '1013979493');
});

Deno.test('normalizeResponse: an empty result set normalizes to an empty array, not an error', () => {
  assertEquals(normalizeResponse({ result_count: 0 }), []);
});
