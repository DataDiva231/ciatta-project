// Guest onboarding conversation: same branching as next_onboarding_question()
// (see supabase/migrations/20260826000000_fix_next_onboarding_question_ambiguous_tag.sql)
// but without writing curiosities/observations until the user has an account.
// Authenticated onboarding still uses the RPC; this module is the unauthenticated
// preview and the post-auth replay onto that RPC.

import type { Domain } from './types';
import { classifyHealthIntent } from './healthIntent';
import { displayCopy, displayCopyList } from './displayCopy';

export interface PreviewCuriosity {
  id: string;
  question: string;
  purpose: string;
  domain: Domain;
  answerOptions: string[];
  observationType: string;
  tag?: string;
  inputKind?: 'chip' | 'text';
}

export const ONBOARDING_FLOW_STEPS = [
  'welcome',
  'conversation',
  'understanding',
  'reflection',
  'mental-health',
  'health-documents',
  'medical-records',
  'wearables',
  'calendar',
  'notifications',
  'policies',
  'account',
] as const;

export const ONBOARDING_CONVERSATION_STEP = 1;
export const ONBOARDING_ACCOUNT_STEP = ONBOARDING_FLOW_STEPS.length - 1;

export const ONBOARDING_BACKBONE_TAGS = [
  'intent',
  'concern',
  'medications',
  'supplements',
  'health_history',
] as const;

export const CLASSIFIED_ONBOARDING_TAGS = new Set(['concern', 'concern_elaborate']);

export interface OnboardingBankRow {
  tag: string;
  question: string;
  purpose: string;
  domain: Domain;
  answer_options: string[];
  observation_type: string;
  input_kind: 'chip' | 'text';
  depends_on_tag: string | null;
  depends_on_answer_contains: string | null;
  depends_on_answer_not_contains: string | null;
  active?: boolean;
  is_onboarding?: boolean;
}

export interface OnboardingAnswer {
  tag: string;
  answer: string;
  extraContext: Record<string, unknown>;
}

function ilikeContains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function isEligibleOnboardingRow(row: OnboardingBankRow): boolean {
  return row.active !== false && row.is_onboarding !== false;
}

/**
 * Pure port of next_onboarding_question()'s selection rules, using an
 * in-memory asked-tag list instead of the curiosities table. Follow-ups
 * that all match are returned in bank order (SQL uses ORDER BY random();
 * the live bank currently has at most one match per trigger).
 */
export function pickNextOnboardingQuestion(
  bank: OnboardingBankRow[],
  askedTags: string[],
  lastTag?: string | null,
  lastAnswer?: string | null
): OnboardingBankRow | null {
  const asked = new Set(askedTags);

  if (lastTag) {
    const followup = bank.find((cb) => {
      if (!isEligibleOnboardingRow(cb)) return false;
      if (cb.depends_on_tag !== lastTag) return false;
      if (
        cb.depends_on_answer_contains != null &&
        !ilikeContains(lastAnswer ?? '', cb.depends_on_answer_contains)
      ) {
        return false;
      }
      if (
        cb.depends_on_answer_not_contains != null &&
        ilikeContains(lastAnswer ?? '', cb.depends_on_answer_not_contains)
      ) {
        return false;
      }
      if (asked.has(cb.tag)) return false;
      return true;
    });
    if (followup) return followup;
  }

  for (const t of ONBOARDING_BACKBONE_TAGS) {
    if (asked.has(t)) continue;
    const candidate = bank.find(
      (cb) => isEligibleOnboardingRow(cb) && cb.tag === t && !cb.depends_on_tag
    );
    if (candidate) return candidate;
  }

  return null;
}

export function bankRowToCuriosity(row: OnboardingBankRow): PreviewCuriosity {
  return {
    id: `guest:${row.tag}`,
    question: displayCopy(row.question),
    purpose: displayCopy(row.purpose),
    domain: row.domain,
    answerOptions: displayCopyList(row.answer_options),
    observationType: row.observation_type,
    tag: row.tag,
    inputKind: row.input_kind,
  };
}

export function extraContextForOnboardingAnswer(
  tag: string | undefined,
  answer: string
): Record<string, unknown> {
  if (tag && CLASSIFIED_ONBOARDING_TAGS.has(tag)) {
    return { health_domains: classifyHealthIntent(answer) };
  }
  return {};
}

export function recordOnboardingAnswer(
  tag: string,
  answer: string
): OnboardingAnswer {
  return {
    tag,
    answer,
    extraContext: extraContextForOnboardingAnswer(tag, answer),
  };
}

/**
 * Replays guest answers through the existing authenticated pipeline so
 * observations land on the account and enqueue the Understanding Engine.
 * Stops cleanly if the server reports the conversation is already done.
 */
export async function commitOnboardingAnswers(
  userId: string,
  answers: OnboardingAnswer[],
  deps: {
    fetchNext: (
      userId: string,
      lastTag?: string,
      lastAnswer?: string
    ) => Promise<PreviewCuriosity | null>;
    answer: (
      userId: string,
      curiosity: PreviewCuriosity,
      answer: string,
      extraContext?: Record<string, unknown>
    ) => Promise<void>;
  }
): Promise<void> {
  const { fetchNext, answer } = deps;
  let lastTag: string | undefined;
  let lastAnswer: string | undefined;

  for (const recorded of answers) {
    const next = await fetchNext(userId, lastTag, lastAnswer);
    if (!next) return;
    await answer(userId, next, recorded.answer, recorded.extraContext);
    lastTag = recorded.tag;
    lastAnswer = recorded.answer;
  }
}
