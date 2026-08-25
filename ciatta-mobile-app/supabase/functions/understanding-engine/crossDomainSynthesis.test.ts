import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  buildCrossDomainDraft,
  weakerStrength,
  type ContributingUnderstanding,
  type QualifyingRelationship,
} from './crossDomainSynthesis.ts';

function understanding(overrides: Partial<ContributingUnderstanding> = {}): ContributingUnderstanding {
  return {
    id: 'u-1',
    domain: 'sleep',
    strength: 'strong',
    evidenceType: 'health_data',
    learningSince: '2026-06-01',
    observationsCount: 40,
    ...overrides,
  };
}

function relationship(overrides: Partial<QualifyingRelationship> = {}): QualifyingRelationship {
  return { fromDomain: 'sleep', toDomain: 'recovery', strength: 'strong', ...overrides };
}

Deno.test('buildCrossDomainDraft: valid synthesis — two strong, health_data understandings linked by a strong relationship', () => {
  const from = understanding({ id: 'u-sleep', domain: 'sleep', strength: 'strong' });
  const to = understanding({ id: 'u-recovery', domain: 'recovery', strength: 'very-strong' });
  const draft = buildCrossDomainDraft(relationship(), from, to);
  assert(draft !== null);
  assertEquals(draft!.fromDomain, 'sleep');
  assertEquals(draft!.toDomain, 'recovery');
  assertEquals(draft!.label, 'recovery-related');
  assertEquals(draft!.primaryDomain, 'recovery');
  assertEquals(draft!.otherDomain, 'sleep');
  assert(draft!.narrative.includes('sleep'));
  assert(draft!.narrative.includes('recovery'));
});

Deno.test('buildCrossDomainDraft: insufficient evidence — a merely moderate contributing understanding blocks synthesis entirely', () => {
  const from = understanding({ strength: 'moderate' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong' });
  assertEquals(buildCrossDomainDraft(relationship(), from, to), null);
});

Deno.test('buildCrossDomainDraft: insufficient evidence — emerging on either side blocks synthesis, no matter how strong the other is', () => {
  const from = understanding({ strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'emerging' });
  assertEquals(buildCrossDomainDraft(relationship(), from, to), null);
});

Deno.test('buildCrossDomainDraft: conflicting/unsupported domains — a real relationship that never rose above moderate does not qualify', () => {
  const from = understanding({ strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong' });
  const weakRelationship = relationship({ strength: 'moderate' });
  assertEquals(buildCrossDomainDraft(weakRelationship, from, to), null);
});

Deno.test('buildCrossDomainDraft: no keyword-only synthesis — a user_reported contributor never qualifies, regardless of its strength field', () => {
  const from = understanding({ evidenceType: 'user_reported', strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong' });
  assertEquals(buildCrossDomainDraft(relationship(), from, to), null);
  // Same when the *other* side is the self-report.
  const to2 = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong', evidenceType: 'user_reported' });
  assertEquals(buildCrossDomainDraft(relationship(), understanding({ strength: 'very-strong' }), to2), null);
});

Deno.test('buildCrossDomainDraft: a relationship whose domains do not match the two understandings passed in is rejected, not silently repaired', () => {
  const from = understanding({ domain: 'sleep', strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'mood', strength: 'very-strong' });
  // relationship() defaults to sleep -> recovery, not sleep -> mood.
  assertEquals(buildCrossDomainDraft(relationship(), from, to), null);
});

Deno.test('buildCrossDomainDraft: the same domain on both sides never synthesizes against itself', () => {
  const from = understanding({ domain: 'sleep', strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'sleep', strength: 'very-strong' });
  const selfRelationship = relationship({ fromDomain: 'sleep', toDomain: 'sleep' });
  assertEquals(buildCrossDomainDraft(selfRelationship, from, to), null);
});

Deno.test('weakerStrength: picks the weaker tier, never an average, in both directions', () => {
  assertEquals(weakerStrength('very-strong', 'strong'), 'strong');
  assertEquals(weakerStrength('strong', 'very-strong'), 'strong');
  assertEquals(weakerStrength('strong', 'strong'), 'strong');
  assertEquals(weakerStrength('moderate', 'very-strong'), 'moderate');
});

Deno.test('buildCrossDomainDraft: conservative confidence propagation — synthesized strength is exactly the weaker contributor, never the stronger and never averaged', () => {
  const from = understanding({ domain: 'sleep', strength: 'strong' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong' });
  const draft = buildCrossDomainDraft(relationship(), from, to);
  assertEquals(draft!.strength, 'strong');
  assertEquals(draft!.confidenceLabel, 'confident');
});

Deno.test('buildCrossDomainDraft: provenance — contributing_understanding_ids names exactly the two source rows, in (from, to) order', () => {
  const from = understanding({ id: 'understanding-abc', domain: 'sleep', strength: 'strong' });
  const to = understanding({ id: 'understanding-xyz', domain: 'recovery', strength: 'strong' });
  const draft = buildCrossDomainDraft(relationship(), from, to);
  assertEquals(draft!.contributingUnderstandingIds, ['understanding-abc', 'understanding-xyz']);
});

Deno.test('buildCrossDomainDraft: provenance — the learning-since anchor is the earlier of the two contributors, and evidence count is the honest sum, never invented', () => {
  const from = understanding({ domain: 'sleep', strength: 'strong', learningSince: '2026-07-01', observationsCount: 30 });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'strong', learningSince: '2026-05-15', observationsCount: 45 });
  const draft = buildCrossDomainDraft(relationship(), from, to);
  assertEquals(draft!.learningSinceAnchor, '2026-05-15');
  assertEquals(draft!.observationsCount, 75);
});

Deno.test('buildCrossDomainDraft: a missing learning-since on one side falls back to the other, never to a fabricated date', () => {
  const from = understanding({ domain: 'sleep', strength: 'strong', learningSince: null });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'strong', learningSince: '2026-05-15' });
  const draft = buildCrossDomainDraft(relationship(), from, to);
  assertEquals(draft!.learningSinceAnchor, '2026-05-15');
});

Deno.test('buildCrossDomainDraft: cycle always names the pattern, keeping the existing ob-gyn routing available to the caller, regardless of pair order', () => {
  const cycle = understanding({ id: 'u-cycle', domain: 'cycle', strength: 'strong' });
  const mood = understanding({ id: 'u-mood', domain: 'mood', strength: 'strong' });
  const draft = buildCrossDomainDraft(relationship({ fromDomain: 'cycle', toDomain: 'mood' }), cycle, mood);
  assertEquals(draft!.primaryDomain, 'cycle');
  assertEquals(draft!.otherDomain, 'mood');
  assertEquals(draft!.label, 'cycle-related');
});

Deno.test('buildCrossDomainDraft: never fabricates a diagnosis or disease term in its own output', () => {
  const from = understanding({ domain: 'sleep', strength: 'very-strong' });
  const to = understanding({ id: 'u-2', domain: 'recovery', strength: 'very-strong' });
  const draft = buildCrossDomainDraft(relationship({ strength: 'very-strong' }), from, to);
  const forbidden = ['diagnos', 'disease', 'disorder', 'syndrome', 'risk of'];
  const text = (draft!.narrative + ' ' + draft!.label).toLowerCase();
  for (const word of forbidden) {
    assert(!text.includes(word), `output contained "${word}"`);
  }
});
