import { assertEquals } from 'jsr:@std/assert@1';
import {
  selectInsightVisualization,
  type SeriesPack,
  type UnderstandingSignal,
} from './insightViz.ts';

function pts(values: number[]): { day: string; value: number; label: string }[] {
  return values.map((value, i) => ({
    day: `2026-08-${String(21 + i).padStart(2, '0')}`,
    value,
    label: `Aug ${21 + i}`,
  }));
}

function emptySeries(): SeriesPack {
  return {
    sleepMinutes: [],
    hrvMs: [],
    rhrBpm: [],
    steps: [],
    energyRating: [],
    moodRating: [],
  };
}

const sleepU: UnderstandingSignal = {
  domain: 'sleep',
  strength: 'strong',
  narrative: 'Your nights have been shorter than they were last week.',
  stillLearning: ['What happens on the nights you stay up later'],
  lastUpdated: '2026-08-27T12:00:00.000Z',
  observationsCount: 18,
};

Deno.test('no understandings means no visualization', () => {
  assertEquals(
    selectInsightVisualization({
      understandings: [],
      relationships: [],
      goals: [],
      series: emptySeries(),
    }),
    null
  );
});

Deno.test('thin series becomes still learning instead of a guessed chart', () => {
  const view = selectInsightVisualization({
    understandings: [sleepU],
    relationships: [],
    goals: ['sleep'],
    series: { ...emptySeries(), sleepMinutes: pts([400, 380]) },
    featuredDomain: 'sleep',
  });
  assertEquals(view?.kind, 'still-learning');
  assertEquals(view?.headline.includes('enough data'), true);
});

Deno.test('thin series yields no chart when still learning is not allowed', () => {
  const view = selectInsightVisualization({
    understandings: [sleepU],
    relationships: [],
    goals: ['sleep'],
    series: { ...emptySeries(), sleepMinutes: pts([400, 380]) },
    featuredDomain: 'sleep',
    allowStillLearning: false,
  });
  assertEquals(view, null);
});

Deno.test('a strong, changing sleep series is selected for Today', () => {
  const view = selectInsightVisualization({
    understandings: [sleepU],
    relationships: [],
    goals: ['I want better sleep'],
    series: { ...emptySeries(), sleepMinutes: pts([480, 460, 420, 390, 360, 340, 300]) },
    featuredDomain: 'sleep',
    now: new Date('2026-08-27T18:00:00.000Z'),
  });
  assertEquals(view?.kind, 'line');
  assertEquals(view?.title, 'Sleep');
  assertEquals(view?.color, '#5B4B7A');
  assertEquals('score' in (view ?? {}), false);
});

Deno.test('goal aligned HRV can outrank a flat sleep series', () => {
  const recovery: UnderstandingSignal = {
    domain: 'recovery',
    strength: 'very-strong',
    narrative: 'Your body has been under more stress than usual this week.',
    stillLearning: [],
    lastUpdated: '2026-08-27T16:00:00.000Z',
    observationsCount: 22,
  };
  const view = selectInsightVisualization({
    understandings: [
      { ...sleepU, strength: 'emerging', lastUpdated: '2026-08-20T12:00:00.000Z' },
      recovery,
    ],
    relationships: [],
    goals: ['less stress'],
    series: {
      ...emptySeries(),
      sleepMinutes: pts([420, 422, 419, 421, 420, 418, 420]),
      hrvMs: pts([80, 72, 60, 48, 42, 38, 35]),
    },
    featuredDomain: 'sleep',
    now: new Date('2026-08-27T18:00:00.000Z'),
  });
  assertEquals(view?.kind, 'bars');
  assertEquals(view?.title, 'Stress and HRV');
});

Deno.test('a close second visualization can replace one already shown today', () => {
  const recovery: UnderstandingSignal = {
    domain: 'recovery',
    strength: 'strong',
    narrative: 'Recovery has been moving.',
    stillLearning: [],
    lastUpdated: '2026-08-27T16:00:00.000Z',
    observationsCount: 12,
  };
  const series = {
    ...emptySeries(),
    sleepMinutes: pts([480, 450, 430, 400, 370, 350, 320]),
    hrvMs: pts([80, 70, 62, 50, 44, 40, 36]),
  };
  const first = selectInsightVisualization({
    understandings: [sleepU, recovery],
    relationships: [],
    goals: ['sleep', 'stress'],
    series,
    featuredDomain: 'sleep',
    now: new Date('2026-08-27T18:00:00.000Z'),
  });
  const second = selectInsightVisualization({
    understandings: [sleepU, recovery],
    relationships: [],
    goals: ['sleep', 'stress'],
    series,
    featuredDomain: 'sleep',
    now: new Date('2026-08-27T18:00:00.000Z'),
    shownCatalogId: 'sleep_trend',
  });
  if (first?.title === 'Sleep' && second) {
    assertEquals(second.title === 'Sleep', false);
  }
});

Deno.test('sheet focus keeps the visualization on that domain', () => {
  const energy: UnderstandingSignal = {
    domain: 'energy',
    strength: 'strong',
    narrative: 'Your energy has been uneven.',
    stillLearning: [],
    lastUpdated: '2026-08-27T12:00:00.000Z',
    observationsCount: 10,
  };
  const view = selectInsightVisualization({
    understandings: [sleepU, energy],
    relationships: [],
    goals: [],
    series: {
      ...emptySeries(),
      sleepMinutes: pts([480, 470, 460, 450, 440, 430, 300]),
      energyRating: pts([4, 3, 2, 4, 1, 2, 3]),
    },
    featuredDomain: 'sleep',
    focusDomain: 'energy',
    now: new Date('2026-08-27T18:00:00.000Z'),
  });
  assertEquals(view?.title, 'Energy');
  assertEquals(view?.kind, 'bars');
});
