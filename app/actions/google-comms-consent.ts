'use server'

import { cookies } from 'next/headers'
import {
  GOOGLE_COMMS_COOKIE,
  googleCommsCookieSetOptions,
  serializeGoogleCommsConsent,
  type GoogleCommsConsent,
} from '@/lib/auth/google-comms-consent'

/** Persist comms-door choices across the Google OAuth redirect. */
export async function persistGoogleCommsConsent(
  input: GoogleCommsConsent,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const store = await cookies()
    store.set(
      GOOGLE_COMMS_COOKIE,
      serializeGoogleCommsConsent({
        emailOpt: input.emailOpt === true,
        smsOpt: input.smsOpt === true,
        phone: input.phone ?? '',
      }),
      googleCommsCookieSetOptions(),
    )
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not save preferences' }
  }
}
