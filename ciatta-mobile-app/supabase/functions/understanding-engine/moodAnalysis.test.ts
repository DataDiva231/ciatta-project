import { assert, assertEquals } from 'jsr:@std/assert@1';
import { analyzeMood, buildMoodUnderstanding } from './moodAnalysis.ts';
import type { EnergyObservation } from './energyRelationship.ts';

let nextId = 1;
function id(): string {
  return `obs-${nextId++}`;
}
function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildScenario(opts: { count: number; lowRate: number; seed: number }): EnergyObservation[] {
  const rand = seedRandom(opts.seed);
  const obs: EnergyObservation[] = [];
  for (let i = 0; i < opts.count; i++) {
    const isLow = rand() < opts.lowRate;
    const rating = isLow ? 1 : 2 + Math.floor(rand() * 3);
    obs.push({ id: id(), recordedAt: new Date(2025, 5, i).toISOString(), rating });
  }
  return obs;
}

Deno.test('moodAnalysis: eligibility is sized by answer count, not calendar days', () => {
  nextId = 1;
  const obs = buildScenario({ count: 25, lowRate: 0.2, seed: 5 });
  const result = analyzeMood(obs);
  const understanding = buildMoodUnderstanding(result);

  assertEquals(result.totalAnswers, 25);
  assertEquals(result.eligible, true);
  assert(understanding !== null);
  assert(understanding!.narrative.includes('25 times'));
  assert(understanding!.narrative.includes('"Low"'));
});

Deno.test('moodAnalysis: cold start blocks the Understanding under 10 answers', () => {
  nextId = 1;
  const obs = buildScenario({ count: 6, lowRate: 0.3, seed: 3 });
  const result = analyzeMood(obs);
  assertEquals(result.eligible, false);
  assertEquals(buildMoodUnderstanding(result), null);
});

Deno.test('moodAnalysis: a user who never reports "Low" gets an honest 0% narrative, not silence', () => {
  nextId = 1;
  const obs = buildScenario({ count: 15, lowRate: 0, seed: 9 });
  const result = analyzeMood(obs);
  assertEquals(result.lowMoodCount, 0);
  assertEquals(result.eligible, true);
  const understanding = buildMoodUnderstanding(result);
  assert(understanding !== null);
  assert(understanding!.narrative.includes('0%'));
});

Deno.test('moodAnalysis: "Low" is rating === 1 specifically, not any bottom-half rating', () => {
  nextId = 1;
  // Ratings of 2 ("Okay") must never count as "Low" -- it's a distinct,
  // self-labeled option on the curiosity card, not a computed threshold.
  const obs: EnergyObservation[] = Array.from({ length: 12 }, (_, i) => ({
    id: id(),
    recordedAt: new Date(2025, 5, i).toISOString(),
    rating: 2,
  }));
  const result = analyzeMood(obs);
  assertEquals(result.lowMoodCount, 0);
});
