// Guidance and Care Connection — an extension of the Understanding layer,
// not a parallel engine. This is the single place Guidance is derived
// anywhere in the system; every domain's upsertUnderstanding() call routes
// through it at the same point the Understanding itself is written, from
// the exact same `strength` that already gated whether the Understanding
// was actionable in the first place. There is deliberately no path that
// produces Guidance from raw Observations directly.
//
// Distinctions this file exists to keep straight (per the product's
// Guidance Safety rules):
//   Observation    — what was measured or reported (the observations table)
//   Pattern        — what changed or appears connected (the Relationship
//                    lookup below, when one already exists in the model)
//   Understanding  — what Ciatta currently understands (the narrative this
//                    module is handed, never generated here)
//   Guidance       — what the user may reasonably consider (this module's
//                    one output)
//   Action         — what the user chooses to do (not this module's
//                    concern at all)
//
// Guidance never diagnoses, prescribes, or determines treatment — every
// sentence this module can produce is enumerated below; nothing is
// templated from free text, so there is no way for it to say more than
// this file says it can.

export type CareRecommendationType = 'primary-care' | 'ob-gyn' | 'mental-health';

export interface GuidanceResult {
  guidance: string | null;
  careRecommendationType: CareRecommendationType | null;
  careRecommendationReason: string | null;
}

const NO_GUIDANCE: GuidanceResult = {
  guidance: null,
  careRecommendationType: null,
  careRecommendationReason: null,
};

// Guidance follows evidence — it is gated on the exact same confidence
// tier the product already treats as "solid enough to act on" (see
// ACTIONABLE_STRENGTHS in the mobile app's priority.ts, which this
// mirrors). 'moderate' and 'emerging' understandings are written with no
// guidance at all, not a hedged version of one.
const ACTIONABLE = new Set(['strong', 'very-strong']);

// Which category of provider a domain's pattern is ordinarily discussed
// with — a routing default, not a diagnosis. Domains with no
// domain-specific specialty (recovery, energy) fall through to primary
// care, the same safe default used throughout this product's copy.
const DOMAIN_CARE_TYPE: Record<string, CareRecommendationType> = {
  cycle: 'ob-gyn',
  mood: 'mental-health',
};

const CARE_LABEL: Record<CareRecommendationType, string> = {
  'primary-care': 'your primary care provider',
  'ob-gyn': 'your OB/GYN',
  'mental-health': 'a mental health provider',
};

const CARE_REASON: Record<CareRecommendationType, string> = {
  'primary-care': 'General or unexplained changes are usually best started with primary care.',
  'ob-gyn': 'Cycle-related patterns are usually best discussed with an OB/GYN.',
  'mental-health': 'Mood-related patterns are usually best discussed with a mental health provider.',
};

export const DOMAIN_LABEL: Record<string, string> = {
  sleep: 'sleep',
  recovery: 'recovery',
  energy: 'energy',
  cycle: 'cycle',
  mood: 'mood',
};

/**
 * @param domain - the Understanding's own domain (e.g. 'sleep')
 * @param strength - the Understanding's own confidence tier — the same
 *   value already written to the understandings row
 * @param connectedDomain - the domain of the strongest existing
 *   Relationship this Understanding already has in the model, if any
 *   (looked up from the `relationships` table before this is called —
 *   see upsertUnderstanding in index.ts). Passing one in is what lets
 *   Guidance name a real, already-represented connection instead of
 *   reading as generic advice.
 */
export function deriveGuidance(
  domain: string,
  strength: string,
  connectedDomain: string | null
): GuidanceResult {
  if (!ACTIONABLE.has(strength)) return NO_GUIDANCE;

  const domainWord = DOMAIN_LABEL[domain] ?? domain;
  const connectedWord = connectedDomain ? DOMAIN_LABEL[connectedDomain] ?? connectedDomain : null;

  const careRecommendationType: CareRecommendationType = DOMAIN_CARE_TYPE[domain] ?? 'primary-care';
  const careLabel = CARE_LABEL[careRecommendationType];

  const base = connectedWord
    ? `This pattern in your ${domainWord} appears connected to your ${connectedWord}.`
    : `This is a consistent pattern in your ${domainWord}.`;

  return {
    guidance: `${base} If it continues, it may be worth discussing with ${careLabel}.`,
    careRecommendationType,
    careRecommendationReason: CARE_REASON[careRecommendationType],
  };
}
