import { assertEquals } from 'jsr:@std/assert@1';
import { shouldRenderNativeGlass } from './liquidGlass.ts';

Deno.test('native glass only on iOS when APIs are present and transparency is allowed', () => {
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'ios',
      liquidAvailable: true,
      apiAvailable: true,
      reduceTransparency: false,
    }),
    true
  );
});

Deno.test('native glass is off on Android and web', () => {
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'android',
      liquidAvailable: true,
      apiAvailable: true,
      reduceTransparency: false,
    }),
    false
  );
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'web',
      liquidAvailable: true,
      apiAvailable: true,
      reduceTransparency: false,
    }),
    false
  );
});

Deno.test('native glass is off when Reduce Transparency is on', () => {
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'ios',
      liquidAvailable: true,
      apiAvailable: true,
      reduceTransparency: true,
    }),
    false
  );
});

Deno.test('native glass is off when the Liquid Glass API is missing', () => {
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'ios',
      liquidAvailable: true,
      apiAvailable: false,
      reduceTransparency: false,
    }),
    false
  );
  assertEquals(
    shouldRenderNativeGlass({
      platform: 'ios',
      liquidAvailable: false,
      apiAvailable: true,
      reduceTransparency: false,
    }),
    false
  );
});
