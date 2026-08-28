/**
 * Morning state — a lightweight pass *after* nightly reconciliation (or a
 * dedicated morning invoke) that chooses which already-written Understanding
 * Today should feature.
 *
 * This is not a second intelligence engine: it never inspects Observations,
 * never recomputes Evidence, and never calls a domain processor. It only
 * answers "which living Understanding is this morning's?" so the existing
 * Today sort (latest `last_updated`) can pick it up.
 */
export interface MorningWrite {
  domain: string;
  wroteThisRun: boolean;
}

export interface UnderstandingFreshness {
  domain: string;
  lastUpdated: string;
}

export function selectMorningDomain(writes: MorningWrite[]): string | null {
  const sleep = writes.find((w) => w.domain === 'sleep' && w.wroteThisRun);
  if (sleep) return 'sleep';
  const firstWrite = writes.find((w) => w.wroteThisRun);
  return firstWrite?.domain ?? null;
}

/**
 * Morning preference for sleep is the sleep processor, never a contextual
 * rewrite of the same domain. Onboarding copy must not outrank a real
 * health_data write from this run when Today picks by last_updated.
 */
export function assembleMorningWrites(args: {
  cycleWrote: boolean;
  sleepWrote: boolean;
  recoveryWrote: boolean;
  moodWrote: boolean;
  contextualWrote: boolean;
  contextualDomain: string | null;
}): MorningWrite[] {
  const writes: MorningWrite[] = [
    { domain: 'cycle', wroteThisRun: args.cycleWrote },
    { domain: 'sleep', wroteThisRun: args.sleepWrote },
    { domain: 'recovery', wroteThisRun: args.recoveryWrote },
    { domain: 'mood', wroteThisRun: args.moodWrote },
  ];
  if (!args.contextualWrote || !args.contextualDomain) return writes;
  if (writes.some((w) => w.domain === args.contextualDomain)) return writes;
  writes.push({ domain: args.contextualDomain, wroteThisRun: true });
  return writes;
}

/** Same rule Today already uses: the most recently updated Understanding. */
export function featuredUnderstanding(rows: UnderstandingFreshness[]): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) => Date.parse(b.lastUpdated) - Date.parse(a.lastUpdated)
  );
  return sorted[0].domain;
}
