'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { identifyPersonFromEmailClickNative } from '@/app/actions/identity-bridge'
import { readRrSessionId } from '@/lib/tracking'
import { getStoredConsent } from './CookieConsentBanner'

const LEGACY_EMAIL_CLICK_PARAM = '_fuid'
const NATIVE_EMAIL_CLICK_PARAM = '_pid'
/** Read by components/VisitTracker.tsx (takeArrivalToken) when the URL is already clean. */
const PID_STASH_KEY = 'rr_pid_token'

/**
 * Runs once on load when the URL carries an identity param from a link we sent.
 *
 * P7 identity loop (2026-09-23): `?_pid=` is a SIGNED person token
 * (lib/identity/link-token.ts). The primary identification happens server-side
 * in /api/visitors/track, which reads the token off the landing page view. This
 * bridge:
 *   1. stashes the token so the tracker can still forward it if this effect
 *      cleans the address bar before the tracker posts;
 *   2. calls the identify action as a second path (it verifies the signature,
 *      re-checks the contact exists, honors GPC and a cookie decline);
 *   3. removes the identity params from the address bar so they are never
 *      bookmarked, shared or copied.
 *
 * `?_fuid=` (the retired vendor CRM id) is only cleaned: an unsigned id
 * identifies nobody. A declined banner answer skips identification entirely.
 */
export default function PersonIdentityBridge() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const nativeValue = searchParams.get(NATIVE_EMAIL_CLICK_PARAM)
    const legacyValue = searchParams.get(LEGACY_EMAIL_CLICK_PARAM)
    if (!nativeValue && !legacyValue) return
    done.current = true

    const clean = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete(NATIVE_EMAIL_CLICK_PARAM)
      url.searchParams.delete(LEGACY_EMAIL_CLICK_PARAM)
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }

    const stored = getStoredConsent()
    const declined = stored !== null && !stored.analytics && !stored.marketing
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    if (!nativeValue || declined || gpc) {
      clean()
      return
    }

    try {
      sessionStorage.setItem(PID_STASH_KEY, nativeValue.slice(0, 120))
    } catch {
      /* the URL still carries it for the tracker's first post */
    }
    identifyPersonFromEmailClickNative(nativeValue, readRrSessionId())
      .then((res) => {
        clean()
        // Tell the analytics bridge to re-sync GA4 user_id + Meta Pixel
        // advanced matching now that rr_pid is freshly stamped.
        if (res.ok) window.dispatchEvent(new CustomEvent('person-identified'))
      })
      .catch(clean)
  }, [searchParams])

  return null
}
