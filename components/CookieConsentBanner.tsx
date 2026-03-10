'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'
const CONSENT_EXPIRY_YEARS = 1

type ConsentState = { analytics: boolean; marketing: boolean }

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

  if (prefsOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Cookie preferences">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-zinc-900">Manage preferences</h2>
          <p className="mt-2 text-sm text-zinc-600">Essential cookies are always on. Choose optional tracking.</p>
          <label className="mt-4 flex items-center gap-3">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm">Analytics (GA4) — understand how the site is used</span>
          </label>
          <label className="mt-2 flex items-center gap-3">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm">Marketing (Meta Pixel) — relevant ads</span>
          </label>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={savePreferences} className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">Save</button>
            <button type="button" onClick={() => setPrefsOpen(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-4 shadow-lg sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-zinc-700">
          We use cookies to improve your experience and analyze site traffic.{' '}
          <Link href="/privacy" className="font-medium text-zinc-900 underline hover:no-underline">Privacy & cookies</Link>
          {'. '}
          <Link href="/privacy#donotsell" className="font-medium text-zinc-900 underline hover:no-underline">Do Not Sell My Personal Information</Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={acceptAll} className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">Accept All</button>
          <button type="button" onClick={() => setPrefsOpen(true)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Manage Preferences</button>
          <button type="button" onClick={essentialOnly} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Essential only</button>
        </div>
      </div>
    </div>
  )
}
