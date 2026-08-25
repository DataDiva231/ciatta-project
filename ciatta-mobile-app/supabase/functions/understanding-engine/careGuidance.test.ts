import { assert, assertEquals } from 'jsr:@std/assert@1';
import { deriveGuidance } from './careGuidance.ts';

Deno.test('deriveGuidance: emerging and moderate understandings get no guidance at all', () => {
  assertEquals(deriveGuidance('sleep', 'emerging', null), {
    guidance: null,
    careRecommendationType: null,
    careRecommendationReason: null,
  });
  assertEquals(deriveGuidance('sleep', 'moderate', null), {
    guidance: null,
    careRecommendationType: null,
    careRecommendationReason: null,
  });
});

Deno.test('deriveGuidance: strong and very-strong both produce guidance', () => {
  const strong = deriveGuidance('sleep', 'strong', null);
  const veryStrong = deriveGuidance('sleep', 'very-strong', null);
  assert(strong.guidance !== null);
  assert(veryStrong.guidance !== null);
});

Deno.test('deriveGuidance: domain-specific defaults are ob-gyn for cycle, mental-health for mood, primary-care otherwise', () => {
  assertEquals(deriveGuidance('cycle', 'strong', null).careRecommendationType, 'ob-gyn');
  assertEquals(deriveGuidance('mood', 'strong', null).careRecommendationType, 'mental-health');
  assertEquals(deriveGuidance('sleep', 'strong', null).careRecommendationType, 'primary-care');
  assertEquals(deriveGuidance('recovery', 'strong', null).careRecommendationType, 'primary-care');
  assertEquals(deriveGuidance('energy', 'strong', null).careRecommendationType, 'primary-care');
});

Deno.test('deriveGuidance: the recommended provider type and the guidance sentence never disagree', () => {
  const cycle = deriveGuidance('cycle', 'very-strong', null);
  assert(cycle.guidance!.includes('OB/GYN'));
  const mood = deriveGuidance('mood', 'very-strong', null);
  assert(mood.guidance!.includes('mental health provider'));
  const sleep = deriveGuidance('sleep', 'very-strong', null);
  assert(sleep.guidance!.includes('primary care provider'));
});

Deno.test('deriveGuidance: names a connected domain when one is already represented in the model', () => {
  const withConnection = deriveGuidance('sleep', 'strong', 'mood');
  assert(withConnection.guidance!.includes('appears connected to your mood'));

  const withoutConnection = deriveGuidance('sleep', 'strong', null);
  assert(!withoutConnection.guidance!.includes('appears connected'));
  assert(withoutConnection.guidance!.includes('consistent pattern'));
});

Deno.test('deriveGuidance: never diagnoses — output is limited to the enumerated sentences, nothing free-text', () => {
  const forbidden = ['diagnos', 'you have', 'you need treatment', 'stop taking', 'you should start'];
  for (const strength of ['emerging', 'moderate', 'strong', 'very-strong']) {
    for (const domain of ['sleep', 'recovery', 'energy', 'cycle', 'mood']) {
      const result = deriveGuidance(domain, strength, null);
      if (!result.guidance) continue;
      const lower = result.guidance.toLowerCase();
      for (const word of forbidden) {
        assert(!lower.includes(word), `guidance for ${domain}/${strength} contained "${word}"`);
      }
    }
  }
});
