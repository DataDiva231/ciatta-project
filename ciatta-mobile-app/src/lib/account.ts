import { Share } from 'react-native';
import { supabase } from './supabase';
import { signOut } from './auth';

const EXPORT_TABLES = [
  'profiles',
  'observations',
  'evidence',
  'understandings',
  'understanding_history',
  'relationships',
  'discoveries',
  'curiosities',
] as const;

/**
 * Fetches everything RLS allows this user to read across every table and
 * bundles it into one JSON document. No service_role involved — this runs
 * entirely as the signed-in user, so it can only ever export their own
 * data, the same guarantee RLS already gives every other read in the app.
 */
export async function fetchUserDataExport(userId: string): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
  };

  for (const table of EXPORT_TABLES) {
    const query =
      table === 'profiles'
        ? supabase.from(table).select('*').eq('id', userId)
        : supabase.from(table).select('*').eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    results[table] = data ?? [];
  }

  return results;
}

/**
 * Fetches the export and opens the native share sheet with it as JSON
 * text — no new native dependencies (expo-file-system/expo-sharing would
 * need a new EAS build); React Native's built-in Share API already ships
 * in the current dev client and covers this comfortably at realistic data
 * volumes.
 */
export async function exportAndShareUserData(userId: string): Promise<void> {
  const data = await fetchUserDataExport(userId);
  const json = JSON.stringify(data, null, 2);
  await Share.share({
    message: json,
    title: 'Your data export',
  });
}

/**
 * Permanently deletes the signed-in user's account and everything that
 * belongs to it (server-side cascade — see the delete-account function).
 * Irreversible. Signs the local session out immediately after, since the
 * account backing it no longer exists.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await signOut();
}
