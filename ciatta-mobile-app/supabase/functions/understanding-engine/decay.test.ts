import { assertEquals } from 'jsr:@std/assert@1';
import { nextDecayedState, STRENGTH_LADDER, CONFIDENCE_LABEL } from './decay.ts';

Deno.test('nextDecayedState: steps one rung toward emerging, never skipping a tier', () => {
  assertEquals(nextDecayedState('very-strong'), { strength: 'strong', confidenceLabel: 'confident' });
  assertEquals(nextDecayedState('strong'), { strength: 'moderate', confidenceLabel: 'fairly confident' });
  assertEquals(nextDecayedState('moderate'), { strength: 'emerging', confidenceLabel: 'still learning' });
});

Deno.test('nextDecayedState: emerging is the floor — nothing decays past it', () => {
  assertEquals(nextDecayedState('emerging'), null);
});

Deno.test('nextDecayedState: an unrecognized strength decays to nothing, rather than guessing', () => {
  assertEquals(nextDecayedState('not-a-real-strength'), null);
  assertEquals(nextDecayedState(''), null);
});

Deno.test('nextDecayedState: strength and confidence_label are never out of sync — the label always matches the returned strength\'s own entry in CONFIDENCE_LABEL', () => {
  for (const strength of STRENGTH_LADDER) {
    const result = nextDecayedState(strength);
    if (result === null) continue; // 'emerging', the floor
    assertEquals(result.confidenceLabel, CONFIDENCE_LABEL[result.strength]);
  }
});

Deno.test('nextDecayedState: the ladder only ever moves toward emerging, never back up', () => {
  let strength: string = 'very-strong';
  const visited: string[] = [strength];
  for (let i = 0; i < STRENGTH_LADDER.length; i++) {
    const result = nextDecayedState(strength);
    if (!result) break;
    visited.push(result.strength);
    strength = result.strength;
  }
  assertEquals(visited, ['very-strong', 'strong', 'moderate', 'emerging']);
});
