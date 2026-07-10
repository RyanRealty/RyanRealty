'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'
const CONSENT_EXPIRY_YEARS = 1

export type ConsentState = { analytics: boolean; marketing: boolean }

/** The stored consent choice, or null when the visitor has not answered the
 *  banner yet. Callers that need to distinguish "no choice" (functional
 *  essential tracking allowed) from an explicit decline use this instead of
 *  the boolean getters. */
export function getStoredConsent(): ConsentState | null {
  return getConsent()
}

function getConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith(COOKIE_CONSENT_KEY + '='))
    ?.split('=')[1]
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as ConsentState
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) }
  } catch {
    if (raw === 'all') return { analytics: true, marketing: true }
    return { analytics: false, marketing: false }
  }
}

function setConsentState(state: ConsentState) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + CONSENT_EXPIRY_YEARS)
  document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(JSON.stringify(state))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
}

export function hasTrackingConsent(): boolean {
  const c = getConsent()
  return c !== null && c.analytics && c.marketing
}

export function hasAnalyticsConsent(): boolean {
  const c = getConsent()
  return c !== null && c.analytics
}

export function hasMarketingConsent(): boolean {
  const c = getConsent()
  return c !== null && c.marketing
}

/**
 * Aggressive ad-traffic consent (Matt directive 2026-06-02): a visitor arriving
 * from a paid/marketing click (fbclid / gclid / msclkid / ttclid / any utm_*)
 * who has NOT yet made an explicit consent choice gets analytics+marketing
 * auto-granted, so first-party behavioral intent tracking (visitor_events
 * scoring -> hot-lead alerts) fires on the same page load. Does NOT override an
 * explicit prior decision (essential-only / declined are respected). Returns
 * true if it just granted consent.
 */
export function autoGrantConsentForAdTraffic(): boolean {
  if (typeof window === 'undefined') return false
  if (getConsent() !== null) return false // explicit prior choice — respect it
  const qs = new URLSearchParams(window.location.search || '')
  const fromAd =
    qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid') ||
    [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  if (!fromAd) return false
  setConsentState({ analytics: true, marketing: true })
  try { window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' })) } catch {}
  return true
}

export function getOrCreateVisitId(): string | null {
  if (typeof document === 'undefined') return null
  const name = 'ryan_realty_visit_id'
  const existing = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1]
  if (existing) return existing
  const id = crypto.randomUUID?.() ?? `v_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${id}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  return id
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(true)

  useEffect(() => {
    const consent = getConsent()
    if (consent === null) setVisible(true)
    else {
      setAnalytics(consent.analytics)
      setMarketing(consent.marketing)
    }
  }, [])

  function acceptAll() {
    setConsentState({ analytics: true, marketing: true })
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
  }

  function essentialOnly() {
    setConsentState({ analytics: false, marketing: false })
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
  }

  function savePreferences() {
    setConsentState({ analytics, marketing })
    setPrefsOpen(false)
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: analytics && marketing ? 'all' : 'essential' }))
  }

  if (!visible && !prefsOpen) return null


  return (
    <>
    <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage preferences</DialogTitle>
          <DialogDescription>Essential cookies are always on. Choose optional tracking.</DialogDescription>
        </DialogHeader>
        <Label className="flex items-center gap-3">
          <Checkbox checked={analytics} onCheckedChange={(checked) => setAnalytics(!!checked)} />
          <span className="text-sm">Analytics (GA4) for understanding how the site is used</span>
        </Label>
        <Label className="flex items-center gap-3">
          <Checkbox checked={marketing} onCheckedChange={(checked) => setMarketing(!!checked)} />
          <span className="text-sm">Marketing (Meta Pixel) for relevant ads</span>
        </Label>
        <DialogFooter>
          <Button type="button" onClick={savePreferences}>Save</Button>
          <Button type="button" variant="outline" onClick={() => setPrefsOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {visible && (
    /* role="region", not role="dialog": this is a persistent non-modal bar with
       no focus move or trap, so announcing it as a dialog misled screen readers
       (design-audit P3). Compact layout: one short line + one row of three
       equal buttons, so the bar stops covering the hero's proof line and CTA
       pair on mobile first paint (design-audit P2). */
    /* z-90: above the listing-detail sticky mobile CTA bar (kb.css
       .listing-mobile-cta, z-index 80) — the CTA used to slide up OVER the
       banner's own Accept/Manage/Essential buttons (design-audit P2). */
    <div role="region" aria-label="Cookie notice" className="fixed bottom-0 left-0 right-0 z-[90] border-t border-border bg-card px-4 py-3 shadow-md sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs text-muted-foreground sm:text-sm">
          We use cookies to improve the site and measure traffic.{' '}
          <Link href="/privacy" className="font-medium text-foreground underline hover:no-underline">Privacy and cookies</Link>
          {' · '}
          <Link href="/privacy#donotsell" className="font-medium text-foreground underline hover:no-underline">Do Not Sell My Personal Information</Link>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <Button type="button" size="sm" onClick={acceptAll}>Accept all</Button>
          <Button type="button" size="sm" variant="outline" onClick={essentialOnly}>Essential only</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPrefsOpen(true)}>Preferences</Button>
        </div>
      </div>
    </div>
    )}
    </>
  )
}
