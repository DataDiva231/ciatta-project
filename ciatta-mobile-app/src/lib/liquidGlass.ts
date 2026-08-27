/**
 * When native Liquid Glass should render. Pure so Deno can test it without
 * loading React Native or expo-glass-effect.
 */
export function shouldRenderNativeGlass(opts: {
  platform: string;
  liquidAvailable: boolean;
  apiAvailable: boolean;
  reduceTransparency: boolean;
}): boolean {
  return (
    opts.platform === 'ios' &&
    opts.liquidAvailable &&
    opts.apiAvailable &&
    !opts.reduceTransparency
  );
}
