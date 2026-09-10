/**
 * The Ciatta wordmark — Brand Brief / Constitution v2.0, §06 Logo.
 *
 * "A wordmark and nothing else. There is no symbol, no container, no icon and
 * no registered mark: the name, set once, correctly, is the entire identity."
 *
 * So this is type, not an image. The rules it has to hold:
 *
 *   Face      Jost, weight 500. Never lighter, never heavier, never italic.
 *   Case      All capitals, always. "Ciatta" in sentence case is body copy.
 *   Tracking  Widely tracked, and more so at small sizes. Never tightened.
 *   Grounds   Graphite or Paper only. Never a semantic colour, and semantic
 *             colour never sits behind it. Ember never enters the lockup.
 *   Space     Clear space on all four sides equals the cap height. Nothing
 *             enters it.
 *
 * The DOM text stays sentence case and CSS raises it, because a screen reader
 * given literal "CIATTA" may spell it out letter by letter. The mark is
 * uppercase to the eye and a word to the ear, which is what we want.
 *
 * Below the legible minimum the Constitution drops the wordmark for a single
 * Jost Medium C on Graphite — that is the app icon's job, not this page's, so
 * it is not implemented here.
 */

type WordmarkSize = 'sm' | 'md';

export function Wordmark({
  size = 'sm',
  className = '',
}: {
  size?: WordmarkSize;
  className?: string;
}) {
  return (
    <span className={`wordmark is-${size} ${className}`.trim()} aria-hidden="true">
      Ciatta
    </span>
  );
}
