// Care Connection — client presentation of Guidance the Understanding
// Engine already wrote. Nothing here derives, thresholds, or second-guesses
// careGuidance.ts: eligibility is the same bar that module already used
// (strong / very-strong) PLUS a non-null `guidance` column, which is how
// the engine records "Ciatta has something worth discussing."
import type { Domain, Strength } from './types';
import { displayCopy } from './displayCopy';

const ACTIONABLE_STRENGTHS: ReadonlySet<Strength> = new Set(['strong', 'very-strong']);

export interface CareUnderstanding {
  id: string;
  domain: Domain;
  strength: Strength;
  narrative: string;
  last_updated: string;
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
}

export interface CareNotice {
  domain: Domain;
  /** What Ciatta noticed — the Understanding narrative, unchanged. */
  noticed: string;
  /** Brief why, from the engine's own care_recommendation_reason or Guidance. */
  reason: string;
}

export function isEligibleCareConnection(row: {
  strength: Strength;
  guidance: string | null;
  care_recommendation_type?: string | null;
  care_recommendation_reason?: string | null;
}): boolean {
  if (!ACTIONABLE_STRENGTHS.has(row.strength) || !row.guidance?.trim()) return false;
  return !!(row.care_recommendation_type?.trim() || row.care_recommendation_reason?.trim());
}

function briefReason(row: CareUnderstanding): string {
  const fromEngine = row.care_recommendation_reason?.trim();
  if (fromEngine) return fromEngine;
  const guidance = row.guidance?.trim() ?? '';
  const first = guidance.split(/(?<=\.)\s+/)[0];
  return first || guidance;
}

export function careNoticeFor(row: CareUnderstanding): CareNotice | null {
  if (!isEligibleCareConnection(row)) return null;
  return {
    domain: row.domain,
    noticed: displayCopy(row.narrative),
    reason: displayCopy(briefReason(row)),
  };
}

/** Most recently updated eligible Understanding — same recency the Today feature uses. */
export function selectCareNotice(rows: CareUnderstanding[]): CareNotice | null {
  const eligible = rows
    .filter((r) => isEligibleCareConnection(r))
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
  return eligible[0] ? careNoticeFor(eligible[0]) : null;
}

export function eligibleCareUnderstandings(rows: CareUnderstanding[]): CareUnderstanding[] {
  return rows
    .filter((r) => isEligibleCareConnection(r))
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
}

export const CARE_YOU_ROWS = [
  { id: 'provider', label: 'Provider connections' },
  { id: 'visit-prep', label: 'Visit preparation' },
  { id: 'shared', label: 'Previously shared summaries' },
] as const;
