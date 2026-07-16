'use client'

import { useEffect, useRef } from 'react'
import { consumePendingSave } from '@/lib/pending-save'

/**
 * Completes a pending save on return from sign-in (RC7). On mount, if this listing
 * was the intent stashed before the login bounce AND it isn't already saved, run
 * `resume` once. The ref + consume-on-first-match guard against a double-fire
 * (React StrictMode double-invokes effects in dev).
 *
 * Used by every save control so a save survives the login round-trip no matter
 * where the visitor clicked it.
 */
export function useResumePendingSave(opts: {
  listingKey: string
  alreadySaved: boolean
  resume: () => void | Promise<void>
}): void {
  const { listingKey, alreadySaved, resume } = opts
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    // Consume the flag whenever it names THIS listing — even if the page already
    // renders it saved (a prior save the server cached) — so a stale intent never
    // lingers into a later visit. Only run the resume when it isn't saved yet.
    if (!consumePendingSave(listingKey)) return
    ran.current = true
    if (alreadySaved) return
    void resume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySaved, listingKey])
}
