import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  analyzeHrv,
  buildHrvUnderstanding,
  analyzeHrvRatingRelationship,
  buildHrvRatingDiscovery,
  filterToConsistentMetric,
  latestDayIsLowVsPersonalBaseline,
  LOW_HRV_RATIO,
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

// --- Signal-quality gate: SDNN (HealthKit) and RMSSD (Health Connect) are
// real, already-captured provenance (context.metric), not a synthetic
// score — see filterToConsistentMetric() in hrvAnalysis.ts. ---

function taggedDay(day: string, ms: number, metric: string | null): HrvObservation {
  return { id: id(), recordedAt: `${day}T08:00:00Z`, ms, metric };
}

Deno.test('filterToConsistentMetric: untagged observations pass through unchanged, single-metric too', () => {
  const untagged = Array.from({ length: 20 }, (_, i) =>
    taggedDay(`2025-06-${String(i + 1).padStart(2, '0')}`, 50, null)
  );
  assertEquals(filterToConsistentMetric(untagged), untagged);

  const allSdnn = Array.from({ length: 20 }, (_, i) =>
    taggedDay(`2025-06-${String(i + 1).padStart(2, '0')}`, 50, 'sdnn')
  );
  assertEquals(filterToConsistentMetric(allSdnn), allSdnn);
});

Deno.test('filterToConsistentMetric: a mix of two tagged metrics keeps only the more-represented one', () => {
  const sdnnDays = Array.from({ length: 15 }, (_, i) =>
    taggedDay(`2025-06-${String(i + 1).padStart(2, '0')}`, 50, 'sdnn')
  );
  const rmssdDays = Array.from({ length: 5 }, (_, i) =>
    taggedDay(`2025-07-${String(i + 1).padStart(2, '0')}`, 50, 'rmssd')
  );
  const result = filterToConsistentMetric([...sdnnDays, ...rmssdDays]);
  assertEquals(result.length, 15);
  assert(result.every((o) => o.metric === 'sdnn'));
});

Deno.test('filterToConsistentMetric: untagged observations are never excluded, even alongside a tagged mix', () => {
  const sdnnDays = Array.from({ length: 10 }, (_, i) =>
    taggedDay(`2025-06-${String(i + 1).padStart(2, '0')}`, 50, 'sdnn')
  );
  const rmssdDays = Array.from({ length: 3 }, (_, i) =>
    taggedDay(`2025-07-${String(i + 1).padStart(2, '0')}`, 50, 'rmssd')
  );
  const untaggedDays = Array.from({ length: 4 }, (_, i) =>
    taggedDay(`2025-08-${String(i + 1).padStart(2, '0')}`, 50, null)
  );
  const result = filterToConsistentMetric([...sdnnDays, ...rmssdDays, ...untaggedDays]);
  // The 10 dominant sdnn days plus all 4 untagged — the 3 minority rmssd
  // days are the only ones excluded.
  assertEquals(result.length, 14);
  assert(result.every((o) => o.metric !== 'rmssd'));
});

Deno.test('analyzeHrv: a mixed-metric account still reaches an Understanding from its dominant metric alone, provenance intact', () => {
  nextId = 1;
  const sdnnDays = Array.from({ length: 20 }, (_, i) =>
    taggedDay(`2025-06-${String(i + 1).padStart(2, '0')}`, 55, 'sdnn')
  );
  const rmssdDays = Array.from({ length: 6 }, (_, i) =>
    taggedDay(`2025-07-${String(i + 1).padStart(2, '0')}`, 20, 'rmssd')
  );
  const result = analyzeHrv([...sdnnDays, ...rmssdDays]);
  assertEquals(result.eligible, true);
  assertEquals(result.totalDays, 20);
  // The excluded RMSSD days' ids must not appear in provenance — they were
  // never part of what produced this Understanding.
  const rmssdIds = new Set(rmssdDays.map((o) => o.id));
  assert(result.observationIds.every((oid) => !rmssdIds.has(oid)));
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

Deno.test('latestDayIsLowVsPersonalBaseline: uses the same 14-day personal median and 30% band as analyzeHrv — not a pairwise sample delta', () => {
  nextId = 1;
  const start = new Date('2025-06-01T12:00:00Z');
  const hrv: HrvObservation[] = [];
  for (let i = 0; i < 14; i++) {
    hrv.push({
      id: id(),
      recordedAt: addDays(start, i).toISOString(),
      ms: 50,
    });
  }
  assertEquals(latestDayIsLowVsPersonalBaseline(hrv), false);

  hrv.push({
    id: id(),
    recordedAt: addDays(start, 14).toISOString(),
    ms: 50 * LOW_HRV_RATIO - 1,
  });
  assertEquals(latestDayIsLowVsPersonalBaseline(hrv), true);
});

Deno.test('latestDayIsLowVsPersonalBaseline: a 10% sample-to-sample dip is not a real swing against the personal baseline', () => {
  nextId = 1;
  const start = new Date('2025-06-01T12:00:00Z');
  const hrv: HrvObservation[] = [];
  for (let i = 0; i < 14; i++) {
    hrv.push({ id: id(), recordedAt: addDays(start, i).toISOString(), ms: 50 });
  }
  hrv.push({ id: id(), recordedAt: addDays(start, 14).toISOString(), ms: 45 });
  assertEquals(latestDayIsLowVsPersonalBaseline(hrv), false);
});

Deno.test('latestDayIsLowVsPersonalBaseline: cold start (under 14 days) cannot declare a swing, even if the last reading is very low', () => {
  nextId = 1;
  const start = new Date('2025-06-01T12:00:00Z');
  const hrv: HrvObservation[] = [];
  for (let i = 0; i < 12; i++) {
    hrv.push({ id: id(), recordedAt: addDays(start, i).toISOString(), ms: 50 });
  }
  hrv.push({ id: id(), recordedAt: addDays(start, 12).toISOString(), ms: 20 });
  assertEquals(latestDayIsLowVsPersonalBaseline(hrv), false);
});

Deno.test('latestDayIsLowVsPersonalBaseline: sustained means the day average, so one noisy sample on an otherwise normal day is not a swing', () => {
  nextId = 1;
  const start = new Date('2025-06-01T12:00:00Z');
  const hrv: HrvObservation[] = [];
  for (let i = 0; i < 14; i++) {
    hrv.push({ id: id(), recordedAt: addDays(start, i).toISOString(), ms: 50 });
  }
  const lastDay = addDays(start, 14);
  hrv.push({ id: id(), recordedAt: lastDay.toISOString(), ms: 50 });
  hrv.push({
    id: id(),
    recordedAt: new Date(lastDay.getTime() + 60 * 60 * 1000).toISOString(),
    ms: 20,
  });
  // Day average (50+20)/2 = 35, which is exactly at the 30% band (35 === 50*0.7).
  // Low days are strictly below the band, same as analyzeHrv.
  assertEquals(latestDayIsLowVsPersonalBaseline(hrv), false);
});
