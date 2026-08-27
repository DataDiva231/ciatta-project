/**
 * Cross-Domain Synthesis — pure decision logic for promoting an existing,
 * already-qualifying `relationships` row into a Cross-Domain Understanding.
 * No Deno/Supabase imports, same testing approach as every other analysis
 * module here.
 *
 * This is deliberately NOT a fusion engine: it never reads raw Observations
 * or Evidence, never computes a new pattern of its own, and never invents a
 * confidence number. It only ever promotes what the existing pipeline
 * already produced — two independently 'health_data', independently
 * actionable-strength Domain Understandings, already linked by an
 * already-actionable-strength Relationship — into one higher-level row.
 * Take any one of those three things away and there is nothing to
 * synthesize; this module returns null rather than guess.
 *
 * Guidance is not derived here. The caller (index.ts) still calls the
 * exact same deriveGuidance() every domain processor already calls, with
 * the priority domain (see DOMAIN_PRIORITY) as `domain` and the other
 * domain in the pair as `connectedDomain` — reusing deriveGuidance()'s own
 * existing connected-domain sentence and DOMAIN_CARE_TYPE routing (e.g.
 * cycle -> ob-gyn) exactly as-is, so a cross-domain Understanding centered
 * on 'cycle' still routes to ob-gyn instead of falling back to generic
 * primary-care. There is no second Guidance mechanism anywhere in this
 * file.
 */
import type { Domain } from './contextualUnderstanding.ts';
import type { Strength } from './cycleAnalysis.ts';
import { STRENGTH_LADDER, CONFIDENCE_LABEL } from './decay.ts';

// Same bar Guidance itself already requires (careGuidance.ts's own
// ACTIONABLE) — duplicated here rather than imported so this file has no
// dependency on careGuidance.ts at all; the two are independently defined
// and, if they ever needed to differ, could without this file silently
// inheriting a change meant for Guidance's own gate.
const ACTIONABLE = new Set<string>(['strong', 'very-strong']);

// Which domain "names" a cross-domain pattern when more than one
// qualifies, in priority order — highest first. This exists only to pick
// which domain deriveGuidance() is called with (so cycle-involving
// patterns keep routing to ob-gyn, not a generic fallback) and which
// domain the display `label` is built from; it never affects whether
// synthesis happens, what strength it gets, or what evidence backs it.
const DOMAIN_PRIORITY: readonly Domain[] = ['cycle', 'recovery', 'sleep', 'mood', 'energy'];

function priorityDomain(a: Domain, b: Domain): { primary: Domain; other: Domain } {
  for (const d of DOMAIN_PRIORITY) {
    if (d === a) return { primary: a, other: b };
    if (d === b) return { primary: b, other: a };
  }
  return { primary: a, other: b };
}

export interface ContributingUnderstanding {
  id: string;
  domain: Domain;
  strength: Strength;
  evidenceType: string;
  learningSince: string | null;
  observationsCount: number;
}

export interface QualifyingRelationship {
  fromDomain: Domain;
  toDomain: Domain;
  strength: string;
}

export interface CrossDomainDraft {
  fromDomain: Domain;
  toDomain: Domain;
  primaryDomain: Domain;
  otherDomain: Domain;
  label: string;
  narrative: string;
  strength: Strength;
  confidenceLabel: string;
  contributingUnderstandingIds: string[];
  learningSinceAnchor: string | null;
  observationsCount: number;
  stillLearning: string[];
}

function isWeakerOrEqual(a: Strength, b: Strength): boolean {
  // Higher index in STRENGTH_LADDER (['very-strong','strong','moderate','emerging'])
  // means weaker — this returns true when `a` is the weaker (or same) tier.
  return STRENGTH_LADDER.indexOf(a) >= STRENGTH_LADDER.indexOf(b);
}

/** The weaker (never the stronger, never an average) of two strengths —
 * this is the whole of the "confidence cannot exceed the weakest
 * qualifying contributor" rule. */
export function weakerStrength(a: Strength, b: Strength): Strength {
  return isWeakerOrEqual(a, b) ? a : b;
}

const DOMAIN_WORD: Record<Domain, string> = {
  sleep: 'sleep',
  recovery: 'recovery',
  energy: 'energy',
  cycle: 'cycle',
  mood: 'mood',
};

/**
 * Attempts to build a Cross-Domain Understanding draft from one
 * `relationships` row and its two contributing Domain Understandings.
 * Returns null — never a low-confidence guess — whenever any one of the
 * required conditions isn't met:
 *
 *  - both contributing Understandings must be 'health_data' (never
 *    'user_reported' — a self-report can describe a domain but can never
 *    itself qualify as one half of a cross-domain synthesis)
 *  - both contributing Understandings must independently already be
 *    'strong' or 'very-strong' (the exact same ACTIONABLE bar Guidance
 *    itself requires)
 *  - the Relationship connecting them must itself already be 'strong' or
 *    'very-strong' (a weak or merely-'moderate' relationship is not a
 *    "meaningful relationship" in the sense this feature requires)
 *  - the two Understandings must actually be for different domains
 */
export function buildCrossDomainDraft(
  relationship: QualifyingRelationship,
  from: ContributingUnderstanding,
  to: ContributingUnderstanding
): CrossDomainDraft | null {
  if (from.domain === to.domain) return null;
  if (from.domain !== relationship.fromDomain || to.domain !== relationship.toDomain) return null;
  if (from.evidenceType !== 'health_data' || to.evidenceType !== 'health_data') return null;
  if (!ACTIONABLE.has(from.strength) || !ACTIONABLE.has(to.strength)) return null;
  if (!ACTIONABLE.has(relationship.strength)) return null;

  const strength = weakerStrength(from.strength, to.strength);
  const { primary, other } = priorityDomain(from.domain, to.domain);

  const learningSinceAnchor =
    from.learningSince && to.learningSince
      ? from.learningSince < to.learningSince
        ? from.learningSince
        : to.learningSince
      : from.learningSince ?? to.learningSince ?? null;

  return {
    fromDomain: from.domain,
    toDomain: to.domain,
    primaryDomain: primary,
    otherDomain: other,
    label: `${DOMAIN_WORD[primary]}-related`,
    narrative: `These changes have been occurring together across your ${DOMAIN_WORD[from.domain]} and ${DOMAIN_WORD[to.domain]}.`,
    strength,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    contributingUnderstandingIds: [from.id, to.id],
    learningSinceAnchor,
    observationsCount: from.observationsCount + to.observationsCount,
    stillLearning: ['how these two patterns influence each other over time'],
  };
}
