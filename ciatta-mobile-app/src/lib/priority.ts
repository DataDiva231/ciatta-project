// What Ciatta would put in front of you today, if it could only say one thing.
//
// The Today screen's understanding says what has been *noticed*; the priority
// says what to *do about it*. That second half only earns its place if it is
// derived from the same evidence — a fixed piece of advice sitting under a
// personal observation would read as a stock tip and undo the whole premise.
//
// So there are exactly two ways a priority can be produced, and no third:
//
//   1. An action, when the understanding is well enough evidenced to support
//      one and a measured value exists to anchor it. The number in the
//      sentence is the user's own, never a default.
//   2. An open question, when it isn't. "Help me learn X" is a real ask
//      drawn from the engine's own `still_learning` list.
//
// If neither applies the function returns null and the section does not
// render, the same way empty sections are dropped elsewhere in the app.
import type { Domain, Strength } from './types';
import type { UnderstandingRow } from './queries';
import { formatSleepMinutes, type RecentSyncSummary } from './observations';

export interface TodayPriority {
  text: string;
  domain: Domain;
  /** True when the line is anchored to a measured value rather than an open question. */
  measured: boolean;
}

// Eight hours is the only numeric target stated anywhere in this file. It is
// the one the client specified for the sleep line, and it is applied strictly
// as a comparison against the user's own measured sleep — never shown as a
// recommendation on its own.
const SLEEP_TARGET_MINUTES = 8 * 60;

// An action is only offered once the understanding behind it is solid. Below
// this, Ciatta is still forming a view and has no business issuing one.
const ACTIONABLE_STRENGTHS: Strength[] = ['strong', 'very-strong'];

export function derivePriority(
  featured: UnderstandingRow | null,
  sync: RecentSyncSummary | null
): TodayPriority | null {
  if (!featured) return null;

  const measured = measuredPriority(featured, sync);
  if (measured) return { text: measured, domain: featured.domain, measured: true };

  const open = featured.still_learning?.[0];
  if (open) {
    return { text: `Help me learn ${lowerFirst(open)}.`, domain: featured.domain, measured: false };
  }

  return null;
}

function measuredPriority(
  featured: UnderstandingRow,
  sync: RecentSyncSummary | null
): string | null {
  if (!ACTIONABLE_STRENGTHS.includes(featured.strength)) return null;
  if (!sync) return null;

  switch (featured.domain) {
    case 'sleep': {
      const slept = sync.reflection.sleepMinutes;
      if (slept == null) return null;
      if (slept < SLEEP_TARGET_MINUTES) {
        const short = SLEEP_TARGET_MINUTES - slept;
        return `Prioritize eight hours of sleep — you were ${formatSleepMinutes(short)} short last night.`;
      }
      return `Keep protecting your sleep — you got ${formatSleepMinutes(slept)} last night.`;
    }
    // The remaining domains have no target Ciatta can defend yet, so they
    // fall through to the open question rather than inventing one.
    case 'recovery':
    case 'cycle':
    case 'energy':
    case 'mood':
    default:
      return null;
  }
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}
