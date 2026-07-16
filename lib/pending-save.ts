/**
 * Pending-save resume (RC7 consumer funnel).
 *
 * A logged-out visitor who clicks "Save" on a listing is bounced to
 * /login?next=<page>. Without this, the save intent is lost — they return signed
 * in but the listing isn't saved, and the save→account→lead-capture path silently
 * drops. Every save control stashes the intended listing before redirecting, and
 * every save control resumes it on return (via useResumePendingSave), so the save
 * completes itself exactly once.
 *
 * sessionStorage is tab+origin scoped, so the flag survives the OAuth round-trip
 * back to our origin. Private mode / storage-denied degrades gracefully (no
 * resume, but the redirect still works).
 */

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

/** Stash the intent and send an anonymous saver to sign-in, returning to this page. */
export function redirectToLoginForSave(listingKey: string): void {
  if (typeof window === 'undefined') return
  stashPendingSave(listingKey)
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.href = `/login?next=${returnUrl}`
}
