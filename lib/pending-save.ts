/**
 * Pending-save resume (RC7 consumer funnel).
 *
 * A logged-out visitor who clicks "Save" stays on this page. The Google
 * continue sheet opens here. Without the stash, the save intent is lost after
 * sign-in. Every save control stashes the listing and resumes it
 * (useResumePendingSave) so the save completes once.
 *
 * sessionStorage is tab+origin scoped, so the flag survives the OAuth round-trip
 * back to our origin. Private mode / storage-denied degrades gracefully (no
 * resume, but the redirect still works).
 */

import { RR_OPEN_SIGNIN, RR_OPEN_SIGNIN_FLAG } from '@/lib/auth/google-gis'

const PENDING_SAVE_KEY = 'rr_pending_save_listing'

/** Remember which listing the visitor intended to save, before bouncing to login. */
export function stashPendingSave(listingKey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PENDING_SAVE_KEY, listingKey)
  } catch {
    /* storage denied — resume won't fire, redirect still works */
  }
}

/**
 * If `listingKey` is the pending save, clear the flag and return true (the caller
 * should complete the save). Returns false otherwise. Idempotent: the flag is
 * consumed on the first matching call so a save fires once.
 */
export function consumePendingSave(listingKey: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.sessionStorage.getItem(PENDING_SAVE_KEY) !== listingKey) return false
    window.sessionStorage.removeItem(PENDING_SAVE_KEY)
    return true
  } catch {
    return false
  }
}

/** Stash the intent and open the on-page Google continue sheet. Stay here. */
export function redirectToLoginForSave(listingKey: string): void {
  if (typeof window === 'undefined') return
  stashPendingSave(listingKey)
  try {
    window.sessionStorage.setItem(RR_OPEN_SIGNIN_FLAG, '1')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(RR_OPEN_SIGNIN, { detail: { listingKey } }))
}
