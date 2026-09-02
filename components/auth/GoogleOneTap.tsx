'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { renderGoogleButton } from '@/lib/auth/google-gis'

/**
 * The official Google-rendered "Continue with Google" control (Google
 * Identity Services) — swapped in wherever a sign-in surface used to hand-roll
 * a lookalike button. Renders `fallback` (the caller's redirect-based button)
 * when `clientId` is unset, when the GIS script fails to load, or when GIS
 * renders but never sizes its iframe — observed live 2026-09-01: a browser
 * with no Google session in FedCM cooldown gets an iframe pinned at 0x0, which
 * without this watchdog left the save-gate modal with no Google door at all.
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
  fallback = null,
}: {
  clientId: string | null
  onCredential: (rawNonce: string, credential: string) => void
  /** Also fire the One Tap avatar "Continue as <name>" prompt alongside the
   * button. Use on a standalone sign-in page; leave false on a surface that
   * already ran its own silent One Tap attempt before this button mounted
   * (the save-gate modal fallback). */
  prompt?: boolean
  className?: string
  /** Rendered instead when GIS is unavailable or its button never becomes
   * visible, so a Google sign-in door always exists. */
  fallback?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!clientId || failed || !ref.current) return
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
        if (!cancelled) setFailed(true) // GIS script failed to load
      })
    // Watchdog: GIS can create the button iframe and leave it 0x0 forever
    // (its own resize message never arrives). If no visibly sized iframe
    // exists after the grace period, fall back to the redirect button.
    const watchdog = window.setTimeout(() => {
      if (cancelled) return
      if (el.offsetHeight < 10) setFailed(true)
    }, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      cancelGis?.()
    }
  }, [clientId, prompt, failed])

  if (!clientId || failed) return <>{fallback}</>
  return <div ref={ref} className={className} />
}
