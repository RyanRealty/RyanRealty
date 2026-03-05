'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackVisit } from '@/app/actions/track-visit'
import { hasTrackingConsent, getOrCreateVisitId } from './CookieConsentBanner'

type Props = { userId?: string | null }

export default function VisitTracker({ userId }: Props) {
  const pathname = usePathname()
  const tracked = useRef<string | null>(null)

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
