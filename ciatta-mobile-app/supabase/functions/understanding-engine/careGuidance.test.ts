import { assert, assertEquals } from 'jsr:@std/assert@1';
import { deriveGuidance, durationPhrase, type EvidenceContext } from './careGuidance.ts';

// A fixed "now" so every test's duration bucket is deterministic — real
// production code defaults `now` to the actual current time; only tests
// ever override it.
const NOW = new Date('2026-08-19T00:00:00Z');

const EVIDENCE_3_WEEKS: EvidenceContext = { observationsCount: 42, learningSince: '2026-07-29' };
const NO_EVIDENCE: EvidenceContext = { observationsCount: 0, learningSince: null };

Deno.test('deriveGuidance: emerging and moderate understandings get no guidance at all', () => {
  assertEquals(deriveGuidance('sleep', 'emerging', null, EVIDENCE_3_WEEKS, NOW), {
    guidance: null,
    careRecommendationType: null,
    careRecommendationReason: null,
  });
  assertEquals(deriveGuidance('sleep', 'moderate', null, EVIDENCE_3_WEEKS, NOW), {
    guidance: null,
    careRecommendationType: null,
    careRecommendationReason: null,
  });
});

Deno.test('deriveGuidance: strong and very-strong both produce guidance', () => {
  const strong = deriveGuidance('sleep', 'strong', null, EVIDENCE_3_WEEKS, NOW);
  const veryStrong = deriveGuidance('sleep', 'very-strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(strong.guidance !== null);
  assert(veryStrong.guidance !== null);
});

Deno.test('deriveGuidance: domain-specific defaults are ob-gyn for cycle, mental-health for mood, primary-care otherwise', () => {
  assertEquals(deriveGuidance('cycle', 'strong', null, EVIDENCE_3_WEEKS, NOW).careRecommendationType, 'ob-gyn');
  assertEquals(deriveGuidance('mood', 'strong', null, EVIDENCE_3_WEEKS, NOW).careRecommendationType, 'mental-health');
  assertEquals(deriveGuidance('sleep', 'strong', null, EVIDENCE_3_WEEKS, NOW).careRecommendationType, 'primary-care');
  assertEquals(deriveGuidance('recovery', 'strong', null, EVIDENCE_3_WEEKS, NOW).careRecommendationType, 'primary-care');
  assertEquals(deriveGuidance('energy', 'strong', null, EVIDENCE_3_WEEKS, NOW).careRecommendationType, 'primary-care');
});

Deno.test('deriveGuidance: the recommended provider type and the guidance sentence never disagree', () => {
  const cycle = deriveGuidance('cycle', 'very-strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(cycle.guidance!.includes('OB/GYN'));
  const mood = deriveGuidance('mood', 'very-strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(mood.guidance!.includes('mental health provider'));
  const sleep = deriveGuidance('sleep', 'very-strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(sleep.guidance!.includes('primary care provider'));
});

Deno.test('deriveGuidance: names a connected domain when one is already represented in the model', () => {
  const withConnection = deriveGuidance('sleep', 'strong', 'mood', EVIDENCE_3_WEEKS, NOW);
  assert(withConnection.guidance!.includes('appears connected to your mood'));

  const withoutConnection = deriveGuidance('sleep', 'strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(!withoutConnection.guidance!.includes('appears connected'));
  assert(withoutConnection.guidance!.includes('consistent pattern'));
});

Deno.test('deriveGuidance: never diagnoses — output is limited to the enumerated sentences, nothing free-text', () => {
  const forbidden = ['diagnos', 'you have', 'you need treatment', 'stop taking', 'you should start'];
  for (const strength of ['emerging', 'moderate', 'strong', 'very-strong']) {
    for (const domain of ['sleep', 'recovery', 'energy', 'cycle', 'mood']) {
      const result = deriveGuidance(domain, strength, null, EVIDENCE_3_WEEKS, NOW);
      if (!result.guidance) continue;
      const lower = result.guidance.toLowerCase();
      for (const word of forbidden) {
        assert(!lower.includes(word), `guidance for ${domain}/${strength} contained "${word}"`);
      }
    }
  }
});

// --- New: the three-question structure (WHY / CONSIDER / CARE) ---

Deno.test('deriveGuidance: opens with why Ciatta believes this, derived from the evidence passed in', () => {
  const result = deriveGuidance('sleep', 'strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(result.guidance!.startsWith('Ciatta has been learning from your sleep patterns'));
  // 2026-07-29 -> 2026-08-19 is 21 days, which durationPhrase buckets as "several weeks".
  assert(result.guidance!.includes('over the past several weeks'));
});

Deno.test('deriveGuidance: falls back to observation count, never a bare domain name, when there is no anchor date', () => {
  const result = deriveGuidance('sleep', 'strong', null, { observationsCount: 12, learningSince: null }, NOW);
  assert(result.guidance!.startsWith('Ciatta has been learning from your sleep patterns across 12 observations.'));
});

Deno.test('deriveGuidance: falls back to a bare learning statement when there is neither a date nor a count', () => {
  const result = deriveGuidance('sleep', 'strong', null, NO_EVIDENCE, NOW);
  assert(result.guidance!.startsWith('Ciatta has been learning from your sleep patterns.'));
});

Deno.test('deriveGuidance: includes a closed-form, domain-specific consideration for every domain', () => {
  const expectPhrase: Record<string, string> = {
    sleep: 'keeping your sleep schedule consistent',
    recovery: 'prioritizing recovery',
    energy: 'pacing your activity',
    cycle: 'noting how this shows up across your cycle',
    mood: 'noticing what tends to precede these shifts',
  };
  for (const [domain, phrase] of Object.entries(expectPhrase)) {
    const result = deriveGuidance(domain, 'strong', null, EVIDENCE_3_WEEKS, NOW);
    assert(result.guidance!.includes('Consider'), `${domain} guidance missing a Consider clause`);
    assert(result.guidance!.includes(phrase), `${domain} guidance missing its own consideration`);
  }
});

Deno.test('deriveGuidance: still ends with the existing care sentence, unchanged in content', () => {
  const result = deriveGuidance('sleep', 'strong', null, EVIDENCE_3_WEEKS, NOW);
  assert(result.guidance!.includes('This is a consistent pattern in your sleep.'));
  assert(result.guidance!.includes('If it continues, it may be worth discussing with your primary care provider.'));
});

Deno.test('durationPhrase: buckets days into fixed, enumerated phrases', () => {
  assertEquals(durationPhrase(0), 'over the past several days');
  assertEquals(durationPhrase(6), 'over the past several days');
  assertEquals(durationPhrase(7), 'over the past couple of weeks');
  assertEquals(durationPhrase(20), 'over the past couple of weeks');
  assertEquals(durationPhrase(21), 'over the past several weeks');
  assertEquals(durationPhrase(59), 'over the past several weeks');
  assertEquals(durationPhrase(60), 'over the past couple of months');
  assertEquals(durationPhrase(179), 'over the past couple of months');
  assertEquals(durationPhrase(180), 'over the past several months');
});
