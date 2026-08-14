'use server'

/**
 * Retired. /admin/expired-outreach redirects to /admin/prospecting.
 * Cold SMS is sendProspectingIntro only. These names stay so a stale
 * import cannot compile against a missing export — they refuse.
 */

import { retiredProspectingSendError } from '@/lib/prospecting/retired-send'

export type ExpiredSendResult = { ok: true; sid: string } | { ok: false; error: string }

export async function sendExpiredIntroAction(_listingKey: string): Promise<ExpiredSendResult> {
  return retiredProspectingSendError()
}

export async function previewExpiredIntroAction(
  _listingKey: string,
): Promise<{ body: string | null; error: string | null }> {
  return { body: null, error: retiredProspectingSendError().error }
}
