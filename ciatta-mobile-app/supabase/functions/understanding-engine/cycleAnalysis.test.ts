import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  detectCycles,
  analyzeCycles,
  buildUnderstanding,
  strengthForConfidence,
  strengthForObservedPattern,
  type FlowObservation,
  type RhrObservation,
} from './cycleAnalysis.ts';

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
  noiseAmplitude: number;
  seed: number;
  rhrCoveragePerDay: boolean;
}): { flow: FlowObservation[]; rhr: RhrObservation[] } {
  const rand = seedRandom(opts.seed);
  const flow: FlowObservation[] = [];
  const rhr: RhrObservation[] = [];

  for (let i = 0; i < opts.cycleStarts.length; i++) {
    const start = opts.cycleStarts[i];
    const end = i + 1 < opts.cycleStarts.length ? opts.cycleStarts[i + 1] : addDays(start, 28);
    const lengthDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    for (let d = 0; d < 4; d++) {
      flow.push({ id: id(), recordedAt: addDays(start, d).toISOString(), cycleStart: d === 0 });
    }

    if (!opts.rhrCoveragePerDay) continue;
    for (let d = 0; d < lengthDays; d++) {
      const isLuteal = d >= lengthDays - 8;
      const noise = (rand() - 0.5) * 2 * opts.noiseAmplitude;
      const bpm = opts.baselineBpm + (isLuteal ? opts.lutealElevation : 0) + noise;
      rhr.push({ id: id(), recordedAt: addDays(start, d).toISOString(), bpm });
    }
  }

  return { flow, rhr };
}

const cycleStarts5 = [
  new Date('2025-08-01'),
  new Date('2025-08-29'),
  new Date('2025-09-26'),
  new Date('2025-10-24'),
  new Date('2025-11-21'),
];

Deno.test('cycleAnalysis: real luteal-phase RHR elevation is detected across 4 cycles', () => {
  nextId = 1;
  const { flow, rhr } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    noiseAmplitude: 0.8,
    seed: 42,
    rhrCoveragePerDay: true,
  });
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);
  const understanding = buildUnderstanding(result);

  assertEquals(cycles.length, 4);
  assertEquals(result.cyclesWithSufficientData, 4);
  assertEquals(result.cyclesConfirming, 4);
  assertEquals(result.eligible, true);
  assert(result.avgDeltaBpm !== null && result.avgDeltaBpm > 1.0 && result.avgDeltaBpm < 3.0);
  assertEquals(strengthForConfidence(result.confidence), 'strong');
  assert(understanding !== null);
  assert(understanding!.narrative.includes('bpm higher'));
});

Deno.test('cycleAnalysis: no real pattern produces no claim, even with full data coverage', () => {
  nextId = 1;
  const { flow, rhr } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 0,
    noiseAmplitude: 0.8,
    seed: 7,
    rhrCoveragePerDay: true,
  });
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);

  assertEquals(result.cyclesConfirming, 0);
  assertEquals(result.eligible, false);
  assertEquals(buildUnderstanding(result), null);
});

Deno.test('cycleAnalysis: cold-start gate blocks even a strong real pattern at 2 cycles', () => {
  nextId = 1;
  const { flow, rhr } = buildScenario({
    cycleStarts: [new Date('2025-08-01'), new Date('2025-08-29'), new Date('2025-09-26')],
    baselineBpm: 58,
    lutealElevation: 2.5,
    noiseAmplitude: 0.8,
    seed: 99,
    rhrCoveragePerDay: true,
  });
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);

  assertEquals(cycles.length, 2);
  // The pattern is real and even confirms every cycle, but there aren't
  // enough cycles yet — the gate must win regardless of pattern strength.
  assertEquals(result.cyclesConfirming, 2);
  assertEquals(result.eligible, false);
  assertEquals(result.confidence, 0);
});

Deno.test('cycleAnalysis: zero RHR data never crashes and is never eligible', () => {
  nextId = 1;
  const { flow, rhr } = buildScenario({
    cycleStarts: cycleStarts5,
    baselineBpm: 60,
    lutealElevation: 2,
    noiseAmplitude: 0.8,
    seed: 3,
    rhrCoveragePerDay: false,
  });
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);

  assertEquals(result.cyclesWithSufficientData, 0);
  assertEquals(result.eligible, false);
  assertEquals(buildUnderstanding(result), null);
});

Deno.test('cycleAnalysis: an implausible tracking-gap "cycle" is excluded, not misclassified', () => {
  nextId = 1;
  const { flow, rhr } = buildScenario({
    cycleStarts: [
      new Date('2025-08-01'),
      new Date('2025-08-29'),
      // ~4.5 month gap in logging here
      new Date('2026-01-15'),
      new Date('2026-02-12'),
      new Date('2026-03-12'),
    ],
    baselineBpm: 60,
    lutealElevation: 2,
    noiseAmplitude: 0.8,
    seed: 11,
    rhrCoveragePerDay: true,
  });
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);

  // 4 period starts would normally make 3 cycles here, but the ~168-day
  // gap must be dropped as implausible rather than treated as a real
  // (absurdly long) cycle.
  assertEquals(cycles.length, 3);
  assert(cycles.every((c) => c.lengthDays >= 18 && c.lengthDays <= 60));
  assertEquals(result.eligible, true);
});

Deno.test('strengthForConfidence: tiers are monotonic and match the documented thresholds', () => {
  assertEquals(strengthForConfidence(0), 'emerging');
  assertEquals(strengthForConfidence(0.29), 'emerging');
  assertEquals(strengthForConfidence(0.3), 'moderate');
  assertEquals(strengthForConfidence(0.59), 'moderate');
  assertEquals(strengthForConfidence(0.6), 'strong');
  assertEquals(strengthForConfidence(0.84), 'strong');
  assertEquals(strengthForConfidence(0.85), 'very-strong');
  assertEquals(strengthForConfidence(1), 'very-strong');
});

Deno.test('strengthForObservedPattern: sample size alone never produces very-strong', () => {
  assertEquals(strengthForObservedPattern(1, 0), 'moderate');
  assertEquals(strengthForObservedPattern(0.9, 0.04), 'moderate');
  assertEquals(strengthForObservedPattern(0.9, 0.1), 'strong');
  assertEquals(strengthForObservedPattern(0.9, 0.2), 'very-strong');
  assertEquals(strengthForObservedPattern(0.5, 0.4), 'moderate');
});
