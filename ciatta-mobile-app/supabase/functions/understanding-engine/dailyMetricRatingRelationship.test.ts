import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  median,
  analyzeDailyMetricRatingRelationship,
  buildDailyMetricRatingDiscovery,
  type DailyMetricDay,
} from './dailyMetricRatingRelationship.ts';
import type { RatingObservation } from './energyRelationship.ts';

Deno.test('median: even and odd length arrays', () => {
  assertEquals(median([1, 2, 3]), 2);
  assertEquals(median([1, 2, 3, 4]), 2.5);
  assertEquals(median([5]), 5);
});

const COPY = {
  lowDayLabel: 'test-low day',
  lowDayLabelPlural: 'test-low days',
  narrative: { energy: 'energy narrative', mood: 'mood narrative' },
  suggestedNames: { energy: ['E1', 'E2'], mood: ['M1', 'M2'] },
};

function dayMap(entries: [string, number][]): Map<string, DailyMetricDay> {
  const m = new Map<string, DailyMetricDay>();
  for (const [key, value] of entries) {
    m.set(key, { value, ids: [`obs-${key}`] });
  }
  return m;
}

Deno.test('dailyMetricRatingRelationship: confirms a real low-day -> low-rating pattern', () => {
  // 20 days: 6 "low" days (value 10) each followed by a low next-day
  // rating, 14 "normal" days (value 50) followed by a high rating.
  const days: [string, number][] = [];
  const ratings: RatingObservation[] = [];
  const start = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 20; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const isLow = i % 3 === 0; // ~7 low days
    days.push([key, isLow ? 10 : 50]);
    const nextDay = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    ratings.push({ id: `r-${i}`, recordedAt: `${nextDay}T12:00:00Z`, rating: isLow ? 1 : 4 });
  }

  const result = analyzeDailyMetricRatingRelationship(dayMap(days), ratings, 14, 0.5);
  assertEquals(result.eligible, true);
  assertEquals(result.confirms, true);
  assert(result.ratingDelta !== null && result.ratingDelta >= 0.5);

  const discovery = buildDailyMetricRatingDiscovery(result, COPY, 'energy');
  assert(discovery !== null);
  assertEquals(discovery!.narrative, 'energy narrative');
  assertEquals(discovery!.suggestedNames, ['E1', 'E2']);
});

Deno.test('dailyMetricRatingRelationship: no correlation -> not eligible, no discovery', () => {
  const days: [string, number][] = [];
  const ratings: RatingObservation[] = [];
  const start = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 20; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const isLow = i % 3 === 0;
    days.push([key, isLow ? 10 : 50]);
    const nextDay = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    // Rating alternates regardless of low/normal -- no real signal.
    ratings.push({ id: `r-${i}`, recordedAt: `${nextDay}T12:00:00Z`, rating: (i % 2) + 2 });
  }

  const result = analyzeDailyMetricRatingRelationship(dayMap(days), ratings, 14, 0.5);
  assertEquals(result.confirms, false);
  assertEquals(result.eligible, false);
  assertEquals(buildDailyMetricRatingDiscovery(result, COPY, 'energy'), null);
});

Deno.test('dailyMetricRatingRelationship: below minDaysForBaseline is never eligible', () => {
  const days = dayMap([
    ['2025-06-01', 10],
    ['2025-06-02', 50],
  ]);
  const result = analyzeDailyMetricRatingRelationship(days, [], 14, 0.5);
  assertEquals(result.eligible, false);
  assertEquals(result.daysWithBothSignals, 0);
});

Deno.test('dailyMetricRatingRelationship: fewer than 5 low days with ratings blocks eligibility even if normal days are plentiful', () => {
  const days: [string, number][] = [];
  const ratings: RatingObservation[] = [];
  const start = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 20; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    // Only 2 low days total in the whole window.
    const isLow = i === 2 || i === 10;
    days.push([key, isLow ? 10 : 50]);
    const nextDay = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    ratings.push({ id: `r-${i}`, recordedAt: `${nextDay}T12:00:00Z`, rating: isLow ? 1 : 4 });
  }

  const result = analyzeDailyMetricRatingRelationship(dayMap(days), ratings, 14, 0.5);
  assertEquals(result.lowDayCount, 2);
  assertEquals(result.eligible, false);
});

Deno.test('dailyMetricRatingRelationship: discovery copy is picked by toDomain, not hardcoded', () => {
  const days: [string, number][] = [];
  const ratings: RatingObservation[] = [];
  const start = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 20; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const isLow = i % 3 === 0;
    days.push([key, isLow ? 10 : 50]);
    const nextDay = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    ratings.push({ id: `r-${i}`, recordedAt: `${nextDay}T12:00:00Z`, rating: isLow ? 1 : 4 });
  }
  const result = analyzeDailyMetricRatingRelationship(dayMap(days), ratings, 14, 0.5);
  const moodDiscovery = buildDailyMetricRatingDiscovery(result, COPY, 'mood');
  assert(moodDiscovery !== null);
  assertEquals(moodDiscovery!.narrative, 'mood narrative');
  assertEquals(moodDiscovery!.suggestedNames, ['M1', 'M2']);
});
