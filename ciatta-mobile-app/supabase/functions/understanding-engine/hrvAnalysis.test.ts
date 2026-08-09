import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  analyzeHrv,
  buildHrvUnderstanding,
  analyzeHrvRatingRelationship,
  buildHrvRatingDiscovery,
  type HrvObservation,
} from './hrvAnalysis.ts';
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
  numDays: number;
  baselineMs: number;
  lowRate: number;
  lowMs: number;
  samplesPerDay: number;
  ratingBaseline: number;
  ratingDropAfterLow: number;
  ratingAnswerRate: number;
  seed: number;
}): { hrv: HrvObservation[]; rating: EnergyObservation[] } {
  const rand = seedRandom(opts.seed);
  const start = new Date('2025-06-01T00:00:00Z');
  const hrv: HrvObservation[] = [];
  const rating: EnergyObservation[] = [];

  for (let i = 0; i < opts.numDays; i++) {
    const day = addDays(start, i);
    const isLow = rand() < opts.lowRate;
    const target = isLow ? opts.lowMs : opts.baselineMs;

    for (let s = 0; s < opts.samplesPerDay; s++) {
      const noise = (rand() - 0.5) * 2 * 3;
      hrv.push({
        id: id(),
        recordedAt: new Date(day.getTime() + (6 + s * 3) * 60 * 60 * 1000).toISOString(),
        ms: Math.max(1, target + noise),
      });
    }

    const nextDay = addDays(day, 1);
    if (rand() < opts.ratingAnswerRate) {
      const ratingNoise = (rand() - 0.5) * 2 * 0.3;
      let r = Math.round(opts.ratingBaseline - (isLow ? opts.ratingDropAfterLow : 0) + ratingNoise);
      r = Math.max(1, Math.min(4, r));
      rating.push({
        id: id(),
        recordedAt: new Date(nextDay.getTime() + 15 * 60 * 60 * 1000).toISOString(),
        rating: r,
      });
    }
  }

  return { hrv, rating };
}

Deno.test('hrvAnalysis: multi-reading days are averaged, not summed', () => {
  nextId = 1;
  const { hrv } = buildScenario({
    numDays: 40,
    baselineMs: 55,
    lowRate: 0.25,
    lowMs: 30,
    samplesPerDay: 3,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.1,
    ratingAnswerRate: 0.7,
    seed: 41,
  });
  const result = analyzeHrv(hrv);
  assertEquals(result.eligible, true);
  // If readings were wrongly summed instead of averaged, this would be
  // ~3x too large (multiple readings/day, each ~30-55ms).
  assert(result.avgMs > 20 && result.avgMs < 80);
});

Deno.test('hrvAnalysis: cold start blocks the Understanding under 14 days', () => {
  nextId = 1;
  const { hrv } = buildScenario({
    numDays: 9,
    baselineMs: 55,
    lowRate: 0.3,
    lowMs: 28,
    samplesPerDay: 2,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.2,
    ratingAnswerRate: 0.9,
    seed: 8,
  });
  const result = analyzeHrv(hrv);
  assertEquals(result.eligible, false);
  assertEquals(buildHrvUnderstanding(result), null);
});

Deno.test('hrvAnalysis: real low-HRV -> low-rating pattern is confirmed with enough days', () => {
  nextId = 1;
  const { hrv, rating } = buildScenario({
    numDays: 70,
    baselineMs: 55,
    lowRate: 0.35,
    lowMs: 30,
    samplesPerDay: 3,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.1,
    ratingAnswerRate: 0.7,
    seed: 41,
  });
  const relResult = analyzeHrvRatingRelationship(hrv, rating);
  const discovery = buildHrvRatingDiscovery(relResult, 'energy');
  assertEquals(relResult.eligible, true);
  assert(discovery !== null);
  assert(discovery!.narrative.toLowerCase().includes('hrv'));
});

Deno.test('hrvAnalysis: low-HRV days happen but rating is uncorrelated -> no discovery', () => {
  nextId = 1;
  const { hrv, rating } = buildScenario({
    numDays: 40,
    baselineMs: 55,
    lowRate: 0.25,
    lowMs: 30,
    samplesPerDay: 2,
    ratingBaseline: 3,
    ratingDropAfterLow: 0,
    ratingAnswerRate: 0.7,
    seed: 23,
  });
  const relResult = analyzeHrvRatingRelationship(hrv, rating);
  assertEquals(relResult.eligible, false);
  assertEquals(buildHrvRatingDiscovery(relResult, 'energy'), null);
});
