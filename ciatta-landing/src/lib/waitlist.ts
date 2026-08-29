import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The page must still render and still validate input when Supabase is not
// configured — a missing env var should surface as an honest error on submit,
// never as a blank screen at load.
export const isConfigured = Boolean(url && key);

const client: SupabaseClient | null = isConfigured ? createClient(url, key) : null;

export type JoinResult =
  | { ok: true; alreadyJoined: boolean }
  | { ok: false; message: string };

export async function joinWaitlist(email: string, source = 'landing'): Promise<JoinResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, message: 'Enter an email address.' };

  if (!client) {
    return { ok: false, message: "The waitlist isn't connected yet. Try again shortly." };
  }

  const { error } = await client.from('waitlist').insert({ email: trimmed, source });

  if (error) {
    // 23505 is the unique violation on email. Being on the list twice is not a
    // failure worth reporting as one.
    if (error.code === '23505') return { ok: true, alreadyJoined: true };
    return { ok: false, message: "That didn't save. Try again in a moment." };
  }
  return { ok: true, alreadyJoined: false };
}
