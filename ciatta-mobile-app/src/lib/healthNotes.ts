import { supabase } from './supabase';

/**
 * The "Your Health" categories are stored as observations rather than profile
 * columns, so they sit alongside every other signal the Understanding Engine
 * reads and carry their own history. One row per category, rewritten in place.
 */
const TYPE = 'health_profile_note';

export async function fetchHealthNote(userId: string, category: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('observations')
    .select('value')
    .eq('user_id', userId)
    .eq('type', TYPE)
    .contains('context', { category })
    .order('recorded_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const v = data?.[0]?.value as { text?: string } | undefined;
  return v?.text ?? null;
}

export async function saveHealthNote(
  userId: string,
  category: string,
  text: string
): Promise<void> {
  // Clear the previous note for this category so a category holds one current
  // answer rather than an ever-growing pile of revisions.
  const { error: delError } = await supabase
    .from('observations')
    .delete()
    .eq('user_id', userId)
    .eq('type', TYPE)
    .contains('context', { category });
  if (delError) throw delError;

  if (text) {
    const { error } = await supabase.from('observations').insert({
      user_id: userId,
      source: 'manual',
      type: TYPE,
      value: { text },
      recorded_at: new Date().toISOString(),
      context: { category },
    });
    if (error) throw error;
  }

  // Keep the You screen's "Shared" / "Not shared yet" label honest.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('shared_health_rows')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;

  const current: string[] = profile?.shared_health_rows ?? [];
  const next = text
    ? Array.from(new Set([...current, category]))
    : current.filter((c) => c !== category);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ shared_health_rows: next })
    .eq('id', userId);
  if (updateError) throw updateError;
}
