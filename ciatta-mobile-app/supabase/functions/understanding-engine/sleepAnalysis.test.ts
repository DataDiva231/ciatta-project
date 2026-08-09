import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  analyzeSleep,
  buildSleepUnderstanding,
  analyzeSleepRatingRelationship,
  buildSleepRatingDiscovery,
  type SleepObservation,
} from './sleepAnalysis.ts';
import type { EnergyObservation } from './energyRelationship.ts';

let nextId = 1;
function id(): string {
  return `obs-${nextId++}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildScenario(opts: {
  numNights: number;
  baselineMinutes: number;
  shortNightRate: number;
  shortNightMinutes: number;
  ratingBaseline: number;
  ratingDropAfterShort: number;
  ratingAnswerRate: number;
  seed: number;
}): { sleep: SleepObservation[]; rating: EnergyObservation[] } {
  const rand = seedRandom(opts.seed);
  const start = new Date('2025-06-01T00:00:00Z');
  const sleep: SleepObservation[] = [];
  const rating: EnergyObservation[] = [];

  for (let i = 0; i < opts.numNights; i++) {
    const night = addDays(start, i);
    const isShort = rand() < opts.shortNightRate;
    const noise = (rand() - 0.5) * 2 * 20;
    const minutes = (isShort ? opts.shortNightMinutes : opts.baselineMinutes) + noise;

    const startTime = new Date(night.getTime() + 23 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);
    sleep.push({
      id: id(),
      type: 'sleep_session',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: minutes,
    });

    const nextDay = addDays(night, 1);
    if (rand() < opts.ratingAnswerRate) {
      const ratingNoise = (rand() - 0.5) * 2 * 0.3;
      let r = opts.ratingBaseline - (isShort ? opts.ratingDropAfterShort : 0) + ratingNoise;
      r = Math.max(1, Math.min(4, Math.round(r)));
      rating.push({
        id: id(),
        recordedAt: new Date(nextDay.getTime() + 15 * 60 * 60 * 1000).toISOString(),
        rating: r,
      });
    }
  }

  return { sleep, rating };
}

Deno.test('sleepAnalysis: real short-night pattern produces a descriptive Understanding', () => {
  nextId = 1;
  const { sleep } = buildScenario({
    numNights: 60,
    baselineMinutes: 450,
    shortNightRate: 0.3,
    shortNightMinutes: 340,
    ratingBaseline: 3,
    ratingDropAfterShort: 1.2,
    ratingAnswerRate: 0.7,
    seed: 21,
  });
  const result = analyzeSleep(sleep);
  const understanding = buildSleepUnderstanding(result);

  assertEquals(result.totalNights, 60);
  assertEquals(result.eligible, true);
  assert(result.avgMinutes > 350 && result.avgMinutes < 450);
  assert(understanding !== null);
  assert(understanding!.narrative.includes('average about'));
});

Deno.test('sleepAnalysis: cold start blocks the Understanding under 14 nights', () => {
  nextId = 1;
  const { sleep } = buildScenario({
    numNights: 10,
    baselineMinutes: 450,
    shortNightRate: 0.3,
    shortNightMinutes: 340,
    ratingBaseline: 3,
    ratingDropAfterShort: 1.2,
    ratingAnswerRate: 0.7,
    seed: 21,
  });
  const result = analyzeSleep(sleep);
  assertEquals(result.eligible, false);
  assertEquals(buildSleepUnderstanding(result), null);
});

Deno.test('sleepAnalysis: real short-sleep -> low-rating pattern is confirmed with enough paired days', () => {
  nextId = 1;
  const { sleep, rating } = buildScenario({
    numNights: 60,
    baselineMinutes: 450,
    shortNightRate: 0.3,
    shortNightMinutes: 340,
    ratingBaseline: 3,
    ratingDropAfterShort: 1.2,
    ratingAnswerRate: 0.7,
    seed: 21,
  });
  const relResult = analyzeSleepRatingRelationship(sleep, rating);
  const discovery = buildSleepRatingDiscovery(relResult, 'energy');

  assertEquals(relResult.eligible, true);
  assert(relResult.ratingDelta !== null && relResult.ratingDelta >= 0.5);
  assert(discovery !== null);
  assert(discovery!.narrative.includes("short night's sleep"));
});

Deno.test('sleepAnalysis: short nights happen but rating is uncorrelated -> no relationship claimed', () => {
  nextId = 1;
  const { sleep, rating } = buildScenario({
    numNights: 60,
    baselineMinutes: 450,
    shortNightRate: 0.3,
    shortNightMinutes: 340,
    ratingBaseline: 3,
    ratingDropAfterShort: 0,
    ratingAnswerRate: 0.7,
    seed: 13,
  });
  const relResult = analyzeSleepRatingRelationship(sleep, rating);

  assertEquals(relResult.eligible, false);
  assertEquals(buildSleepRatingDiscovery(relResult, 'energy'), null);
});

Deno.test('sleepAnalysis: sparse rating answers (5%) never satisfy the per-group minimum', () => {
  nextId = 1;
  const { sleep, rating } = buildScenario({
    numNights: 60,
    baselineMinutes: 450,
    shortNightRate: 0.3,
    shortNightMinutes: 340,
    ratingBaseline: 3,
    ratingDropAfterShort: 1.2,
    ratingAnswerRate: 0.05,
    seed: 9,
  });
  const relResult = analyzeSleepRatingRelationship(sleep, rating);
  assertEquals(relResult.eligible, false);
});
