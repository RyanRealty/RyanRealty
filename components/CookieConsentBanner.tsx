'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'
const CONSENT_EXPIRY_YEARS = 1

function getConsent(): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(COOKIE_CONSENT_KEY + '='))
    ?.split('=')[1] ?? null
}

function setConsent(value: 'all' | 'essential') {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + CONSENT_EXPIRY_YEARS)
  document.cookie = `${COOKIE_CONSENT_KEY}=${value}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
}

export function hasTrackingConsent(): boolean {
  return getConsent() === 'all'
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

  useEffect(() => {
    const consent = getConsent()
    if (consent === null) setVisible(true)
  }, [])

  function accept() {
    setConsent('all')
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
  }

  function decline() {
    setConsent('essential')
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-4 shadow-lg sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-zinc-700">
          We use cookies to keep the site working, to remember your sign-in and choices, and to
          understand how the site is used. If you sign in with Google, we also send your activity
          (e.g. listings viewed) to our CRM to follow up with you. By continuing, you agree to our use
          of cookies.{' '}
          <Link href="/privacy" className="font-medium text-zinc-900 underline hover:no-underline">
            Privacy & cookies
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={decline}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}
