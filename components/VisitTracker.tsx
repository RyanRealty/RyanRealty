'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackVisit } from '@/app/actions/track-visit'
import { trackReturnVisitAction } from '@/app/actions/track-return-visit'
import { hasTrackingConsent, getOrCreateVisitId } from './CookieConsentBanner'

const FUB_LAST_VISIT_KEY = 'fub_last_visit'
const RETURN_VISIT_MS = 24 * 60 * 60 * 1000

function getFubLastVisit(): number | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${FUB_LAST_VISIT_KEY}=([^;]+)`))
  const val = match?.[1]
  if (!val) return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : null
}

function setFubLastVisit(): void {
  if (typeof document === 'undefined') return
  const maxAge = 30 * 24 * 60 * 60
  document.cookie = `${FUB_LAST_VISIT_KEY}=${Date.now()}; path=/; max-age=${maxAge}; SameSite=Lax`
}

type Props = { userId?: string | null; userEmail?: string | null }

export default function VisitTracker({ userId, userEmail }: Props) {
  const pathname = usePathname()
  const tracked = useRef<string | null>(null)
  const returnTracked = useRef(false)

  useEffect(() => {
    if (!hasTrackingConsent()) return
    const visitId = getOrCreateVisitId()
    if (!visitId || !pathname) return
    const key = pathname + (userId ?? 'anon')
    if (tracked.current === key) return
    tracked.current = key
    trackVisit({
      visitId,
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      userId: userId ?? undefined,
    })
  }, [pathname, userId])

  useEffect(() => {
    if (!hasTrackingConsent() || !userEmail?.trim() || !pathname) return
    const now = Date.now()
    const last = getFubLastVisit()
    const isReturn = last == null || now - last >= RETURN_VISIT_MS
    setFubLastVisit()
    if (isReturn && !returnTracked.current) {
      returnTracked.current = true
      const pageUrl = typeof window !== 'undefined' ? window.location.href : pathname
      const pageTitle = typeof document !== 'undefined' ? document.title : undefined
      trackReturnVisitAction({ userEmail: userEmail.trim(), pageUrl, pageTitle })
    }
  }, [pathname, userEmail])

  useEffect(() => {
    const onConsent = () => {
      if (hasTrackingConsent() && pathname) {
        const visitId = getOrCreateVisitId()
        if (visitId) {
          trackVisit({
            visitId,
            path: pathname,
            referrer: document.referrer || undefined,
            userAgent: navigator.userAgent,
            userId: userId ?? undefined,
          })
        }
      }
    }
    window.addEventListener('cookie-consent', onConsent)
    return () => window.removeEventListener('cookie-consent', onConsent)
  }, [pathname, userId])

  return null
}
