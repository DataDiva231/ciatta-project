import { supabase } from './supabase';

/**
 * PGRST303 — PostgREST's "JWT issued at future" check. Unlike an expired or
 * malformed token (PGRST301), this is a clock/timing condition, not proof
 * the session is dead: a refresh mints a new token and almost always
 * resolves it. Kept separate from isAuthFailure (errors.ts) specifically so
 * this never triggers a sign-out — that used to happen because
 * isAuthFailure's blanket "message contains 'jwt'" check also matched this.
 */
export function isClockSkewError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === 'PGRST303') return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('issued at future') || msg.includes('issued in the future');
}

// Hermes has no built-in atob/Buffer, and this project polyfills neither
// (react-native-url-polyfill covers URL/URLSearchParams only) — so this is
// a minimal, dependency-free base64 decoder, used only to read a JWT's
// payload locally for diagnostics. Never used to verify or trust anything.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): string {
  const clean = input.replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let output = '';
  for (const char of clean) {
    const idx = BASE64_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return output;
}

/** Decodes a JWT's payload without verifying it — only ever used locally to
 * read `iat`/`exp` for diagnostics, never to trust or authorize anything. */
function decodeJwtPayload(token: string): { iat?: number; exp?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const raw = base64Decode(base64);
    const json = decodeURIComponent(
      raw
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Dev-only diagnostic: logs the session's JWT `iat` against this device's
 * own clock, and the difference in seconds — never the token itself. A
 * large positive diff means the token claims to have been issued after
 * "now" as this device sees it, which is the condition PGRST303 checks for
 * server-side (there against PostgREST's clock, not this device's).
 */
export function logSessionClockSkew(accessToken: string | null | undefined, label: string) {
  if (!__DEV__ || !accessToken) return;
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.iat) return;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = payload.iat - nowSeconds;
  const flag = diff > 5 ? ' — iat is ahead of this device\'s clock' : '';
  console.log(`[auth] ${label}: jwt iat=${payload.iat} device_now=${nowSeconds} diff=${diff}s${flag}`);
}

/**
 * Runs `fn`; if it fails with a PGRST303 clock-skew error, refreshes the
 * Supabase session once and retries `fn` once. Anything else — including a
 * failed retry — is rethrown for the caller to handle (loadUserData treats
 * a still-failing request as "couldn't reach data," not as a reason to sign
 * out). Every step is logged in dev so a genuine, persistent Supabase-side
 * skew is visible rather than silently retried away.
 */
export async function withClockSkewRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isClockSkewError(e)) throw e;

    if (__DEV__) {
      console.log(`[auth] ${label}: PGRST303 (JWT issued at future) — refreshing session and retrying once`);
    }
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (__DEV__) {
      console.log(
        `[auth] ${label}: refresh ${refreshError ? 'failed — ' + refreshError.message : 'succeeded'}`
      );
      logSessionClockSkew(data?.session?.access_token, `${label} (post-refresh)`);
    }
    // Nothing to retry with — surface the original PGRST303 rather than a
    // confusing secondary refresh error.
    if (refreshError) throw e;

    try {
      const result = await fn();
      if (__DEV__) console.log(`[auth] ${label}: retry succeeded`);
      return result;
    } catch (retryError) {
      if (__DEV__) console.log(`[auth] ${label}: retry also failed —`, retryError);
      throw retryError;
    }
  }
}
