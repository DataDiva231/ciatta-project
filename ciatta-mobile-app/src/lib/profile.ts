import { supabase } from './supabase';
import type { Profile, ProfileDraft } from './types';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(userId: string, draft: ProfileDraft): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(draft)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
