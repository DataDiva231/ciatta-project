import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  analyzeSteps,
  buildStepsUnderstanding,
  analyzeStepsRatingRelationship,
  buildStepsRatingDiscovery,
  type StepsObservation,
} from './stepsAnalysis.ts';
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
  baselineSteps: number;
  lowActivityRate: number;
  lowActivitySteps: number;
  samplesPerDay: number;
  ratingBaseline: number;
  ratingDropAfterLow: number;
  ratingAnswerRate: number;
  seed: number;
}): { steps: StepsObservation[]; rating: EnergyObservation[] } {
  const rand = seedRandom(opts.seed);
  const start = new Date('2025-06-01T00:00:00Z');
  const steps: StepsObservation[] = [];
  const rating: EnergyObservation[] = [];

  for (let i = 0; i < opts.numDays; i++) {
    const day = addDays(start, i);
    const isLow = rand() < opts.lowActivityRate;
    const noise = (rand() - 0.5) * 2 * 500;
    const total = Math.max(0, (isLow ? opts.lowActivitySteps : opts.baselineSteps) + noise);

    let remaining = total;
    for (let s = 0; s < opts.samplesPerDay; s++) {
      const chunk = s === opts.samplesPerDay - 1 ? remaining : Math.round(total / opts.samplesPerDay);
      remaining -= chunk;
      steps.push({
        id: id(),
        recordedAt: new Date(day.getTime() + (8 + s * 4) * 60 * 60 * 1000).toISOString(),
        count: chunk,
      });
    }

    const nextDay = addDays(day, 1);
    if (rand() < opts.ratingAnswerRate) {
      const ratingNoise = (rand() - 0.5) * 2 * 0.3;
      let r = opts.ratingBaseline - (isLow ? opts.ratingDropAfterLow : 0) + ratingNoise;
      r = Math.max(1, Math.min(4, Math.round(r)));
      rating.push({
        id: id(),
        recordedAt: new Date(nextDay.getTime() + 15 * 60 * 60 * 1000).toISOString(),
        rating: r,
      });
    }
  }

  return { steps, rating };
}

Deno.test('stepsAnalysis: multi-sync-entry days are correctly summed per day', () => {
  nextId = 1;
  const { steps } = buildScenario({
    numDays: 40,
    baselineSteps: 7000,
    lowActivityRate: 0.25,
    lowActivitySteps: 2000,
    samplesPerDay: 3,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.2,
    ratingAnswerRate: 0.7,
    seed: 5,
  });
  const result = analyzeSteps(steps);
  assertEquals(result.totalDays, 40);
  assertEquals(result.eligible, true);
  // A single day's 3 chunks must recombine into a full-scale daily total,
  // not (for example) get counted as 3 separate low-magnitude "days."
  assert(result.avgSteps > 3000);
});

Deno.test('stepsAnalysis: low-activity threshold is relative to personal baseline, not absolute', () => {
  nextId = 1;
  // A consistently very-active person should show ~0% low-activity days
  // even though their "normal" pace would look extreme by another
  // person's standard.
  const { steps: activeSteps } = buildScenario({
    numDays: 30,
    baselineSteps: 12000,
    lowActivityRate: 0,
    lowActivitySteps: 12000,
    samplesPerDay: 1,
    ratingBaseline: 3,
    ratingDropAfterLow: 0,
    ratingAnswerRate: 0,
    seed: 9,
  });
  const activeResult = analyzeSteps(activeSteps);
  assertEquals(activeResult.lowActivityDays, 0);

  // A low-baseline (sedentary) person's *own* notably-low days must still
  // be detected relative to their own median, not judged against a fixed
  // step count.
  const { steps: sedentarySteps } = buildScenario({
    numDays: 30,
    baselineSteps: 2500,
    lowActivityRate: 0.3,
    lowActivitySteps: 800,
    samplesPerDay: 2,
    ratingBaseline: 3,
    ratingDropAfterLow: 0,
    ratingAnswerRate: 0,
    seed: 15,
  });
  const sedentaryResult = analyzeSteps(sedentarySteps);
  assert(sedentaryResult.lowActivityDays > 0);
});

Deno.test('stepsAnalysis: cold start blocks the Understanding under 14 days', () => {
  nextId = 1;
  const { steps } = buildScenario({
    numDays: 8,
    baselineSteps: 7000,
    lowActivityRate: 0.25,
    lowActivitySteps: 2000,
    samplesPerDay: 2,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.2,
    ratingAnswerRate: 0.9,
    seed: 3,
  });
  const result = analyzeSteps(steps);
  assertEquals(result.eligible, false);
  assertEquals(buildStepsUnderstanding(result), null);
});

Deno.test('stepsAnalysis: activity volume without notable low days is developing, never very-strong', () => {
  nextId = 1;
  const { steps } = buildScenario({
    numDays: 30,
    baselineSteps: 8000,
    lowActivityRate: 0,
    lowActivitySteps: 8000,
    samplesPerDay: 1,
    ratingBaseline: 3,
    ratingDropAfterLow: 0,
    ratingAnswerRate: 0,
    seed: 9,
  });
  const result = analyzeSteps(steps);
  const draft = buildStepsUnderstanding(result);
  assertEquals(result.eligible, true);
  assertEquals(result.lowActivityDays, 0);
  assert(draft !== null);
  assertEquals(draft!.strength, 'moderate');
  assertEquals(draft!.confidenceLabel, 'fairly confident');
  assert(!draft!.narrative.toLowerCase().includes('very strong'));
});

Deno.test('stepsAnalysis: real low-activity -> low-rating pattern is confirmed', () => {
  nextId = 1;
  const { steps, rating } = buildScenario({
    numDays: 50,
    baselineSteps: 7000,
    lowActivityRate: 0.3,
    lowActivitySteps: 2000,
    samplesPerDay: 1,
    ratingBaseline: 3,
    ratingDropAfterLow: 1.2,
    ratingAnswerRate: 0.7,
    seed: 21,
  });
  const relResult = analyzeStepsRatingRelationship(steps, rating);
  const discovery = buildStepsRatingDiscovery(relResult, 'energy');
  assertEquals(relResult.eligible, true);
  assert(discovery !== null);
  assert(discovery!.narrative.includes('low activity day'));
});

Deno.test('stepsAnalysis: low-activity days happen but rating is uncorrelated -> no discovery', () => {
  nextId = 1;
  const { steps, rating } = buildScenario({
    numDays: 50,
    baselineSteps: 7000,
    lowActivityRate: 0.3,
    lowActivitySteps: 2000,
    samplesPerDay: 1,
    ratingBaseline: 3,
    ratingDropAfterLow: 0,
    ratingAnswerRate: 0.7,
    seed: 13,
  });
  const relResult = analyzeStepsRatingRelationship(steps, rating);
  assertEquals(relResult.eligible, false);
  assertEquals(buildStepsRatingDiscovery(relResult, 'energy'), null);
});
