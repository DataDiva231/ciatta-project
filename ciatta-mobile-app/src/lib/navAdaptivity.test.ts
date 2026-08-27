import { assertEquals } from 'jsr:@std/assert@1';
import { nextNavCompact } from './navAdaptivity.ts';

Deno.test('nav stays expanded near the top of the screen', () => {
  assertEquals(
    nextNavCompact({ compact: true, offsetY: 4, deltaY: 20, reduceMotion: false }),
    false
  );
});

Deno.test('nav compacts when scrolling down past the top', () => {
  assertEquals(
    nextNavCompact({ compact: false, offsetY: 40, deltaY: 12, reduceMotion: false }),
    true
  );
});

Deno.test('nav expands when scrolling up', () => {
  assertEquals(
    nextNavCompact({ compact: true, offsetY: 80, deltaY: -12, reduceMotion: false }),
    false
  );
});

Deno.test('nav holds its state for small scroll jitter', () => {
  assertEquals(
    nextNavCompact({ compact: true, offsetY: 80, deltaY: 2, reduceMotion: false }),
    true
  );
  assertEquals(
    nextNavCompact({ compact: false, offsetY: 80, deltaY: -2, reduceMotion: false }),
    false
  );
});

Deno.test('reduce motion keeps the nav expanded', () => {
  assertEquals(
    nextNavCompact({ compact: false, offsetY: 80, deltaY: 20, reduceMotion: true }),
    false
  );
});
