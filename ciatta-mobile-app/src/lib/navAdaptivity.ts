/**
 * Apple's tab bar minimizes while you scroll down and expands when you
 * return to the top or scroll up. Pure so Deno can test it without RN.
 */
export function nextNavCompact(opts: {
  compact: boolean;
  offsetY: number;
  deltaY: number;
  reduceMotion: boolean;
}): boolean {
  if (opts.reduceMotion) return false;
  if (opts.offsetY <= 12) return false;
  if (opts.deltaY > 8) return true;
  if (opts.deltaY < -8) return false;
  return opts.compact;
}
