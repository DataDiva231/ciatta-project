import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  coreStatusLabel,
  intelligenceSurfaces,
  presentPersistedUnderstanding,
  todayHeadline,
  type IntelligenceUnderstanding,
} from './intelligenceStatus.ts';
import { composeWhyLayer, whyAvailable } from './whyLayer.ts';
import { isEligibleCareConnection } from './careConnection.ts';

const recoveryVolume: IntelligenceUnderstanding = {
  id: 'u-recovery',
  domain: 'recovery',
  strength: 'moderate',
  narrative: 'You average about 8,412 steps a day. About 0% of your days are notably less active than that.',
  observations_count: 26,
  confidence_label: 'fairly confident',
  learning_since: '2026-07-01',
  first_observed: '2026-07-01',
  last_updated: '2026-08-28T12:00:00.000Z',
  still_learning: [],
  guidance:
    "We've been learning your recovery patterns over the past several weeks. Consider prioritizing recovery and easing up where you can and tracking whether the pattern continues.",
  care_recommendation_type: null,
  care_recommendation_reason: null,
};

Deno.test('Today, Core, and Why share one persisted status and cannot contradict it', () => {
  const surfaces = intelligenceSurfaces({
    featured: recoveryVolume,
    todayNarrative: recoveryVolume.narrative,
    todayPriority: null,
    understandings: [recoveryVolume],
    relationships: [],
    crossDomain: [],
    history: [
      {
        understanding_id: recoveryVolume.id,
        event_date: '2026-07-01',
        label: 'A pattern in how much you move day to day started to show.',
      },
    ],
    candidates: [],
  });

  assertEquals(surfaces.today.status, recoveryVolume.confidence_label);
  assertEquals(surfaces.core.status, recoveryVolume.confidence_label);
  assertEquals(surfaces.today.strength, recoveryVolume.strength);
  assertEquals(surfaces.core.strength, recoveryVolume.strength);
  assertEquals(surfaces.today.narrative, recoveryVolume.narrative);
  assertEquals(surfaces.today.status.includes('Very strong'), false);
  assertEquals(surfaces.core.status.includes('Very strong'), false);
  assertEquals(todayHeadline('Recovery', recoveryVolume.strength).includes('taking shape'), true);
});

Deno.test('Very strong only appears when persisted strength is very-strong', () => {
  assertEquals(coreStatusLabel({ strength: 'moderate', confidence_label: 'fairly confident' }).includes('Very strong'), false);
  assertEquals(coreStatusLabel({ strength: 'strong', confidence_label: 'confident' }).includes('Very strong'), false);
  const very = coreStatusLabel({ strength: 'very-strong', confidence_label: 'very confident' });
  assertEquals(very, 'very confident');
});

Deno.test('Why adds history and never repeats the Today narrative', () => {
  const historyLabel = 'A pattern in how much you move day to day started to show.';
  const layer = composeWhyLayer({
    featured: recoveryVolume,
    todayNarrative: recoveryVolume.narrative,
    todayPriority: null,
    understandings: [recoveryVolume],
    relationships: [],
    crossDomain: [],
    history: [
      { understanding_id: recoveryVolume.id, event_date: '2026-07-01', label: historyLabel },
    ],
    candidates: [],
  });
  assert(layer.mattering === historyLabel || layer.history.includes(historyLabel));
  assertEquals((layer.mattering ?? '').includes('8,412 steps'), false);
  assertEquals(layer.related.some((r) => r.text.includes('8,412 steps')), false);
  assertEquals((layer.watching ?? '').includes('8,412 steps'), false);
});

Deno.test('Why is available from history even when Today already holds the narrative', () => {
  assertEquals(
    whyAvailable({
      featured: recoveryVolume,
      todayNarrative: recoveryVolume.narrative,
      todayPriority: null,
      understandings: [recoveryVolume],
      relationships: [],
      crossDomain: [],
      history: [
        {
          understanding_id: recoveryVolume.id,
          event_date: '2026-07-01',
          label: 'A pattern in how much you move day to day started to show.',
        },
      ],
    }),
    true
  );
});

Deno.test('care connection stays off when recovery guidance has no clinical fields', () => {
  assertEquals(isEligibleCareConnection(recoveryVolume), false);
});

Deno.test('stale very-strong activity volume Recovery is presented as developing, without care', () => {
  const presented = presentPersistedUnderstanding({
    ...recoveryVolume,
    strength: 'very-strong' as const,
    confidence_label: 'very confident',
    guidance:
      "We've been learning your recovery patterns over the past several weeks. Consider prioritizing recovery and easing up where you can and tracking whether the pattern continues. This is a consistent pattern in your recovery. If it continues, it may be worth discussing with your primary care provider.",
    care_recommendation_type: 'primary-care',
    care_recommendation_reason: 'General or unexplained changes are usually best started with primary care.',
  });
  assertEquals(presented.strength, 'moderate');
  assertEquals(presented.confidence_label, 'fairly confident');
  assertEquals(presented.narrative.includes('8,412 steps'), true);
  assertEquals(presented.observations_count, 26);
  assertEquals(presented.care_recommendation_type, null);
  assertEquals(presented.care_recommendation_reason, null);
  assertEquals((presented.guidance ?? '').toLowerCase().includes('discussing'), false);
  assertEquals(isEligibleCareConnection(presented), false);

  const surfaces = intelligenceSurfaces({
    featured: presented,
    todayNarrative: presented.narrative,
    todayPriority: null,
    understandings: [presented],
    relationships: [],
    crossDomain: [],
    history: [
      {
        understanding_id: presented.id,
        event_date: '2026-07-01',
        label: 'A pattern in how much you move day to day started to show.',
      },
    ],
    candidates: [],
  });
  assertEquals(surfaces.today.status, 'fairly confident');
  assertEquals(surfaces.core.status, 'fairly confident');
  assertEquals(surfaces.today.status.includes('Very strong'), false);
});

Deno.test('presentPersistedUnderstanding does not throw on an empty narrative', () => {
  const presented = presentPersistedUnderstanding({
    ...recoveryVolume,
    narrative: '',
    confidence_label: null,
  });
  assertEquals(presented.confidence_label, 'fairly confident');
});
