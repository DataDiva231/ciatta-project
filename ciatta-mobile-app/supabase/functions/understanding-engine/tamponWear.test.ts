import { assertEquals } from 'jsr:@std/assert@1';
import { FDA_MAX_WEAR_MS } from './tamponWear.ts';

Deno.test('cycle processor folder can load tampon wear without a separate engine', () => {
  assertEquals(FDA_MAX_WEAR_MS, 8 * 60 * 60 * 1000);
});
