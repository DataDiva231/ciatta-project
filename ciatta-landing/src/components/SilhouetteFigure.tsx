/** Torso dot positions from ciatta-mobile-app BodySilhouette (426×586 figure). */
const DOTS = [
  { id: 'sleep', x: 37, y: 32, color: '#5B4B7A', delay: 0 },
  { id: 'recovery', x: 60, y: 38, color: '#6AA5CB', delay: 0.9 },
  { id: 'cycle', x: 40, y: 58, color: '#F27D72', delay: 1.8 },
  { id: 'energy', x: 63, y: 85, color: '#F6C76B', delay: 0.5 },
  { id: 'mood', x: 37, y: 85, color: '#181818', delay: 2.4 },
] as const;

// Every pair of signals, once — the figure's job is to show that these
// points are a connected picture, not five separate readouts, so the lines
// are drawn at rest and simply brighten around whichever one is active
// rather than appearing only on interaction.
const LINKS = DOTS.flatMap((a, i) => DOTS.slice(i + 1).map((b) => [a, b] as const));

type SilhouetteFigureProps = {
  activeId?: string;
  className?: string;
};

export function SilhouetteFigure({ activeId, className = '' }: SilhouetteFigureProps) {
  return (
    <div className={`silhouette-wrap ${className}`.trim()}>
      <div className="silhouette-art">
        <img
          src="/images/silhouette.png"
          alt="Body constellation showing sleep, recovery, cycle, energy and mood connected to one another"
          className="silhouette-img"
          width={426}
          height={586}
        />
        <svg
          className="silhouette-links"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {LINKS.map(([a, b]) => (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={
                activeId === a.id || activeId === b.id ? 'silhouette-link is-active' : 'silhouette-link'
              }
            />
          ))}
        </svg>
        <div className="silhouette-dots" aria-hidden="true">
          {DOTS.map((dot) => (
            <span
              key={dot.id}
              className={activeId === dot.id ? 'silhouette-dot is-focal' : 'silhouette-dot'}
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                '--dot-color': dot.color,
                '--dot-delay': `${dot.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
