import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildContextualUnderstanding, mapConcernToDomain } from './contextualUnderstanding.ts';

Deno.test('mapConcernToDomain: maps classified health domains onto the five physiological domains', () => {
  assertEquals(mapConcernToDomain(['sleep']), 'sleep');
  assertEquals(mapConcernToDomain(['energy_recovery']), 'energy');
  assertEquals(mapConcernToDomain(['reproductive_hormonal']), 'cycle');
  assertEquals(mapConcernToDomain(['mental_emotional']), 'mood');
});

Deno.test('mapConcernToDomain: an unrecognized or empty classification falls through to recovery, not a guess', () => {
  assertEquals(mapConcernToDomain([]), 'recovery');
  assertEquals(mapConcernToDomain(['dermatological']), 'recovery');
});

Deno.test('mapConcernToDomain: the first matching domain wins when several were classified', () => {
  assertEquals(mapConcernToDomain(['dermatological', 'sleep']), 'sleep');
});

Deno.test('buildContextualUnderstanding: no concern text at all produces no Understanding', () => {
  assertEquals(
    buildContextualUnderstanding('energy', { concernAnswer: '', concernElaboration: null, recency: null }),
    null
  );
  assertEquals(
    buildContextualUnderstanding('energy', {
      concernAnswer: '   ',
      concernElaboration: null,
      recency: null,
    }),
    null
  );
});

Deno.test('buildContextualUnderstanding: a real concern produces an emerging-strength Understanding', () => {
  const draft = buildContextualUnderstanding('energy', {
    concernAnswer: "I'm not feeling like myself",
    concernElaboration: null,
    recency: null,
  });
  assert(draft !== null);
  assertEquals(draft!.strength, 'emerging');
  assert(draft!.narrative.includes('yourself'));
});

Deno.test('buildContextualUnderstanding: recency, when given, is woven into the narrative', () => {
  const draft = buildContextualUnderstanding('energy', {
    concernAnswer: 'Something has changed',
    concernElaboration: null,
    recency: 'A few weeks',
  });
  assert(draft!.narrative.includes('for a few weeks'));
});

Deno.test('buildContextualUnderstanding: free-text elaboration is quoted verbatim, never rewritten', () => {
  const draft = buildContextualUnderstanding('energy', {
    concernAnswer: 'Something has changed',
    concernElaboration: "I'm exhausted even after a full night's sleep.",
    recency: null,
  });
  assert(draft!.narrative.includes(`"I'm exhausted even after a full night's sleep."`));
});

Deno.test('buildContextualUnderstanding: always names still-learning honestly — no health data yet', () => {
  const draft = buildContextualUnderstanding('cycle', {
    concernAnswer: "I'm managing a health condition",
    concernElaboration: null,
    recency: null,
  });
  assertEquals(draft!.stillLearning.length, 1);
  assert(draft!.stillLearning[0].toLowerCase().includes("don't yet have enough health data"));
});

Deno.test('buildContextualUnderstanding: emerging strength means the existing Guidance gate stays closed', () => {
  // Not a call into careGuidance.ts directly — a documentation-as-test
  // check that this module never claims a stronger tier than 'emerging',
  // since that tier is what keeps deriveGuidance() silent for these rows
  // without any special-casing there.
  const draft = buildContextualUnderstanding('mood', {
    concernAnswer: "I'm going through a life change",
    concernElaboration: null,
    recency: 'Just recently',
  });
  assertEquals(draft!.strength, 'emerging');
});
