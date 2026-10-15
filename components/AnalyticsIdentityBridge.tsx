'use client'

import { useEffect, useRef } from 'react'
import { rememberClarityUserId } from '@/lib/analytics/clarity'
import { hasAnalyticsConsent } from './CookieConsentBanner'

/**
 * Bridges identified-visitor state into GA4 and Meta Pixel.
 *
 * On mount, fetches /api/identity/me. If the visitor is known (either via
 * the rr_pid cookie or a signed-in session), this component:
 *
 *   1. Sets GA4 `user_id` via gtag('set'), never gtag('config'), which
 *      would fire a second page_view on top of the GTM Google tag. Only at
 *      the analytics tier (hasAnalyticsConsent), the rule the server follows
 *      (lib/analytics/ga4-user-id.ts); cleared if the banner turns it off.
 *   2. Re-initializes Meta Pixel with advanced matching via
 *      fbq('init', PIXEL_ID, { em: <sha256> }).
 *   3. Hands the same hashed user_id to Microsoft Clarity's identify
 *      (lib/analytics/clarity.ts), so Matt can filter recordings to a known
 *      contact. Only the hash; Clarity is called only while it is recording.
 *
 * Waits up to 3s for window.gtag / window.fbq (both gate on cookie consent).
 * Ad-blockers are honored: if either global never appears, it no-ops.
 *
 * Identity flips during a session, for example an anonymous visitor
 * clicks an email-click link mid-session and identifyPersonFromEmailClick
 * sets rr_pid. The bridge listens for `person-identified` window events so
 * it re-fetches /api/identity/me without a page reload and updates GA4 +
 * Meta Pixel immediately.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

type IdentityPayload = {
  identified: boolean
  hashedUserId: string | null
  hashedEmail: string | null
  personId: number | null
}

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim()
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

async function waitForGlobal<T>(getter: () => T | undefined, maxMs = 3000, stepMs = 250): Promise<T | undefined> {
  const start = Date.now() // hydration-safe: called only from the mount effect's async identity sync
  while (Date.now() - start < maxMs) { // hydration-safe: same, never during render
    const v = getter()
    if (v) return v
    await new Promise((r) => setTimeout(r, stepMs))
  }
  return getter()
}

async function fetchIdentity(): Promise<IdentityPayload | null> {
  try {
    const res = await fetch('/api/identity/me', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as IdentityPayload
  } catch {
    return null
  }
}

/**
 * Point every later GA4 hit at this user id, or at none. The GTM Google tag
 * applies a gtag('set') command to the hits after it (GA4 read 2026-10-14: the
 * id rode on session_start and user_engagement); the dataLayer key is kept for
 * any GTM variable that reads it.
 */
function setGa4UserId(gtag: (...args: unknown[]) => void, userId: string | null): void {
  // set, not a second measurement-id config: that would fire another page_view.
  gtag('set', { user_id: userId })
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ user_id: userId ?? undefined })
}

async function applyIdentity(payload: IdentityPayload): Promise<void> {
  // The same hashed id GA4 gets as user_id; never an email, name or phone.
  // An unknown visitor (a sign-out, another person on the device) clears it.
  rememberClarityUserId(payload.identified ? payload.hashedUserId : null)
  if (!payload.identified) return

  // An essential-tier visit reaches GA4 under an anonymous client id and
  // nothing else (docs/TRACKING_POLICY.md tier table), browser or server.
  if (GA4_ID && payload.hashedUserId && hasAnalyticsConsent()) {
    const gtag = await waitForGlobal(() => window.gtag)
    if (gtag) setGa4UserId(gtag, payload.hashedUserId)
  }

  if (PIXEL_ID && payload.hashedEmail) {
    const fbq = await waitForGlobal(() => window.fbq)
    if (fbq) {
      // Meta Pixel supports re-init with additional advanced-matching
      // params. After this call, every subsequent fbq('track', ...) carries
      // the hashed email so Meta can stitch the conversion to a person.
      fbq('init', PIXEL_ID, { em: payload.hashedEmail })
    }
  }
}

export default function AnalyticsIdentityBridge() {
  const fired = useRef(false)
  const lastHashRef = useRef<string | null>(null)
  const lastPayloadRef = useRef<IdentityPayload | null>(null)

  useEffect(() => {
    let cancelled = false

    async function syncOnce() {
      const payload = await fetchIdentity()
      if (cancelled || !payload) return
      // De-dupe: skip the apply step if the identity hasn't changed since
      // the last fire (e.g. a second person-identified event from another tab).
      const sig = `${payload.hashedUserId ?? ''}|${payload.hashedEmail ?? ''}`
      if (sig === lastHashRef.current) return
      lastHashRef.current = sig
      lastPayloadRef.current = payload
      await applyIdentity(payload)
      fired.current = true
    }

    void syncOnce()

    // Re-sync when identity flips mid-session. Browser events fired by
    // PersonIdentityBridge + auth callbacks. Listening here keeps the bridge
    // accurate without a page reload.
    const handler = () => { void syncOnce() }
    window.addEventListener('person-identified', handler)
    window.addEventListener('auth-state-changed', handler)

    // The banner answer changed mid-page: tag the known visitor once analytics
    // is on, and drop the id the moment it is off.
    const onConsent = () => {
      const userId = lastPayloadRef.current?.hashedUserId
      if (!GA4_ID || !userId || typeof window.gtag !== 'function') return
      setGa4UserId(window.gtag, hasAnalyticsConsent() ? userId : null)
    }
    window.addEventListener('cookie-consent', onConsent)

    return () => {
      cancelled = true
      window.removeEventListener('person-identified', handler)
      window.removeEventListener('auth-state-changed', handler)
      window.removeEventListener('cookie-consent', onConsent)
    }
  }, [])

  return null
}
