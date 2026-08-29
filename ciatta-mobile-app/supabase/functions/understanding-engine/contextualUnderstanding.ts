// Contextual Understanding — the initial, user-reported counterpart to the
// physiological Understandings the other four domain processors produce.
// Same table, same upsertUnderstanding() write path, same Guidance gate —
// this file only ever answers two questions: which domain does an
// onboarding concern belong under, and what does an honest Understanding
// built from nothing but that concern look like. It never touches
// Observations, Evidence, or the understandings table directly; index.ts's
// processContextualDomain() does that, the same way every other domain's
// process*Domain() does.
//
// What this deliberately does NOT do: paraphrase or summarize the user's
// free-text elaboration into a diagnosis-shaped claim ("you have chronic
// fatigue"). Free-text summarization is exactly the kind of inference this
// system has no reliable way to make (there is no NLP/LLM layer anywhere
// in this codebase) — inventing one here to sound more specific would be
// the fabrication the product spec explicitly rules out. The narrative
// below is built entirely from structured signals the user actually chose
// (the concern chip or its literal text, the recency chip, which of the
// existing five domains their words matched) plus, verbatim, their own
// elaboration — never a rewritten version of it.

export type Domain = 'sleep' | 'recovery' | 'energy' | 'cycle' | 'mood';

const RECENCY_PHRASE: Record<string, string> = {
  'Just recently': 'just recently',
  'A few weeks': 'for a few weeks',
  'A few months or longer': 'for a few months or longer',
  'It comes and goes': 'on and off',
};

// The same 21-domain vocabulary src/lib/healthIntent.ts classifies
// free-text answers into on the client, collapsed down to the five
// physiological domains this schema actually has — mirroring exactly how
// medications/supplements/health_history already get filed under
// 'recovery' as the closest fit elsewhere in this codebase (there is no
// general/non-physiological domain value to give them). Domains with no
// natural physiological home fall through to 'recovery', the same default
// used there.
const HEALTH_DOMAIN_TO_DOMAIN: Record<string, Domain> = {
  sleep: 'sleep',
  energy_recovery: 'energy',
  reproductive_hormonal: 'cycle',
  gynecological: 'cycle',
  menopause_midlife: 'cycle',
  pregnancy_postpartum: 'cycle',
  mental_emotional: 'mood',
};

const DOMAIN_WORD: Record<Domain, string> = {
  sleep: 'sleep',
  recovery: 'recovery',
  energy: 'energy',
  cycle: 'cycle',
  mood: 'mood',
};

/**
 * Which of the five existing physiological domains an onboarding concern
 * most plausibly belongs under — a filing decision, not a diagnosis. Takes
 * the classifier's own output (already computed and stored on the
 * Observation's context at answer time — see healthIntent.ts on the
 * client) rather than re-deriving anything from raw text here.
 */
export function mapConcernToDomain(healthDomains: string[]): Domain {
  for (const key of healthDomains) {
    const mapped = HEALTH_DOMAIN_TO_DOMAIN[key];
    if (mapped) return mapped;
  }
  return 'recovery';
}

export interface ContextualUnderstandingDraft {
  strength: 'emerging';
  narrative: string;
  confidenceLabel: string;
  stillLearning: string[];
}

export interface ContextualInput {
  concernAnswer: string;
  concernElaboration: string | null;
  recency: string | null;
}

/**
 * Builds the initial, user-reported Understanding for a domain — or
 * returns null when there isn't enough to honestly say anything, which is
 * the expected outcome for most callers (e.g. the user picked "I'm not
 * sure yet" and never elaborated). Always 'emerging' strength: this is a
 * single self-report, not a measured pattern, and 'emerging' is this
 * system's own existing floor for "just beginning" — it's also what keeps
 * Guidance silent for a contextual-only Understanding without any special
 * casing, since deriveGuidance() already requires 'strong' or
 * 'very-strong'.
 */
export function buildContextualUnderstanding(
  domain: Domain,
  input: ContextualInput
): ContextualUnderstandingDraft | null {
  const concern = input.concernAnswer?.trim();
  if (!concern) return null;

  const domainWord = DOMAIN_WORD[domain];
  const recencyPhrase = input.recency ? RECENCY_PHRASE[input.recency] : null;

  const concernClause = concernAsClause(concern);
  let narrative = `You shared ${concernClause}${recencyPhrase ? `, ${recencyPhrase}` : ''}. Understanding what may be contributing to this, starting with your ${domainWord}, matters to you.`;
  // (concernClause and everything else here is phrased in second person —
  // "you"/"your" — matching every other narrative in this codebase, e.g.
  // sleepAnalysis.ts's "You average about...".)

  if (input.concernElaboration && input.concernElaboration.trim().length > 0) {
    narrative += ` In your own words: "${input.concernElaboration.trim()}"`;
  }

  return {
    strength: 'emerging',
    narrative,
    confidenceLabel: 'still learning',
    stillLearning: [
      `There isn't enough health data yet to understand what may be contributing to this.`,
    ],
  };
}

// The concern chips are first-person statements ("I'm not feeling like
// myself") that read naturally on their own but not folded into a bigger
// sentence, so each gets its own clause form. Anything outside this exact
// set (free text typed instead of a chip, or "Something else") is quoted
// rather than guessed at — turning arbitrary free text into a grammatical
// clause is exactly the kind of invented specificity this file avoids.
const CONCERN_CLAUSE: Record<string, string> = {
  'Something has changed': 'that something has changed',
  "I'm not feeling like myself": "that you haven't been feeling like yourself",
  "I'm trying to improve something": 'that you are trying to improve something',
  "I'm managing a health condition": 'that you are managing a health condition',
  "I'm going through a life change": 'that you are going through a life change',
  "I'm curious about something": 'that you are curious about something',
};

function concernAsClause(concern: string): string {
  return CONCERN_CLAUSE[concern] ?? `this: "${concern}"`;
}
