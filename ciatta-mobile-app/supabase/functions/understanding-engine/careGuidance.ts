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
//
// The `guidance` string answers three distinct questions, in order, as
// three sentences — still one plain-text field, still the same column,
// still nothing outside this file's own enumerated maps:
//   1. WHY does Ciatta believe this?   — evidenceSentence(), built only
//      from the Understanding's own already-persisted evidence metadata
//      (observations_count, learning_since/first_observed) — never from
//      external knowledge.
//   2. WHAT might the user consider?   — considerSentence(), a fixed,
//      closed-form action per domain (CONSIDER_ACTION below).
//   3. WHEN might a provider help?     — the original connected-domain-
//      aware care sentence, unchanged in content and behavior.

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

// What's safe to suggest the user consider, per domain — closed-form and
// enumerated for the same reason CARE_REASON is: this is the only set of
// "what might help" sentences this module can ever produce, so there is no
// way for it to drift into treatment advice. Deliberately generic/
// behavioral (tracking, consistency, pacing) rather than clinical — the
// same register the product's other guidance sentences already use.
const CONSIDER_ACTION: Record<string, string> = {
  sleep: 'keeping your sleep schedule consistent',
  recovery: 'prioritizing recovery and easing up where you can',
  energy: 'pacing your activity and noticing what precedes your low-energy days',
  cycle: 'noting how this shows up across your cycle',
  mood: 'noticing what tends to precede these shifts',
};

/**
 * Evidence metadata already persisted on the Understanding row this
 * Guidance is being derived for — nothing here is computed fresh or
 * fetched from anywhere new. `learningSince` is expected to already be
 * `learning_since ?? first_observed` (the caller's job, since only it has
 * both), so this function only ever needs one anchor date.
 */
export interface EvidenceContext {
  observationsCount: number;
  learningSince: string | null;
}

function daysSince(dateStr: string, now: Date): number {
  const anchor = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((now.getTime() - anchor) / (24 * 60 * 60 * 1000)));
}

// Coarse, fixed buckets rather than "X days" — precise day counts read as
// a stat, not as something Ciatta "believes." Exported so the buckets
// themselves are directly testable without needing to fake wall-clock time
// through the rest of deriveGuidance().
export function durationPhrase(days: number): string {
  if (days < 7) return 'over the past several days';
  if (days < 21) return 'over the past couple of weeks';
  if (days < 60) return 'over the past several weeks';
  if (days < 180) return 'over the past couple of months';
  return 'over the past several months';
}

// Answers "why does Ciatta believe this?" — built only from this
// Understanding's own already-persisted evidence metadata. Falls back to
// the raw observation count when no anchor date is available (should be
// rare — every Understanding that reaches this function has already been
// through upsertUnderstanding() at least once), never falls back to
// nothing but a bare domain name.
function evidenceSentence(domainWord: string, evidence: EvidenceContext, now: Date): string {
  if (evidence.learningSince) {
    return `Ciatta has been learning from your ${domainWord} patterns ${durationPhrase(daysSince(evidence.learningSince, now))}.`;
  }
  if (evidence.observationsCount > 0) {
    return `Ciatta has been learning from your ${domainWord} patterns across ${evidence.observationsCount} observations.`;
  }
  return `Ciatta has been learning from your ${domainWord} patterns.`;
}

// Answers "what might the user consider doing?" — one fixed sentence per
// domain, never generated from the narrative or any external source.
function considerSentence(domain: string): string {
  const action = CONSIDER_ACTION[domain] ?? CONSIDER_ACTION.recovery;
  return `Consider ${action} and tracking whether the pattern continues.`;
}

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
 * @param evidence - observations_count and learning_since/first_observed,
 *   already read off the same Understanding row — see EvidenceContext.
 * @param now - defaults to the real current time; only ever overridden by
 *   tests, so the "why" sentence's duration bucket is deterministic to
 *   verify.
 */
export function deriveGuidance(
  domain: string,
  strength: string,
  connectedDomain: string | null,
  evidence: EvidenceContext,
  now: Date = new Date()
): GuidanceResult {
  if (!ACTIONABLE.has(strength)) return NO_GUIDANCE;

  const domainWord = DOMAIN_LABEL[domain] ?? domain;
  const connectedWord = connectedDomain ? DOMAIN_LABEL[connectedDomain] ?? connectedDomain : null;

  const careRecommendationType: CareRecommendationType = DOMAIN_CARE_TYPE[domain] ?? 'primary-care';
  const careLabel = CARE_LABEL[careRecommendationType];

  const patternBase = connectedWord
    ? `This pattern in your ${domainWord} appears connected to your ${connectedWord}.`
    : `This is a consistent pattern in your ${domainWord}.`;

  const guidance = [
    evidenceSentence(domainWord, evidence, now),
    considerSentence(domain),
    `${patternBase} If it continues, it may be worth discussing with ${careLabel}.`,
  ].join(' ');

  return {
    guidance,
    careRecommendationType,
    careRecommendationReason: CARE_REASON[careRecommendationType],
  };
}
