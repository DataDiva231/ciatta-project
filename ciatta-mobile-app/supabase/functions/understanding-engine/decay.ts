/**
 * Pure decay decision logic — extracted from decayStaleUnderstandings() in
 * index.ts so the strength/confidence_label synchronization guarantee is
 * directly testable without a live Supabase client (index.ts's top-level
 * Deno.env.get() calls and unguarded Deno.serve() make it unimportable by
 * a test file as-is, and fixing that is out of scope for this change).
 *
 * All I/O — which rows are stale, applying the update, writing the history
 * row — stays in index.ts, unchanged in behavior. This file only answers
 * one question: given a current strength, what does it decay to, and what
 * confidence_label must travel with it so the two never disagree.
 */
import type { Strength } from './cycleAnalysis.ts';

// Same ladder, same order, index.ts previously kept a private copy of this
// inline — moved here so decay.test.ts can exercise the real ordering
// rather than a re-typed copy of it.
export const STRENGTH_LADDER: readonly Strength[] = ['very-strong', 'strong', 'moderate', 'emerging'];

// Identical to every processor's own private CONFIDENCE_LABEL map
// (cycleAnalysis.ts, sleepAnalysis.ts, hrvAnalysis.ts, moodAnalysis.ts,
// stepsAnalysis.ts) — same convention (a small private-to-the-concept
// copy rather than a shared import), just the copy decay logic needs.
export const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export interface DecayedState {
  strength: Strength;
  confidenceLabel: string;
}

/**
 * Steps a strength one rung toward 'emerging' — the demotion
 * decayStaleUnderstandings() applies when a domain goes STALE_AFTER_DAYS
 * without being refreshed. Returns null when there's nothing to decay to
 * ('emerging' is already the floor) or the strength isn't recognized —
 * decayStaleUnderstandings() treats either as "leave this row alone."
 *
 * Returning the confidence_label alongside the strength (rather than
 * leaving the caller to look it up separately, or not at all) is the
 * actual fix this file exists for: before this, decayStaleUnderstandings()
 * updated `strength` without touching `confidence_label`, so a row could
 * carry strength='moderate' while its label still read 'confident' from
 * whenever it was last 'strong'.
 */
export function nextDecayedState(strength: string): DecayedState | null {
  const idx = STRENGTH_LADDER.indexOf(strength as Strength);
  if (idx === -1 || idx === STRENGTH_LADDER.length - 1) return null;
  const next = STRENGTH_LADDER[idx + 1];
  return { strength: next, confidenceLabel: CONFIDENCE_LABEL[next] };
}
