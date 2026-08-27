import type { OnboardingAnswer } from './onboardingConversation';
import { commitOnboardingAnswers } from './onboardingConversation';

export interface OnboardingCompleteDraft {
  name: string;
  dob: string;
  lifeStage: string | null;
  story: string | null;
  notifPref: string;
  sharedHealthRows: string[];
  height: string;
  weight: string;
  answers: OnboardingAnswer[];
  needsCommit: boolean;
  connectHealthAfterAuth: boolean;
}

export type CompleteOnboardingResult =
  | { status: 'no-session' }
  | { status: 'entered-existing-account'; profile: OnboardingProfile }
  | { status: 'onboarded'; profile: OnboardingProfile };

export interface OnboardingProfile {
  onboarded_at: string | null;
}

export interface CompleteOnboardingDeps {
  fetchProfile: (userId: string) => Promise<OnboardingProfile | null>;
  updateProfile: (
    userId: string,
    patch: Record<string, unknown>
  ) => Promise<OnboardingProfile>;
  fetchNext: Parameters<typeof commitOnboardingAnswers>[2]['fetchNext'];
  answer: Parameters<typeof commitOnboardingAnswers>[2]['answer'];
  syncHealth: (userId: string) => Promise<void>;
  clearGuestDraft: () => Promise<void>;
  loadUserData: (userId: string) => Promise<void>;
}

export function parseDob(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function parseHeightToCm(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const feetInches = s.match(/^(\d+)\s*(?:'|ft)\s*(\d+)?\s*(?:"|in)?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] ?? 0);
    return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
  }

  const cm = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (cm) return Number(cm[1]);

  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:in|inches)$/);
  if (inOnly) return Math.round(Number(inOnly[1]) * 2.54 * 10) / 10;

  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 100 && n <= 230 ? n : null;
  }

  return null;
}

export function parseWeightToKg(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const lb = s.match(/^(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)$/);
  if (lb) return Math.round(Number(lb[1]) * 0.453592 * 10) / 10;

  const kg = s.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)$/);
  if (kg) return Number(kg[1]);

  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    if (n > 160) return Math.round(n * 0.453592 * 10) / 10;
    if (n > 0) return n;
  }

  return null;
}

/** What the account step does after a successful sign-in / sign-up. */
export function afterAccountAuth(
  conversationDone: boolean
): 'persist' | 'continue-conversation' {
  return conversationDone ? 'persist' : 'continue-conversation';
}

/**
 * Post-auth handoff used by App after the account step. Guest health/context
 * is not written until this runs; an already-onboarded account discards the
 * guest draft instead of merging it.
 */
export async function completeOnboardingAfterAuth(
  userId: string | null | undefined,
  draft: OnboardingCompleteDraft,
  deps: CompleteOnboardingDeps
): Promise<CompleteOnboardingResult> {
  if (!userId) return { status: 'no-session' };

  const existing = await deps.fetchProfile(userId);
  if (existing?.onboarded_at) {
    await deps.clearGuestDraft();
    await deps.loadUserData(userId);
    return { status: 'entered-existing-account', profile: existing };
  }

  if (draft.needsCommit) {
    await commitOnboardingAnswers(userId, draft.answers, {
      fetchNext: deps.fetchNext,
      answer: deps.answer,
    });
  }

  const name = draft.name.trim() || null;
  const updated = await deps.updateProfile(userId, {
    name,
    preferred_name: name,
    dob: parseDob(draft.dob),
    life_stage: draft.lifeStage,
    goals: draft.story ? [draft.story] : [],
    notification_preference: draft.notifPref,
    shared_health_rows: draft.sharedHealthRows,
    height_cm: parseHeightToCm(draft.height),
    weight_kg: parseWeightToKg(draft.weight),
    onboarded_at: new Date().toISOString(),
  });

  if (draft.connectHealthAfterAuth) {
    try {
      await deps.syncHealth(userId);
    } catch {
      // Same as App: health sync must not fail onboarding.
    }
  }

  await deps.clearGuestDraft();
  await deps.loadUserData(userId);
  return { status: 'onboarded', profile: updated };
}
