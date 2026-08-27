import type { Domain, Strength } from './types';

export interface ConstellationLink {
  from: Domain;
  to: Domain;
  strength: Strength;
}

const STRENGTH_RANK: Record<Strength, number> = {
  emerging: 0,
  moderate: 1,
  strong: 2,
  'very-strong': 3,
};

/** Core radius of a constellation star, in the figure's rendered width. */
export function constellationDotRadius(width: number, strength: Strength, focal: boolean): number {
  const base =
    strength === 'very-strong'
      ? 0.014
      : strength === 'strong'
        ? 0.012
        : strength === 'moderate'
          ? 0.0105
          : 0.009;
  return Math.max(2.25, width * base * (focal ? 1.08 : 1));
}

/** Compact fade extent. Kept tight so the mark stays a heatpoint, not a halo. */
export function constellationGlowRadius(coreR: number): number {
  return coreR * 2.15;
}

export function constellationHaloOpacity(strength: Strength): number {
  return strength === 'very-strong'
    ? 0.22
    : strength === 'strong'
      ? 0.16
      : strength === 'moderate'
        ? 0.11
        : 0.07;
}

/** Slow, unsynced breath so every domain feels alive without pulsing together. */
export function constellationBreath(domain: Domain): { durationMs: number; phase: number } {
  const table: Record<Domain, { durationMs: number; phase: number }> = {
    sleep: { durationMs: 4600, phase: 0 },
    recovery: { durationMs: 5400, phase: 0.22 },
    cycle: { durationMs: 4900, phase: 0.47 },
    energy: { durationMs: 5800, phase: 0.13 },
    mood: { durationMs: 5200, phase: 0.68 },
  };
  return table[domain];
}

export function constellationLinkOpacity(strength: Strength): number {
  return strength === 'very-strong'
    ? 0.28
    : strength === 'strong'
      ? 0.2
      : strength === 'moderate'
        ? 0.14
        : 0.08;
}

/**
 * Undirected edges among domains that are currently visible. Duplicate
 * A→B / B→A rows collapse to the stronger of the two.
 */
export function uniqueConstellationLinks(
  links: ConstellationLink[],
  visible: ReadonlySet<Domain>
): ConstellationLink[] {
  const best = new Map<string, ConstellationLink>();
  for (const link of links) {
    if (link.from === link.to) continue;
    if (!visible.has(link.from) || !visible.has(link.to)) continue;
    const key = [link.from, link.to].sort().join(':');
    const existing = best.get(key);
    if (!existing || STRENGTH_RANK[link.strength] > STRENGTH_RANK[existing.strength]) {
      best.set(key, link);
    }
  }
  return [...best.values()];
}

/** Featured domain plus any learned neighbor it is already related to. */
export function todayConstellationDomains(
  featured: Domain | undefined,
  links: ConstellationLink[],
  learned: ReadonlySet<Domain>
): Domain[] {
  if (!featured) return [];
  const out = new Set<Domain>([featured]);
  for (const link of links) {
    const other =
      link.from === featured ? link.to : link.to === featured ? link.from : null;
    if (other && learned.has(other)) out.add(other);
  }
  return [...out];
}
