'use client'

import { useEffect, useRef } from 'react'
import { consumePendingSave, stashPendingSave } from '@/lib/pending-save'
import { resumeSaveListing } from '@/app/actions/saved-listings'

/**
 * Completes a pending save on return from sign-in (RC7). The hook OWNS the save so
 * no call site can get it wrong (an earlier version let callers pass a blind
 * toggle, which could silently UN-save a listing whose card prop was stale-false):
 *
 *  - Idempotent add only — via resumeSaveListing, never a toggle, so a stale
 *    "not saved" client state can never remove an already-saved listing.
 *  - Auth-honest — if the session isn't established yet (e.g. the user hit Back to
 *    the page while still logged out), the intent is RE-STASHED so the real save
 *    resumes on the next return, instead of being consumed with a false "Saved".
 *  - Fires exactly once per mount (ref + consume-on-first-match guard StrictMode).
 *
 * The caller supplies `onSaved` to reflect the save in local UI + fire the same
 * analytics/lead-capture a manual save fires. It is called only on a real save.
 */
export function useResumePendingSave(opts: {
  listingKey: string
  alreadySaved: boolean
  onSaved: () => void
}): void {
  const { listingKey, alreadySaved, onSaved } = opts
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    // Consume whenever the flag names THIS listing — even if it already renders
    // saved (an ISR-cached prior save) — so a stale intent never lingers.
    if (!consumePendingSave(listingKey)) return
    ran.current = true
    if (alreadySaved) return
    void (async () => {
      const res = await resumeSaveListing(listingKey)
      if (res.needsAuth) {
        stashPendingSave(listingKey) // still logged out — try again on the next return
        return
      }
      if (res.saved) onSaved()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySaved, listingKey])
}
