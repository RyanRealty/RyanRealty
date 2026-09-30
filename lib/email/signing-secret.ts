/**
 * The HMAC secret every email-link token in lib/email signs with.
 *
 * Same chain as lib/email-tracking.ts and lib/identity/link-token.ts:
 * EMAIL_TRACKING_SECRET, then CMA_PREVIEW_SECRET, then the service-role key.
 * When none is set the chain lands on a public development string, and a token
 * signed with a public string is forgeable: anyone could mint the one-click
 * unsubscribe of any contact, or open any contact's report preferences. So in
 * production this refuses, loudly, rather than signing or verifying with it.
 *
 * Resolved at call time, never at module load: a module-level constant froze
 * the value before Vercel's env was read in some runtimes, and it made the
 * production guard impossible to unit-test.
 */
import 'server-only'

/** The public development fallback. Never valid in production. */
export const INSECURE_DEV_SECRET = 'insecure-dev-secret'

export class MissingSigningSecretError extends Error {
  constructor(scope: string) {
    super(
      `[${scope}] refusing to sign or verify with the insecure development secret in production. ` +
        'Set EMAIL_TRACKING_SECRET (or CMA_PREVIEW_SECRET) in the Vercel environment.',
    )
    this.name = 'MissingSigningSecretError'
  }
}

/**
 * The secret for email-link tokens. Throws MissingSigningSecretError in
 * production when only the public fallback is available (fail closed).
 */
export function emailSigningSecret(scope: string): string {
  const secret =
    process.env.EMAIL_TRACKING_SECRET ||
    process.env.CMA_PREVIEW_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    INSECURE_DEV_SECRET
  if (secret === INSECURE_DEV_SECRET && process.env.NODE_ENV === 'production') {
    throw new MissingSigningSecretError(scope)
  }
  return secret
}
