'use client'

import { useEffect, useRef } from 'react'

/**
 * Bridges identified-visitor state into GA4 and Meta Pixel.
 *
 * On mount, fetches /api/identity/me. If the visitor is known (either via
 * the rr_pid cookie or a signed-in session), this component:
 *
 *   1. Sets GA4 `user_id` via gtag('config', GA4_ID, { user_id: <hash> })
 *      (unlocks GA4 User Explorer + cross-device User reports).
 *   2. Re-initializes Meta Pixel with advanced matching via
 *      fbq('init', PIXEL_ID, { em: <sha256> }) (strengthens Meta's
 *      person-stitch for ad attribution).
 *
 * Waits up to 3s for window.gtag / window.fbq to be loaded by the
 * <GoogleAnalytics /> and <MetaPixel /> components (both of which gate on
 * cookie consent). Ad-blockers are honored automatically: if either global
 * never appears, the bridge silently no-ops.
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
  const start = Date.now()
  while (Date.now() - start < maxMs) {
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

async function applyIdentity(payload: IdentityPayload): Promise<void> {
  if (!payload.identified) return

  if (GA4_ID && payload.hashedUserId) {
    const gtag = await waitForGlobal(() => window.gtag)
    if (gtag) {
      // gtag('config') with user_id stamps every subsequent event on this
      // page with the user_id. Same effect as gtag('set', { user_id }).
      gtag('config', GA4_ID, { user_id: payload.hashedUserId })
    }
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

    return () => {
      cancelled = true
      window.removeEventListener('person-identified', handler)
      window.removeEventListener('auth-state-changed', handler)
    }
  }, [])

  return null
}
