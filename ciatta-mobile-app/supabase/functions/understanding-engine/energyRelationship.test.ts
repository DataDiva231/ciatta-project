import { assert, assertEquals } from 'jsr:@std/assert@1';
import { detectCycles, analyzeCycles, type FlowObservation, type RhrObservation } from './cycleAnalysis.ts';
import {
  analyzeCycleRatingRelationship,
  buildRelationship,
  buildCycleDiscovery,
  type EnergyObservation,
} from './energyRelationship.ts';

let nextId = 1;
function id(): string {
  return `obs-${nextId++}`;
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildScenario(opts: {
  cycleStarts: Date[];
  baselineBpm: number;
  lutealElevation: number;
  baselineRating: number;
  lutealRatingDrop: number;
  seed: number;
  ratingCoverage: boolean;
}): { flow: FlowObservation[]; rhr: RhrObservation[]; rating: EnergyObservation[] } {
  const rand = seedRandom(opts.seed);
  const flow: FlowObservation[] = [];
  const rhr: RhrObservation[] = [];
  const rating: EnergyObservation[] = [];

  for (let i = 0; i < opts.cycleStarts.length; i++) {
    const start = opts.cycleStarts[i];
    const end = i + 1 < opts.cycleStarts.length ? opts.cycleStarts[i + 1] : addDays(start, 28);
    const lengthDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    for (let d = 0; d < 4; d++) {
      flow.push({ id: id(), recordedAt: addDays(start, d).toISOString(), cycleStart: d === 0 });
    }

    for (let d = 0; d < lengthDays; d++) {
      const isLuteal = d >= lengthDays - 8;
      const hrNoise = (rand() - 0.5) * 2 * 0.8;
      rhr.push({
        id: id(),
        recordedAt: addDays(start, d).toISOString(),
        bpm: opts.baselineBpm + (isLuteal ? opts.lutealElevation : 0) + hrNoise,
      });

      if (opts.ratingCoverage && d % 3 === 0) {
        const ratingNoise = (rand() - 0.5) * 2 * 0.3;
        let r = opts.baselineRating - (isLuteal ? opts.lutealRatingDrop : 0) + ratingNoise;
        r = Math.max(1, Math.min(4, Math.round(r)));
        rating.push({ id: id(), recordedAt: addDays(start, d).toISOString(), rating: r });
      }
    }
  }

  return { flow, rhr, rating };
}

const cycleStarts5 = [
  new Date('2025-08-01'),
  new Date('2025-08-29'),
  new Date('2025-09-26'),
  new Date('2025-10-24'),
  new Date('2025-11-21'),
];

Deno.test('energyRelationship: real co-occurring RHR rise + rating drop produces a Relationship and Discovery', () => {
  nextId = 1;
  const { flow, rhr, rating } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    baselineRating: 3,
    lutealRatingDrop: 1.2,
    seed: 42,
    ratingCoverage: true,
  });
  const cycles = detectCycles(flow);
  const cycleResult = analyzeCycles(cycles, rhr);
  const relResult = analyzeCycleRatingRelationship(cycles, cycleResult.deltas, rating);
  const relationship = buildRelationship(relResult);
  const discovery = buildCycleDiscovery(relResult, 'energy');

  assertEquals(relResult.cyclesWithBothSignals, 4);
  assertEquals(relResult.cyclesCoOccurring, 4);
  assertEquals(relResult.eligible, true);
  assert(relationship !== null);
  assert(discovery !== null);
  assert(discovery!.narrative.includes('energy'));
  assertEquals(discovery!.suggestedNames.length, 3);
});

Deno.test('energyRelationship: mood target produces mood-specific copy, not energy copy', () => {
  nextId = 1;
  const { flow, rhr, rating } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    baselineRating: 3,
    lutealRatingDrop: 1.2,
    seed: 42,
    ratingCoverage: true,
  });
  const cycles = detectCycles(flow);
  const cycleResult = analyzeCycles(cycles, rhr);
  const relResult = analyzeCycleRatingRelationship(cycles, cycleResult.deltas, rating);
  const discovery = buildCycleDiscovery(relResult, 'mood');

  assert(discovery !== null);
  assert(discovery!.narrative.toLowerCase().includes('mood'));
  assert(!discovery!.narrative.toLowerCase().includes('energy'));
});

Deno.test('energyRelationship: RHR rises but rating is uncorrelated -> no relationship claimed', () => {
  nextId = 1;
  const { flow, rhr, rating } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    baselineRating: 3,
    lutealRatingDrop: 0,
    seed: 17,
    ratingCoverage: true,
  });
  const cycles = detectCycles(flow);
  const cycleResult = analyzeCycles(cycles, rhr);
  const relResult = analyzeCycleRatingRelationship(cycles, cycleResult.deltas, rating);

  assertEquals(relResult.cyclesCoOccurring, 0);
  assertEquals(relResult.eligible, false);
  assertEquals(buildRelationship(relResult), null);
  assertEquals(buildCycleDiscovery(relResult, 'energy'), null);
});

Deno.test('energyRelationship: zero rating data never crashes and is never eligible', () => {
  nextId = 1;
  const { flow, rhr, rating } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    baselineRating: 3,
    lutealRatingDrop: 1.2,
    seed: 8,
    ratingCoverage: false,
  });
  const cycles = detectCycles(flow);
  const cycleResult = analyzeCycles(cycles, rhr);
  const relResult = analyzeCycleRatingRelationship(cycles, cycleResult.deltas, rating);

  assertEquals(relResult.cyclesWithBothSignals, 0);
  assertEquals(relResult.eligible, false);
});

Deno.test('energyRelationship: cold-start gate blocks a real co-occurring pattern at 2 cycles', () => {
  nextId = 1;
  const { flow, rhr, rating } = buildScenario({
    cycleStarts: [new Date('2025-08-01'), new Date('2025-08-29'), new Date('2025-09-26')],
    baselineBpm: 60,
    lutealElevation: 2.5,
    baselineRating: 3,
    lutealRatingDrop: 1.3,
    seed: 5,
    ratingCoverage: true,
  });
  const cycles = detectCycles(flow);
  const cycleResult = analyzeCycles(cycles, rhr);
  const relResult = analyzeCycleRatingRelationship(cycles, cycleResult.deltas, rating);

  assertEquals(relResult.cyclesWithBothSignals, 2);
  assertEquals(relResult.cyclesCoOccurring, 2);
  assertEquals(relResult.eligible, false);
});
