import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  selectNewProviderFeedbackDrafts,
  type ProviderFeedbackObservation,
} from './providerFeedbackEvidence.ts';

const OWNED = new Set(['understanding-1']);

function obs(overrides: Partial<ProviderFeedbackObservation> = {}): ProviderFeedbackObservation {
  return {
    id: 'obs-1',
    type: 'provider_assessment',
    recordedAt: '2026-08-20T18:00:00Z',
    domain: 'sleep',
    understandingId: 'understanding-1',
    ...overrides,
  };
}

Deno.test('selectNewProviderFeedbackDrafts: a real, new, owned feedback observation produces one draft', () => {
  const drafts = selectNewProviderFeedbackDrafts([obs()], new Set(), OWNED);
  assertEquals(drafts.length, 1);
  assertEquals(drafts[0].observationId, 'obs-1');
  assertEquals(drafts[0].domain, 'sleep');
  assertEquals(drafts[0].understandingId, 'understanding-1');
  assertEquals(drafts[0].eventDate, '2026-08-20');
  assertEquals(drafts[0].historyLabel, 'Logged what a provider said about this.');
});

Deno.test('selectNewProviderFeedbackDrafts: provider_outcome gets its own distinct history label', () => {
  const drafts = selectNewProviderFeedbackDrafts(
    [obs({ id: 'obs-2', type: 'provider_outcome' })],
    new Set(),
    OWNED
  );
  assertEquals(drafts[0].historyLabel, 'Logged what happened after talking with a provider.');
});

Deno.test('selectNewProviderFeedbackDrafts: already-recorded observations never produce a duplicate draft (idempotency)', () => {
  const drafts = selectNewProviderFeedbackDrafts([obs()], new Set(['obs-1']), OWNED);
  assertEquals(drafts.length, 0);
});

Deno.test('selectNewProviderFeedbackDrafts: an observation missing a domain is skipped, not guessed at', () => {
  const drafts = selectNewProviderFeedbackDrafts([obs({ domain: null })], new Set(), OWNED);
  assertEquals(drafts.length, 0);
});

Deno.test('selectNewProviderFeedbackDrafts: an observation missing an understandingId is skipped', () => {
  const drafts = selectNewProviderFeedbackDrafts([obs({ understandingId: null })], new Set(), OWNED);
  assertEquals(drafts.length, 0);
});

Deno.test('selectNewProviderFeedbackDrafts: security — an understandingId not owned by this user is rejected even though everything else about it looks valid', () => {
  const drafts = selectNewProviderFeedbackDrafts(
    [obs({ understandingId: 'someone-elses-understanding' })],
    new Set(),
    OWNED
  );
  assertEquals(drafts.length, 0);
});

Deno.test('selectNewProviderFeedbackDrafts: multiple new observations across domains each produce their own draft', () => {
  const owned = new Set(['u-sleep', 'u-mood']);
  const drafts = selectNewProviderFeedbackDrafts(
    [
      obs({ id: 'a', domain: 'sleep', understandingId: 'u-sleep' }),
      obs({ id: 'b', domain: 'mood', understandingId: 'u-mood', type: 'provider_outcome' }),
    ],
    new Set(),
    owned
  );
  assertEquals(drafts.length, 2);
  assertEquals(new Set(drafts.map((d) => d.domain)), new Set(['sleep', 'mood']));
});

Deno.test('selectNewProviderFeedbackDrafts: a mix of already-recorded and new observations only returns the new ones', () => {
  const drafts = selectNewProviderFeedbackDrafts(
    [obs({ id: 'old' }), obs({ id: 'new' })],
    new Set(['old']),
    OWNED
  );
  assertEquals(drafts.length, 1);
  assertEquals(drafts[0].observationId, 'new');
});

Deno.test('selectNewProviderFeedbackDrafts: never produces strength, confidence, or guidance fields — evidence attribution only', () => {
  const drafts = selectNewProviderFeedbackDrafts([obs()], new Set(), OWNED);
  const keys = Object.keys(drafts[0]);
  for (const forbidden of ['strength', 'confidence', 'guidance', 'narrative']) {
    assert(!keys.includes(forbidden), `draft unexpectedly has a "${forbidden}" field`);
  }
});
