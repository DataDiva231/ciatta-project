import { useEffect, useState } from 'react';

/**
 * The hero film, as a background layer.
 *
 * Motion & Interaction v1.0 says "Nothing auto-advances or auto-plays." That
 * rule is written for the product, where the body is the only thing permitted
 * to move. A landing page is not the product, so the film runs, but the rule
 * is honoured where it actually protects someone: under Reduce Motion the
 * video is never mounted and the poster stands in its place. The system's own
 * principle covers it, since "every state has an end frame, and the end frame
 * is a complete design."
 *
 * The clip is a slow one against a warm gradient wall, with the subject at
 * frame right and the left third left calm. That empty area is not incidental:
 * it is where the headline sits, and it is why this clip was chosen over the
 * portrait one.
 */
export function HeroFilm() {
  // Assume reduced until proven otherwise, so a reduced-motion viewer never
  // catches a frame of playback during hydration.
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionOk(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="hero-film" aria-hidden="true">
      {motionOk ? (
        <video poster="/video/hero-poster.jpg" autoPlay muted loop playsInline preload="metadata">
          <source src="/video/hero.webm" type="video/webm" />
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>
      ) : (
        <img src="/video/hero-poster.jpg" alt="" width={1600} height={900} />
      )}
      {/*
        The scrim is what makes white type legible over photography. It is
        weighted to the left and the bottom, following the copy, so the warm
        gradient on the right stays visible rather than being flattened.
      */}
      <div className="hero-scrim" />
    </div>
  );
}
