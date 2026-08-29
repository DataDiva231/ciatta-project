import { supabase } from './supabase';
import { insertObservation } from './observations';
import { displayCopy, displayCopyList } from './displayCopy';
import type { Domain } from './types';

export interface ActiveCuriosity {
  id: string;
  question: string;
  purpose: string;
  domain: Domain;
  answerOptions: string[];
  observationType: string;
  // Only set for onboarding-driven questions (see fetchNextOnboardingQuestion
  // below) — the daily rotation neither needs nor sets these.
  tag?: string;
  inputKind?: 'chip' | 'text';
}

interface CuriosityRow {
  id: string;
  question: string;
  purpose: string;
  domain: Domain;
  answer_options: string[];
  observation_type: string;
}

/**
 * The one unanswered curiosity queued for this user, if any. What gets
 * queued (and when) is decided entirely server-side by
 * ensure_daily_curiosity() — the client only ever reads and answers.
 */
export async function fetchActiveCuriosity(userId: string): Promise<ActiveCuriosity | null> {
  const { data, error } = await supabase
    .from('curiosities')
    .select('id, question, purpose, domain, answer_options, observation_type')
    .eq('user_id', userId)
    .is('answer', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as CuriosityRow;
  return {
    id: row.id,
    question: displayCopy(row.question),
    purpose: displayCopy(row.purpose),
    domain: row.domain,
    answerOptions: displayCopyList(row.answer_options),
    observationType: row.observation_type,
  };
}

interface OnboardingQuestionRow {
  curiosity_id: string;
  tag: string;
  question: string;
  purpose: string;
  domain: Domain;
  answer_options: string[];
  observation_type: string;
  input_kind: 'chip' | 'text';
}

/**
 * The conversational onboarding's equivalent of fetchActiveCuriosity: asks
 * the server what to ask next, same "client only ever reads and answers"
 * rule as the rest of this engine. Pass the tag/answer just given so a
 * follow-up it unlocks is offered before the fixed backbone resumes; call
 * with no arguments to start. Returns null once nothing is left to ask —
 * that's the signal the conversation is done, not an error.
 */
export async function fetchNextOnboardingQuestion(
  userId: string,
  lastTag?: string,
  lastAnswer?: string
): Promise<ActiveCuriosity | null> {
  const { data, error } = await supabase.rpc('next_onboarding_question', {
    p_user_id: userId,
    p_last_tag: lastTag ?? null,
    p_last_answer: lastAnswer ?? null,
  });
  if (error) throw error;

  const row = (data as OnboardingQuestionRow[] | null)?.[0];
  if (!row) return null;

  return {
    id: row.curiosity_id,
    question: displayCopy(row.question),
    purpose: displayCopy(row.purpose),
    domain: row.domain,
    answerOptions: displayCopyList(row.answer_options),
    observationType: row.observation_type,
    tag: row.tag,
    inputKind: row.input_kind,
  };
}

/**
 * Onboarding bank rows only — used to run the conversation before the user
 * has an account. RLS hides daily-rotation questions (see
 * 20260832000000_guest_onboarding_bank_read.sql).
 */
export async function fetchOnboardingQuestionBank(): Promise<
  import('./onboardingConversation').OnboardingBankRow[]
> {
  const { data, error } = await supabase
    .from('curiosity_bank')
    .select(
      'tag, question, purpose, domain, answer_options, observation_type, input_kind, depends_on_tag, depends_on_answer_contains, depends_on_answer_not_contains, active, is_onboarding'
    )
    .eq('is_onboarding', true)
    .eq('active', true);
  if (error) throw error;
  return ((data ?? []) as import('./onboardingConversation').OnboardingBankRow[]).map(
    sanitizeBankRow
  );
}

function sanitizeBankRow(
  row: import('./onboardingConversation').OnboardingBankRow
): import('./onboardingConversation').OnboardingBankRow {
  return {
    ...row,
    question: displayCopy(row.question),
    purpose: displayCopy(row.purpose),
    answer_options: displayCopyList(row.answer_options),
  };
}

// Shared scale for every rating-style question (energy, mood, ...). Kept
// client-side since it's presentation-adjacent, not content — the bank
// only owns question text and which scale a domain uses.
const RATING_VALUE: Record<string, number> = { Low: 1, Okay: 2, Good: 3, Great: 4 };

export async function answerCuriosity(
  userId: string,
  curiosity: ActiveCuriosity,
  answer: string,
  // Behind-the-scenes provenance only (e.g. health-domain classification of
  // a free-text answer) — never anything the user chose or saw as a
  // category. Merged into the Observation's context, not stored anywhere
  // the client itself later reads.
  extraContext: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('curiosities')
    .update({ answer, answered_at: new Date().toISOString() })
    .eq('id', curiosity.id)
    .eq('user_id', userId);
  if (error) throw error;

  const value = curiosity.observationType.endsWith('_rating')
    ? { rating: RATING_VALUE[answer] ?? null }
    : { answer };

  await insertObservation(userId, {
    source: 'curiosity',
    type: curiosity.observationType,
    value,
    recordedAt: new Date().toISOString(),
    context: { question: curiosity.question, ...extraContext },
  });
}
