'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { identifyPersonFromEmailClickNative } from '@/app/actions/identity-bridge'
import { postedSession } from '@/lib/analytics/visitor-session'
import { getStoredConsent } from './CookieConsentBanner'
import { gpcFromNavigator, trackingLevelFromConsent } from '@/lib/identity/consent'

const LEGACY_EMAIL_CLICK_PARAM = '_fuid'
const NATIVE_EMAIL_CLICK_PARAM = '_pid'
/** Read by components/VisitTracker.tsx (takeArrivalToken) when the URL is already clean. */
const PID_STASH_KEY = 'rr_pid_token'

/**
 * How long the bridge waits for VisitTracker's first post before it identifies with
 * no session id. VisitTracker is loaded lazily after hydration and posts at once, so
 * this is only reached on a page it records nothing on.
 */
export const IDENTIFY_WAIT_MS = 10_000

/**
 * Runs once on load when the URL carries an identity param from a link we sent.
 *
 * P7 identity loop (2026-09-23): `?_pid=` is a SIGNED person token
 * (lib/identity/link-token.ts). The primary identification happens server-side
 * in /api/visitors/track, which reads the token off the landing page view. This
 * bridge:
 *   1. stashes the token so the tracker can still forward it if the address bar
 *      is cleaned before the tracker posts;
 *   2. waits for VisitTracker's first post of the page to settle and calls the
 *      identify action, as a second path, with the session that post landed in
 *      (postedSession). The click can END the session in storage (a new campaign,
 *      30 minutes idle, an id from before the rule), and the lazily loaded tracker
 *      starts the new one with that post, so the id in storage at mount is the visit
 *      before this one: identified at mount, the action stamped that old session,
 *      read ITS automation flag, and skipped the retry meant for the click's own
 *      session (review of 2026-09-30). The public/rr-doc-tracker.js document tracker
 *      does the same: its identify ping follows its own page view. On a page the
 *      tracker records nothing on, no post comes, and after IDENTIFY_WAIT_MS the
 *      action is called with no session id (it still cookies and stitches the browser).
 *      The action verifies the signature, re-checks the contact exists, honors GPC
 *      and a cookie decline, and refuses automation: navigator.webdriver goes with
 *      the call;
 *   3. removes the identity params from the address bar once the tracker has read
 *      them, so they are never bookmarked, shared or copied.
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

    // The one mapping (lib/identity/consent.ts): declined is never re-derived here.
    const declined = trackingLevelFromConsent(getStoredConsent()) === 'declined'
    const gpc = gpcFromNavigator(navigator)
    if (!nativeValue || declined || gpc) {
      clean()
      return
    }

    try {
      sessionStorage.setItem(PID_STASH_KEY, nativeValue.slice(0, 120))
    } catch {
      /* the URL still carries it for the tracker's first post */
    }
    void (async () => {
      const sessionId = await postedSession(IDENTIFY_WAIT_MS)
      clean()
      try {
        const res = await identifyPersonFromEmailClickNative(nativeValue, sessionId ?? undefined, { webdriver: navigator.webdriver === true })
        // Tell the analytics bridge to re-sync GA4 user_id + Meta Pixel
        // advanced matching now that rr_pid is freshly stamped.
        if (res.ok) window.dispatchEvent(new CustomEvent('person-identified'))
      } catch {
        /* the track route's own identification stands */
      }
    })()
  }, [searchParams])

  return null
}
