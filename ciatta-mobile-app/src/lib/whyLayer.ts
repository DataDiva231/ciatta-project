import { displayCopy } from './displayCopy';
import type { Domain, Strength } from './types';
import type { InsightViewModel } from './insightViz';

export type WhyPriority = {
  text: string;
  measured: boolean;
  consider?: string;
};

export type WhyUnderstanding = {
  id: string;
  domain: Domain;
  strength: Strength;
  narrative: string;
  still_learning: string[];
  last_updated: string;
  observations_count: number;
  confidence_label: string | null;
  learning_since: string | null;
  first_observed: string | null;
  guidance: string | null;
};

export type WhyRelationship = {
  from_domain: Domain;
  to_domain: Domain;
};

export type WhyCrossDomain = {
  from_domain: Domain;
  to_domain: Domain;
  narrative: string;
};

export type WhyHistory = {
  understanding_id: string;
  event_date: string;
  label: string;
};

const THIN_STRENGTH: Strength[] = ['emerging', 'moderate'];

export type WhyRelated = {
  domain: Domain;
  text: string;
};

export type WhyLayer = {
  mattering: string | null;
  evidence: string | null;
  related: WhyRelated[];
  watching: string | null;
  history: string[];
  primaryViz: InsightViewModel | null;
  supporting: InsightViewModel[];
};

export type WhyLayerInput = {
  featured: WhyUnderstanding;
  todayNarrative: string;
  todayPriority: WhyPriority | null;
  understandings: WhyUnderstanding[];
  relationships: WhyRelationship[];
  crossDomain: WhyCrossDomain[];
  history: WhyHistory[];
  candidates: InsightViewModel[];
  todayVizId?: string | null;
};

function norm(value: string): string {
  return displayCopy(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function overlaps(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function evidenceCopy(featured: WhyUnderstanding): string {
  const n = featured.observations_count ?? 0;
  const thin = n < 8 || THIN_STRENGTH.includes(featured.strength);
  if (n <= 0) {
    return displayCopy("There isn't a reading on this yet. Ciatta will look as more arrives.");
  }
  const readings = n === 1 ? '1 reading' : `${n} readings`;
  if (thin) {
    return displayCopy(
      `Ciatta has ${readings} to work with. That is not enough yet to see a clear pattern.`
    );
  }
  return displayCopy(`This is grounded in ${readings} Ciatta has already seen.`);
}

function watchingCopy(questions: string[]): string | null {
  const first = questions[0];
  if (!first) return null;
  const text = displayCopy(first);
  const alreadyASentence =
    /[.?!]$/.test(text) || /^(i |we |ciatta )/i.test(text);
  if (alreadyASentence) return text;
  return displayCopy(`Ciatta is watching for ${lowerFirst(text)}.`);
}

/**
 * Compose the Why layer from engine output already on the row.
 * Never invents a pattern. Never repeats the Today narrative.
 * Never surfaces internal metadata as the experience.
 */
export function composeWhyLayer(input: WhyLayerInput): WhyLayer {
  const { featured, todayNarrative, todayPriority } = input;
  const used = [todayNarrative, todayPriority?.text, todayPriority?.consider].filter(Boolean) as string[];

  const featuredHistory = (input.history ?? []).filter((h) => h.understanding_id === featured.id);
  const history = featuredHistory
    .map((h) => displayCopy(h.label))
    .filter((label) => label && !used.some((u) => overlaps(label, u)));

  const cross = input.crossDomain.find(
    (cd) => cd.from_domain === featured.domain || cd.to_domain === featured.domain
  );
  const neighbors = input.relationships
    .filter((r) => r.from_domain === featured.domain || r.to_domain === featured.domain)
    .map((r) => (r.from_domain === featured.domain ? r.to_domain : r.from_domain));

  const neighborCopy = neighbors
    .map((d) => input.understandings.find((u) => u.domain === d))
    .filter((u): u is WhyUnderstanding => !!u)
    .map((u) => ({ domain: u.domain, text: displayCopy(u.narrative) }))
    .filter((item) => !used.some((u) => overlaps(item.text, u)));

  let mattering: string | null = null;
  if (cross?.narrative && !used.some((u) => overlaps(cross.narrative, u))) {
    mattering = displayCopy(cross.narrative);
  } else if (history[0] && !overlaps(history[0], todayNarrative)) {
    mattering = history[0];
  } else if (featured.guidance && !used.some((u) => overlaps(featured.guidance, u))) {
    mattering = displayCopy(featured.guidance);
  }

  const related = neighborCopy.filter((item) => !overlaps(item.text, mattering));

  const leftoverQuestions = (featured.still_learning ?? []).filter(
    (q) => !used.some((u) => overlaps(q, u))
  );
  const watching = watchingCopy(leftoverQuestions);

  const vizPool = input.candidates.filter(
    (c) => c.kind !== 'still-learning' && c.id !== input.todayVizId
  );

  return {
    mattering,
    evidence: evidenceCopy(featured),
    related,
    watching,
    history,
    primaryViz: vizPool[0] ?? null,
    supporting: vizPool.slice(1, 3),
  };
}

export function whyAvailable(input: Omit<WhyLayerInput, 'candidates'>): boolean {
  const layer = composeWhyLayer({ ...input, candidates: [] });
  return !!(
    layer.mattering ||
    layer.related.length > 0 ||
    layer.watching ||
    layer.history.length > 0
  );
}
