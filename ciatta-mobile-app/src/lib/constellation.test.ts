import { assertEquals } from 'jsr:@std/assert@1';
import {
  todayConstellationDomains,
  uniqueConstellationLinks,
} from './constellation.ts';

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
