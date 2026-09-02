'use client'

import { useEffect, useRef } from 'react'
import { renderGoogleButton } from '@/lib/auth/google-gis'

/**
 * The official Google-rendered "Continue with Google" control (Google
 * Identity Services) — swapped in wherever a sign-in surface used to hand-roll
 * a lookalike button. Renders nothing when `clientId` is unset (GIS is not
 * configured); callers keep their existing redirect-based fallback for that
 * case, so sign-in never breaks on a missing env var.
 *
 * `onCredential` is read through a ref so a new function identity on every
 * parent render (a very common shape — e.g. useCallback closing over
 * changing local state) does not re-run GIS init / re-draw the button.
 */
export default function GoogleOneTap({
  clientId,
  onCredential,
  prompt = false,
  className = 'flex w-full justify-center',
}: {
  clientId: string | null
  onCredential: (rawNonce: string, credential: string) => void
  /** Also fire the One Tap avatar "Continue as <name>" prompt alongside the
   * button. Use on a standalone sign-in page; leave false on a surface that
   * already ran its own silent One Tap attempt before this button mounted
   * (the save-gate modal fallback). */
  prompt?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false
    let cancelGis: (() => void) | null = null
    const el = ref.current
    const measuredWidth = Math.round(el.offsetWidth)
    const width = measuredWidth > 0 ? Math.min(400, Math.max(220, measuredWidth)) : 320
    renderGoogleButton({
      clientId,
      buttonEl: el,
      onCredential: (rawNonce, credential) => onCredentialRef.current(rawNonce, credential),
      prompt,
      options: { width },
    })
      .then((cancel) => {
        if (cancelled) cancel()
        else cancelGis = cancel
      })
      .catch(() => {
        /* GIS failed to load — caller's redirect fallback still renders */
      })
    return () => {
      cancelled = true
      cancelGis?.()
    }
  }, [clientId, prompt])

  if (!clientId) return null
  return <div ref={ref} className={className} />
}
