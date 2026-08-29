import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  constellationBreath,
  constellationDotRadius,
  constellationGlowRadius,
  todayConstellationDomains,
  uniqueConstellationLinks,
} from './constellation.ts';
import type { Domain } from './types.ts';

Deno.test('uniqueConstellationLinks drops unseen domains and A/B duplicates', () => {
  const visible = new Set(['sleep', 'recovery', 'energy'] as const);
  const links = uniqueConstellationLinks(
    [
      { from: 'sleep', to: 'recovery', strength: 'moderate' },
      { from: 'recovery', to: 'sleep', strength: 'strong' },
      { from: 'sleep', to: 'mood', strength: 'very-strong' },
      { from: 'energy', to: 'energy', strength: 'strong' },
    ],
    visible
  );
  assertEquals(links.length, 1);
  assertEquals(links[0].strength, 'strong');
});

Deno.test('todayConstellationDomains is the featured star plus learned neighbors', () => {
  assertEquals(todayConstellationDomains(undefined, [], new Set()), []);
  assertEquals(
    todayConstellationDomains('sleep', [], new Set(['sleep'])).sort(),
    ['sleep']
  );
  const domains = todayConstellationDomains(
    'sleep',
    [
      { from: 'sleep', to: 'recovery', strength: 'strong' },
      { from: 'mood', to: 'cycle', strength: 'moderate' },
    ],
    new Set(['sleep', 'recovery', 'mood'])
  );
  assertEquals(domains.sort(), ['recovery', 'sleep']);
});

Deno.test('heatpoints stay compact relative to the older stacked halo', () => {
  const w = 264;
  const core = constellationDotRadius(w, 'moderate', false);
  const glow = constellationGlowRadius(core);
  assert(core < 3.2, `core ${core} should restore the smaller mark`);
  assert(glow < core * 3.1, `glow ${glow} must not reach the old outer halo`);
});

Deno.test('every domain has its own breath timing', () => {
  const domains: Domain[] = ['sleep', 'recovery', 'cycle', 'energy', 'mood'];
  const breaths = domains.map((d) => constellationBreath(d));
  const durations = new Set(breaths.map((b) => b.durationMs));
  const phases = new Set(breaths.map((b) => b.phase));
  assertEquals(durations.size, domains.length);
  assertEquals(phases.size, domains.length);
});
