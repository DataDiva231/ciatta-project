/**
 * Pure mood analysis: no Deno/Supabase imports, same testing approach as
 * every other module here. Produces the last remaining standalone
 * Understanding — 'mood' has, until now, only ever been a Relationship
 * target (cycle -> mood, sleep -> mood, recovery -> mood), never described
 * on its own.
 *
 * Unlike sleep/steps/HRV, mood_rating is curiosity-sourced and gated by the
 * daily rotation (one of three domains asked per day), so it accumulates
 * far slower than device-synced data. Eligibility is sized by answer
 * count, not calendar days — there's no daily density to assume.
 */
import type { Strength } from './cycleAnalysis.ts';
import { strengthForObservedPattern } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

const MIN_ANSWERS = 10;
const CONFIDENCE_SAMPLE_CAP = 20;
// Rating 1 is literally the "Low" option on the curiosity card's own
// answer scale, so this is a self-labeled threshold, not a computed one —
// no need for a relative baseline the way steps/HRV need one, since this
// scale has no per-person variation to normalize away.
const LOW_MOOD_RATING = 1;

export interface MoodUnderstandingResult {
  totalAnswers: number;
  lowMoodCount: number;
  lowMoodRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeMood(observations: RatingObservation[]): MoodUnderstandingResult {
  const totalAnswers = observations.length;

  if (totalAnswers < MIN_ANSWERS) {
    return {
      totalAnswers,
      lowMoodCount: 0,
      lowMoodRate: 0,
      confidence: 0,
      eligible: false,
      observationIds: [],
    };
  }

  const lowMoodCount = observations.filter((o) => o.rating === LOW_MOOD_RATING).length;

  return {
    totalAnswers,
    lowMoodCount,
    lowMoodRate: lowMoodCount / totalAnswers,
    confidence: Math.min(1, totalAnswers / CONFIDENCE_SAMPLE_CAP),
    eligible: true,
    observationIds: observations.map((o) => o.id),
  };
}

export interface MoodUnderstandingDraft {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
}

const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function buildMoodUnderstanding(
  result: MoodUnderstandingResult
): MoodUnderstandingDraft | null {
  if (!result.eligible) return null;
  const strength = strengthForObservedPattern(result.confidence, result.lowMoodRate);
  const pct = Math.round(result.lowMoodRate * 100);
  return {
    strength,
    narrative: `Out of ${result.totalAnswers} times you've answered, you've rated your mood as "Low" ${pct}% of the time.`,
    confidenceLabel: CONFIDENCE_LABEL[strength],
  };
}
