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
import { cn } from '@/lib/utils'

const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'
const CONSENT_EXPIRY_YEARS = 1

/** First-screen 390 stays clear this long. Chip only, never the filled bar. */
export const COOKIE_NOTICE_FOLD_DELAY_MS = 3000
/** First scroll past this reveals the legal bar. The visitor has seen the thing. */
export const COOKIE_NOTICE_SCROLL_PX = 24

export type ConsentState = { analytics: boolean; marketing: boolean }

export type CookieNoticeSurface = 'hidden' | 'chip' | 'bar'

export type CookieNoticeEvent =
  | 'mount'
  | 'scroll'
  | 'delay'
  | 'open-bar'
  | 'chosen'
  | 'consent-recorded'

/**
 * Occupancy machine for the consent surface. Mount never claims the fold.
 * Scroll (the thing has been seen) earns the legal bar. The 3s delay earns
 * only a corner chip so Accept all is never a first-viewport filled primary.
 */
export function nextCookieNoticeSurface(
  surface: CookieNoticeSurface,
  event: CookieNoticeEvent,
  hasConsent: boolean,
): CookieNoticeSurface {
  if (hasConsent) return 'hidden'
  switch (event) {
    case 'mount':
      return 'hidden'
    case 'scroll':
      return 'bar'
    case 'delay':
      return surface === 'bar' ? 'bar' : 'chip'
    case 'open-bar':
      return 'bar'
    case 'chosen':
    case 'consent-recorded':
      return 'hidden'
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

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
  const expires = new Date() // hydration-safe: cookie write on click, not render
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
  const id = crypto.randomUUID?.() ?? `v_${Date.now()}_${Math.random().toString(36).slice(2)}` // hydration-safe: cookie write, not render
  const expires = new Date() // hydration-safe: cookie write, not render
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${id}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  return id
}

export default function CookieConsentBanner() {
  const [surface, setSurface] = useState<CookieNoticeSurface>('hidden')
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(true)

  useEffect(() => {
    const consent = getConsent()
    if (consent !== null) {
      setAnalytics(consent.analytics)
      setMarketing(consent.marketing)
      return
    }

    const apply = (event: CookieNoticeEvent) => {
      setSurface((current) =>
        nextCookieNoticeSurface(current, event, getConsent() !== null),
      )
    }

    const onConsent = () => apply('consent-recorded')
    window.addEventListener('cookie-consent', onConsent)

    const onScroll = () => {
      if (window.scrollY < COOKIE_NOTICE_SCROLL_PX) return
      apply('scroll')
      window.removeEventListener('scroll', onScroll)
    }

    if (window.scrollY >= COOKIE_NOTICE_SCROLL_PX) {
      apply('scroll')
    } else {
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    const timer = window.setTimeout(() => apply('delay'), COOKIE_NOTICE_FOLD_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('cookie-consent', onConsent)
    }
  }, [])

  function acceptAll() {
    setConsentState({ analytics: true, marketing: true })
    setSurface('hidden')
    setPrefsOpen(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
  }

  function essentialOnly() {
    setConsentState({ analytics: false, marketing: false })
    setSurface('hidden')
    setPrefsOpen(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
  }

  function savePreferences() {
    setConsentState({ analytics, marketing })
    setPrefsOpen(false)
    setSurface('hidden')
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: analytics && marketing ? 'all' : 'essential' }))
  }

  if (surface === 'hidden' && !prefsOpen) return null

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
          <span className="text-sm">Analytics (GA4), to see how the site is used</span>
        </Label>
        <Label className="flex items-center gap-3">
          <Checkbox checked={marketing} onCheckedChange={(checked) => setMarketing(!!checked)} />
          <span className="text-sm">Marketing (Meta Pixel), to target ads to you</span>
        </Label>
        <DialogFooter>
          <Button type="button" onClick={savePreferences}>Save</Button>
          <Button type="button" variant="outline" onClick={() => setPrefsOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {surface === 'chip' && (
    <div
      role="region"
      aria-label="Cookie notice"
      data-cookie-notice="chip"
      className={cn('fixed bottom-4 end-4 z-[90]')}
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => setSurface((current) => nextCookieNoticeSurface(current, 'open-bar', false))}
      >
        Cookies
      </Button>
    </div>
    )}
    {surface === 'bar' && (
    /* role="region", not role="dialog": this is a persistent non-modal bar with
       no focus move or trap, so announcing it as a dialog misled screen readers
       (design-audit P3). Shown only after first scroll or after the visitor
       opens the delayed chip, so Accept all is never a first-viewport fill. */
    /* Sit above the listing sticky (Schedule · Call) via --listing-sticky-height
       so the cookie row never covers those 44px actions. One compact line of
       copy plus one 44px action row. */
    <div
      role="region"
      aria-label="Cookie notice"
      data-cookie-notice="bar"
      className="fixed left-0 right-0 z-[90] border-t border-border bg-card px-4 py-2 sm:px-6"
      style={{ bottom: 'var(--listing-sticky-height, 0px)' }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-snug text-muted-foreground sm:flex-1 sm:text-sm">
          We use cookies to measure site traffic and target ads.{' '}
          <Link href="/privacy" className="font-medium text-foreground underline hover:no-underline">Privacy and cookies</Link>
          {' · '}
          <Link href="/privacy#donotsell" className="font-medium text-foreground underline hover:no-underline">Do Not Sell My Personal Information</Link>
        </p>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:gap-3">
          <Button type="button" className="min-h-11" onClick={acceptAll}>Accept all</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={essentialOnly}>Essential only</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setPrefsOpen(true)}>Preferences</Button>
        </div>
      </div>
    </div>
    )}
    </>
  )
}
