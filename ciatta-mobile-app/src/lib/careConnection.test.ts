// Deno-runnable: no React Native imports.
//   deno test --sloppy-imports src/lib/careConnection.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  careNoticeFor,
  CARE_YOU_ROWS,
  eligibleCareUnderstandings,
  isEligibleCareConnection,
  selectCareNotice,
  type CareUnderstanding,
} from './careConnection.ts';
import type { Domain, Strength } from './types.ts';

function row(
  partial: Partial<CareUnderstanding> & Pick<CareUnderstanding, 'domain' | 'strength'>
): CareUnderstanding {
  return {
    id: partial.id ?? `u-${partial.domain}`,
    narrative: partial.narrative ?? 'Your sleep has been running shorter than usual.',
    last_updated: partial.last_updated ?? '2026-08-01T00:00:00.000Z',
    guidance: partial.guidance === undefined ? null : partial.guidance,
    care_recommendation_type: partial.care_recommendation_type ?? null,
    care_recommendation_reason: partial.care_recommendation_reason ?? null,
    ...partial,
  };
}

Deno.test('ineligible: emerging/moderate, or strong without guidance, stay silent', () => {
  assertEquals(
    isEligibleCareConnection(row({ domain: 'sleep', strength: 'emerging', guidance: null })),
    false
  );
  assertEquals(
    isEligibleCareConnection(
      row({
        domain: 'sleep',
        strength: 'moderate',
        guidance: 'This may be worth discussing with a provider.',
      })
    ),
    false
  );
  assertEquals(
    isEligibleCareConnection(row({ domain: 'sleep', strength: 'strong', guidance: null })),
    false
  );
  assertEquals(selectCareNotice([row({ domain: 'mood', strength: 'emerging' })]), null);
});

Deno.test('eligible: strong and very-strong with existing Guidance surface a care notice', () => {
  const strong = row({
    domain: 'cycle',
    strength: 'strong',
    guidance: 'This may be worth discussing with your OB/GYN.',
    care_recommendation_reason: 'Patterns related to your cycle are usually best discussed with an OB/GYN.',
  });
  const very = row({
    domain: 'mood',
    strength: 'very-strong',
    guidance: 'This may be worth discussing with a mental health provider.',
    care_recommendation_type: 'mental-health',
    last_updated: '2026-08-20T00:00:00.000Z',
  });
  assertEquals(isEligibleCareConnection(strong), true);
  assertEquals(isEligibleCareConnection(very), true);

  const notice = careNoticeFor(strong);
  assertEquals(notice?.domain, 'cycle');
  assertEquals(notice?.noticed, strong.narrative);
  assertEquals(
    notice?.reason,
    'Patterns related to your cycle are usually best discussed with an OB/GYN.'
  );
  assert(!JSON.stringify(notice).includes('strong'));
  assert(!JSON.stringify(notice).includes('processor'));
  assert(!JSON.stringify(notice).includes('confident'));
});

Deno.test('complete flow: Today notice → prepare CTA names the Understanding; Core lists only eligible; You has a persistent care place', () => {
  const rows: CareUnderstanding[] = [
    row({
      domain: 'sleep' as Domain,
      strength: 'emerging' as Strength,
      last_updated: '2026-08-22T00:00:00.000Z',
      guidance: null,
    }),
    row({
      domain: 'cycle' as Domain,
      strength: 'strong' as Strength,
      last_updated: '2026-08-10T00:00:00.000Z',
      narrative: 'Your resting heart rate tends to run higher before your period.',
      guidance:
        "We've been learning this over the past couple of months. This may be worth discussing with your OB/GYN.",
      care_recommendation_reason: 'Patterns related to your cycle are usually best discussed with an OB/GYN.',
    }),
  ];

  const today = selectCareNotice(rows);
  assertEquals(today?.domain, 'cycle');
  assertEquals(today?.noticed.includes('resting heart rate'), true);
  assertEquals(today?.reason.includes('OB/GYN'), true);
  const prepareOpens: Domain = today!.domain;
  assertEquals(prepareOpens, 'cycle');

  const coreList = eligibleCareUnderstandings(rows);
  assertEquals(coreList.map((r) => r.domain), ['cycle']);
  assertEquals(coreList.some((r) => r.strength === 'emerging'), false);

  assertEquals(
    CARE_YOU_ROWS.map((r) => r.id),
    ['provider', 'visit-prep', 'shared']
  );
});

Deno.test('activity volume recovery with pattern guidance is not a care connection', () => {
  const recovery = row({
    domain: 'recovery',
    strength: 'strong',
    narrative: 'You average about 8,412 steps a day. About 0% of your days are notably less active than that.',
    guidance: "We've been learning your recovery patterns over the past several weeks. Consider prioritizing recovery and easing up where you can and tracking whether the pattern continues.",
    care_recommendation_type: null,
    care_recommendation_reason: null,
  });
  assertEquals(isEligibleCareConnection(recovery), false);
  assertEquals(selectCareNotice([recovery]), null);
  assertEquals(eligibleCareUnderstandings([recovery]), []);
});
