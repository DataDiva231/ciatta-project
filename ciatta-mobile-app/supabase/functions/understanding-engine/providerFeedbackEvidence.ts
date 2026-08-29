/**
 * Provider Feedback -> Evidence — pure decision logic for the smallest
 * piece of "New Evidence" Provider Feedback/Outcome can become. No
 * Deno/Supabase imports, same testing approach as every other analysis
 * module here.
 *
 * What this deliberately does NOT do is as important as what it does:
 *   - It never computes or touches `strength`, `narrative`, or
 *     `confidence_label` on any Understanding — those stay driven only by
 *     the physiological/contextual processors that already own them.
 *   - It never touches `understandings.last_updated` — decayStaleUnderstandings()
 *     reads that column to decide whether a domain has gone stale, and
 *     letting a logged provider note quietly keep a domain looking "fresh"
 *     would defeat decay for real.
 *   - It never overwrites a past Evidence row or a past
 *     understanding_history entry — only ever inserts a new one, once, per
 *     feedback observation.
 * The one thing it does do: mark, in the existing Evidence and
 * understanding_history tables, that real-world feedback happened —
 * additive provenance a future, separate change could choose to read, not
 * something this file reads or acts on itself.
 */
import type { Domain } from './contextualUnderstanding.ts';

export type ProviderFeedbackType = 'provider_assessment' | 'provider_outcome';

export interface ProviderFeedbackObservation {
  id: string;
  type: ProviderFeedbackType;
  recordedAt: string;
  domain: Domain | null;
  understandingId: string | null;
}

export interface ProviderFeedbackEvidenceDraft {
  observationId: string;
  domain: Domain;
  understandingId: string;
  eventDate: string;
  historyLabel: string;
}

const HISTORY_LABEL: Record<ProviderFeedbackType, string> = {
  provider_assessment: 'Logged what a provider said about this.',
  provider_outcome: 'Logged what happened after talking with a provider.',
};

/**
 * Filters to feedback observations that (a) have not already produced an
 * Evidence row (the caller passes in the observation ids already covered,
 * read from existing evidence_type='provider_reported' rows) and (b)
 * actually name a domain and an understanding — anything missing either is
 * malformed/older data with nothing to attach to, and is skipped rather
 * than guessed at.
 *
 * Deliberately takes `ownedUnderstandingIds` — the set of Understanding
 * ids this specific user actually owns (fetched server-side, scoped to
 * their own user_id) — and only matches a feedback observation whose
 * `understandingId` is IN that set. `context.understandingId` on an
 * Observation is client-supplied JSON on that client's own (RLS-owned)
 * row; without this check, a crafted context payload could name a
 * different user's understanding id and, since the engine runs as
 * service_role, get history written against a stranger's Understanding.
 * Matching against the caller's own fetched, user-scoped set closes that.
 */
export function selectNewProviderFeedbackDrafts(
  observations: ProviderFeedbackObservation[],
  alreadyRecordedObservationIds: ReadonlySet<string>,
  ownedUnderstandingIds: ReadonlySet<string>
): ProviderFeedbackEvidenceDraft[] {
  const drafts: ProviderFeedbackEvidenceDraft[] = [];
  for (const obs of observations) {
    if (alreadyRecordedObservationIds.has(obs.id)) continue;
    if (!obs.domain || !obs.understandingId) continue;
    if (!ownedUnderstandingIds.has(obs.understandingId)) continue;

    drafts.push({
      observationId: obs.id,
      domain: obs.domain,
      understandingId: obs.understandingId,
      eventDate: obs.recordedAt.slice(0, 10),
      historyLabel: HISTORY_LABEL[obs.type],
    });
  }
  return drafts;
}
