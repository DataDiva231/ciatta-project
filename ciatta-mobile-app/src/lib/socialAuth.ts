import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

/**
 * Thrown when the user backs out of the native sheet themselves. Callers
 * should swallow this rather than showing an error — a deliberate cancel
 * isn't a failure.
 */
export class SocialAuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialAuthCancelled';
  }
}

/**
 * Writes the provider-supplied name onto the profile, but never clobbers a
 * name the user already set — Apple only offers this on first authorization,
 * so it's a seed value, not a source of truth.
 */
export async function seedProfileName(fullName: string) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();
  if (existing?.name) return;

  await supabase.from('profiles').update({ name: fullName }).eq('id', userId);
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  // webClientId is what Supabase validates the ID token against, so it's
  // required on both platforms — iosClientId only affects which native
  // credential the iOS SDK requests.
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Native Sign in with Apple. Apple only returns the user's name on the very
 * first authorization for a given Apple ID — never again, even after the app
 * is deleted and reinstalled — so we persist it to the profile immediately
 * rather than assuming it can be re-fetched later.
 */
export async function signInWithApple() {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SocialAuthCancelled();
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return { session: data.session, fullName: fullName || null };
}

/** Native Google sign-in, exchanged for a Supabase session via ID token. */
export async function signInWithGoogle() {
  configureGoogle();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // v13+ returns a discriminated {type, data} envelope; older shapes put the
    // user object at the top level. Handle both so a minor bump doesn't break
    // sign-in silently.
    const idToken =
      (response as { data?: { idToken?: string | null } }).data?.idToken ??
      (response as { idToken?: string | null }).idToken ??
      null;

    if (!idToken) {
      // The v13 envelope uses type: 'cancelled' instead of throwing.
      if ((response as { type?: string }).type === 'cancelled') {
        throw new SocialAuthCancelled();
      }
      throw new Error('Google did not return an ID token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;

    const user = (response as { data?: { user?: { name?: string | null } } }).data?.user;
    return { session: data.session, fullName: user?.name?.trim() || null };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
      throw new SocialAuthCancelled();
    }
    throw e;
  }
}
