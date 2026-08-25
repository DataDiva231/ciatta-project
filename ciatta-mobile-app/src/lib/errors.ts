/**
 * Distinguishes "this session is genuinely dead" from "the network is having
 * a moment".
 *
 * The load path used to sign the user out on *any* failure, which meant a
 * dropped connection at launch ejected her from her account. Signing out is
 * destructive and unrecoverable without her password, so the default here is
 * deliberately conservative: only report an auth failure when we can
 * positively identify one. Anything ambiguous is treated as transient and
 * gets a retry instead.
 */
export function isAuthFailure(e: unknown): boolean {
  const err = e as { code?: string; status?: number; message?: string } | null;
  if (!err) return false;

  // PGRST303 ("JWT issued at future") is a clock-skew condition, not a dead
  // session — sessionGuard.withClockSkewRetry already gives it a refresh
  // and a retry before anything gets here. Excluded explicitly so it can
  // never fall through the "jwt" substring check below and trigger a
  // sign-out for what's usually a few seconds of timing noise.
  if (err.code === 'PGRST303') return false;

  if (err.status === 401 || err.status === 403) return true;

  // PGRST301: JWT expired / invalid. PGRST116: no row returned, which for the
  // profile fetch means the account row is gone.
  if (err.code === 'PGRST301' || err.code === 'PGRST116') return true;

  const msg = (err.message ?? '').toLowerCase();
  if (!msg) return false;

  if (msg.includes('issued at future') || msg.includes('issued in the future')) return false;

  // A network failure can also mention "fetch", so check auth wording first
  // and bail out on anything that smells like connectivity.
  if (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection')
  ) {
    return false;
  }

  return (
    msg.includes('jwt') ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('not authenticated') ||
    msg.includes('unauthorized')
  );
}
