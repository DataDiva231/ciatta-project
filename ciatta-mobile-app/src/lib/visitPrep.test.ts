// visitPrep.ts is plain, dependency-free TypeScript (no React Native
// imports), so it's runnable directly under Deno — this project has no
// client-side test runner (no jest/vitest configured for src/), and
// introducing one just for this file would be exactly the scope expansion
// the current task ruled out. Run with:
//   deno test src/lib/visitPrep.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildVisitBrief, type VisitBriefInput } from './visitPrep.ts';

const BASE_INPUT: VisitBriefInput = {
  domainLabel: 'Cycle',
  narrative: 'Your resting heart rate tends to run higher before your period.',
  confidenceLabel: 'confident',
  observationsCount: 42,
  learningSpan: '6 weeks',
  timelineSteps: [],
  stillLearning: [],
  guidance: 'This may be worth discussing with your OB/GYN.',
};

Deno.test('buildVisitBrief: with no provider selected, there is no "who you\'re seeing" section', () => {
  const brief = buildVisitBrief(BASE_INPUT);
  assert(!brief.includes("WHO YOU'RE SEEING"));
});

Deno.test('buildVisitBrief: a selected provider (from Provider Search) flows into its own section', () => {
  const brief = buildVisitBrief({
    ...BASE_INPUT,
    provider: {
      name: 'A Park Avenue OBGYN PC',
      specialty: 'Obstetrics & Gynecology, Gynecology',
      address: '36E 70TH ST, NEW YORK, NY, 10021',
      phone: '212-677-1000',
    },
  });
  assert(brief.includes("WHO YOU'RE SEEING"));
  assert(brief.includes('A Park Avenue OBGYN PC — Obstetrics & Gynecology, Gynecology'));
  assert(brief.includes('36E 70TH ST, NEW YORK, NY, 10021'));
  assert(brief.includes('212-677-1000'));
});

Deno.test('buildVisitBrief: the understanding, evidence, and guidance sections are always present regardless of provider selection', () => {
  const withProvider = buildVisitBrief({
    ...BASE_INPUT,
    provider: { name: 'Dr. Test', specialty: null, address: null, phone: null },
  });
  const withoutProvider = buildVisitBrief(BASE_INPUT);
  for (const brief of [withProvider, withoutProvider]) {
    assert(brief.includes('WHAT CIATTA UNDERSTANDS'));
    assert(brief.includes(BASE_INPUT.narrative));
    assert(brief.includes('EVIDENCE'));
    assert(brief.includes('WORTH DISCUSSING'));
    assert(brief.includes(BASE_INPUT.guidance!));
  }
});

Deno.test('buildVisitBrief: never claims a diagnosis, with or without a provider attached', () => {
  const brief = buildVisitBrief({
    ...BASE_INPUT,
    provider: { name: 'Dr. Test', specialty: 'OB/GYN', address: null, phone: null },
  });
  assert(brief.toLowerCase().includes('not a diagnosis'));
});

Deno.test('buildVisitBrief: a provider with only a name (no specialty/address/phone) still renders cleanly', () => {
  const brief = buildVisitBrief({
    ...BASE_INPUT,
    provider: { name: 'Dr. Test', specialty: null, address: null, phone: null },
  });
  assert(brief.includes('Dr. Test'));
  assert(!brief.includes('Dr. Test —')); // no dangling separator with nothing after it
});
