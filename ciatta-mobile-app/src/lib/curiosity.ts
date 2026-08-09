import { supabase } from './supabase';
import { insertObservation } from './observations';
import type { Domain } from './types';

export interface ActiveCuriosity {
  id: string;
  question: string;
  purpose: string;
  domain: Domain;
  answerOptions: string[];
  observationType: string;
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
    question: row.question,
    purpose: row.purpose,
    domain: row.domain,
    answerOptions: row.answer_options,
    observationType: row.observation_type,
  };
}

// Shared scale for every rating-style question (energy, mood, ...). Kept
// client-side since it's presentation-adjacent, not content — the bank
// only owns question text and which scale a domain uses.
const RATING_VALUE: Record<string, number> = { Low: 1, Okay: 2, Good: 3, Great: 4 };

export async function answerCuriosity(
  userId: string,
  curiosity: ActiveCuriosity,
  answer: string
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
    context: { question: curiosity.question },
  });
}
