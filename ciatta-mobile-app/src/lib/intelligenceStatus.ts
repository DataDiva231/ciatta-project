import { displayCopy } from './displayCopy';
import type { Strength } from './types';
import { composeWhyLayer, type WhyLayer, type WhyLayerInput, type WhyUnderstanding } from './whyLayer';

export type IntelligenceUnderstanding = WhyUnderstanding & {
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
};

const FALLBACK_STATUS: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

function notableShareFromNarrative(narrative: string | null | undefined): number | null {
  if (!narrative) return null;
  const match = narrative.match(/About (\d+)% of your days/i);
  if (!match) return null;
  return Number(match[1]) / 100;
}

function capDisplayedStrength(strength: Strength, notableRate: number): Strength {
  if (notableRate < 0.05) {
    if (strength === 'very-strong' || strength === 'strong') return 'moderate';
    return strength;
  }
  if (strength === 'very-strong' && notableRate < 0.15) return 'strong';
  return strength;
}

function stripCareSentence(guidance: string | null): string | null {
  if (!guidance) return null;
  const withoutCare = guidance
    .replace(/\s*This is a consistent pattern in your recovery\.\s*If it continues, it may be worth discussing with your primary care provider\./gi, '')
    .replace(/\s*This pattern in your recovery appears connected to your [^.]+.\s*If it continues, it may be worth discussing with your primary care provider\./gi, '')
    .trim();
  return withoutCare ? displayCopy(withoutCare) : null;
}

/**
 * Aligns a persisted Understanding with the presentation rules so Today,
 * Core, and Why cannot show a stale very-strong/care status that the
 * evidence in the same row does not support. Does not rewrite the
 * database or touch observations.
 */
export function presentPersistedUnderstanding<T extends {
  domain: string;
  strength: Strength;
  narrative: string;
  confidence_label: string | null;
  guidance: string | null;
  care_recommendation_type: string | null;
  care_recommendation_reason: string | null;
}>(row: T): T {
  const narrative = row.narrative ?? '';
  const notable = notableShareFromNarrative(narrative);
  const stepsRecovery = row.domain === 'recovery' && /steps a day/i.test(narrative);
  const hrvRecovery = row.domain === 'recovery' && /heart rate variability/i.test(narrative);
  let strength = row.strength;
  if (notable != null && (stepsRecovery || hrvRecovery || row.domain === 'sleep' || row.domain === 'mood')) {
    strength = capDisplayedStrength(row.strength, notable);
  }
  const dropCare =
    stepsRecovery || (hrvRecovery && (notable == null || notable < 0.15)) || strength === 'emerging' || strength === 'moderate';
  const status = FALLBACK_STATUS[strength] ?? row.confidence_label ?? 'still learning';
  return {
    ...row,
    strength,
    confidence_label: displayCopy(status),
    guidance: dropCare && (stepsRecovery || hrvRecovery) ? stripCareSentence(row.guidance) : row.guidance,
    care_recommendation_type: dropCare ? null : row.care_recommendation_type,
    care_recommendation_reason: dropCare ? null : row.care_recommendation_reason,
  };
}

export function coreStatusLabel(row: {
  strength: Strength;
  confidence_label: string | null;
}): string {
  const raw = row.confidence_label?.trim() || FALLBACK_STATUS[row.strength] || 'still learning';
  return displayCopy(raw);
}

export function todayHeadline(domainWord: string, strength: Strength): string {
  if (strength === 'emerging' || strength === 'moderate') {
    return displayCopy(`What's taking shape in your ${domainWord.toLowerCase()}`);
  }
  return displayCopy(`What we understand about your ${domainWord.toLowerCase()}`);
}

export function intelligenceSurfaces(input: WhyLayerInput): {
  today: { narrative: string; status: string; strength: Strength };
  core: { status: string; strength: Strength };
  why: WhyLayer;
} {
  const featured = input.featured;
  const status = coreStatusLabel(featured);
  return {
    today: {
      narrative: displayCopy(featured.narrative),
      status,
      strength: featured.strength,
    },
    core: { status, strength: featured.strength },
    why: composeWhyLayer(input),
  };
}
