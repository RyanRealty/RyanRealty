'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { gpcFromNavigator, parseConsentCookie, type ConsentState } from '@/lib/identity/consent'
import { consentRegionRestrictedFromCookieHeader } from '@/lib/analytics/consent-regions'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Settings01Icon } from '@hugeicons/core-free-icons'
import {
  CONSENT_PROMPT_DISMISS_KEY,
  CONSENT_PROMPT_SESSION_KEY,
  CONSENT_PROMPT_STORAGE_KEY,
  CONSENT_PURPOSES_VERSION,
  CONTEXTUAL_CONSENT_ASK_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  consentFirstLayerSuppressed,
  parseConsentDecisionMeta,
  parsePromptBookkeeping,
  serializePromptBookkeeping,
  shouldShowConsentPrompt,
  shouldShowContextualConsentAsk,
  type ConsentPromptStored,
  type PromptBookkeeping,
} from '@/lib/identity/consent-prompt'

export {
  CONSENT_PURPOSES_VERSION,
  CONTEXTUAL_CONSENT_ASK_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  shouldShowConsentPrompt,
} from '@/lib/identity/consent-prompt'

const COOKIE_CONSENT_KEY = 'ryan_realty_cookie_consent'
const CONSENT_EXPIRY_YEARS = 1

/** Shared size so Decline and Accept all are the same height and width. */
export const CONSENT_CHOICE_BUTTON_CLASS = 'h-11 min-h-11 w-full min-w-0 px-3'

export const COOKIE_NOTICE_HEADING = 'Want ads that match the homes you look at?'
export const COOKIE_NOTICE_BODY =
  'We use cookies to see which pages help you. If you say yes, we also use Meta and Google cookies to show you Ryan Realty ads about homes and market updates you care about. You can change this anytime from Cookie settings at the bottom of every page.'
export const COOKIE_GPC_SETTINGS_COPY =
  "Your browser's Global Privacy Control signal is on, so marketing and analytics stay off."

export type { ConsentState }

/** The stored consent choice, or null when the visitor has not answered the
 *  banner yet. Callers that need to distinguish "no choice" (functional
 *  essential tracking allowed) from an explicit decline use this instead of
 *  the boolean getters. */
export function getStoredConsent(): ConsentState | null {
  return getConsent()
}

/** The banner's cookie value as the browser holds it, undecoded; undefined when there is none. */
function readConsentCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(COOKIE_CONSENT_KEY + '='))
    ?.split('=')[1]
}

function getConsent(): ConsentState | null {
  return parseConsentCookie(readConsentCookie())
}

function readPromptStored(): ConsentPromptStored {
  const raw = readConsentCookie()
  const state = parseConsentCookie(raw)
  if (!state) return null
  const { v } = parseConsentDecisionMeta(raw)
  return v == null ? state : { ...state, v }
}

function setConsentState(state: ConsentState) {
  const expires = new Date() // hydration-safe: cookie write on click, not render
  expires.setFullYear(expires.getFullYear() + CONSENT_EXPIRY_YEARS)
  const payload = {
    ...state,
    ts: Date.now(), // hydration-safe: cookie write on click, not render
    v: CONSENT_PURPOSES_VERSION,
  }
  document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(JSON.stringify(payload))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
}

export function hasTrackingConsent(): boolean {
  const c = getConsent()
  return c !== null && c.analytics && c.marketing
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  if (gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)) return false
  const c = getConsent()
  if (c !== null) return c.analytics
  return !consentRegionRestrictedFromCookieHeader(document.cookie)
}

export function hasMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false
  if (gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)) return false
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
  const id = crypto.randomUUID?.() ?? `v_${Date.now()}_${Math.random().toString(36).slice(2)}` // hydration-safe: cookie write, not render
  const expires = new Date() // hydration-safe: cookie write, not render
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${id}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
  return id
}

function readBookkeeping(): PromptBookkeeping {
  try {
    return parsePromptBookkeeping(localStorage.getItem(CONSENT_PROMPT_STORAGE_KEY))
  } catch {
    return { lastShownAt: null, contextualAskUsed: false }
  }
}

function writeBookkeeping(next: PromptBookkeeping) {
  try {
    localStorage.setItem(CONSENT_PROMPT_STORAGE_KEY, serializePromptBookkeeping(next))
  } catch {
    /* private mode */
  }
}

export default function CookieConsentBanner() {
  const pathname = usePathname()
  const chromeHidden = consentFirstLayerSuppressed(pathname)
  const [surface, setSurface] = useState<'hidden' | 'bar'>('hidden')
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)
  const [restricted, setRestricted] = useState(true)
  const [gpcOn, setGpcOn] = useState(false)
  const [hasChoice, setHasChoice] = useState(false)
  const promptRef = useRef({
    stored: null as ConsentPromptStored,
    gpc: false,
    restricted: true,
    contextualAskUsed: false,
  })
  const shownMarked = useRef(false)

  useEffect(() => {
    const gpc = gpcFromNavigator(typeof navigator !== 'undefined' ? navigator : undefined)
    const regionRestricted = consentRegionRestrictedFromCookieHeader(document.cookie)
    const stored = readPromptStored()
    const raw = readConsentCookie()
    const meta = parseConsentDecisionMeta(raw)
    const book = readBookkeeping()
    let dismissedThisSession = false
    let newSession = true
    try {
      dismissedThisSession = sessionStorage.getItem(CONSENT_PROMPT_DISMISS_KEY) === '1'
      newSession = sessionStorage.getItem(CONSENT_PROMPT_SESSION_KEY) !== '1'
      sessionStorage.setItem(CONSENT_PROMPT_SESSION_KEY, '1')
    } catch {
      /* private mode */
    }

    setGpcOn(gpc)
    setRestricted(regionRestricted)
    promptRef.current = {
      stored,
      gpc,
      restricted: regionRestricted,
      contextualAskUsed: book.contextualAskUsed,
    }

    if (stored !== null) {
      setAnalytics(stored.analytics)
      setMarketing(stored.marketing)
      setHasChoice(true)
    } else {
      setAnalytics(!regionRestricted)
      setMarketing(false)
    }

    const now = Date.now() // hydration-safe: mount effect, not render
    const mayPrompt = shouldShowConsentPrompt({
      stored,
      decidedAt: meta.ts,
      lastShownAt: book.lastShownAt,
      dismissedThisSession,
      newSession,
      restricted: regionRestricted,
      gpc,
      now,
    })

    const onConsent = () => {
      const next = readPromptStored()
      promptRef.current.stored = next
      if (next) {
        setAnalytics(next.analytics)
        setMarketing(next.marketing)
        setHasChoice(true)
      }
      setSurface('hidden')
    }
    window.addEventListener('cookie-consent', onConsent)

    const onOpenSettings = () => {
      const next = readPromptStored()
      promptRef.current.stored = next
      if (next) {
        setAnalytics(next.analytics)
        setMarketing(next.marketing)
      } else {
        setAnalytics(!promptRef.current.restricted)
        setMarketing(false)
      }
      setPrefsOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings)

    const onContextual = () => {
      const snap = promptRef.current
      if (
        !shouldShowContextualConsentAsk({
          stored: snap.stored,
          gpc: snap.gpc,
          restricted: snap.restricted,
          contextualAskUsed: snap.contextualAskUsed,
        })
      ) {
        return
      }
      const nextBook = { ...readBookkeeping(), contextualAskUsed: true, lastShownAt: Date.now() } // hydration-safe: event handler
      writeBookkeeping(nextBook)
      promptRef.current.contextualAskUsed = true
      shownMarked.current = true
      setSurface('bar')
    }
    window.addEventListener(CONTEXTUAL_CONSENT_ASK_EVENT, onContextual)

    if (mayPrompt) setSurface('bar')

    return () => {
      window.removeEventListener('cookie-consent', onConsent)
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings)
      window.removeEventListener(CONTEXTUAL_CONSENT_ASK_EVENT, onContextual)
    }
  }, [])

  useEffect(() => {
    if (surface !== 'bar' || chromeHidden) return
    if (shownMarked.current) return
    shownMarked.current = true
    const now = Date.now() // hydration-safe: effect after reveal, not render
    writeBookkeeping({ ...readBookkeeping(), lastShownAt: now })
  }, [surface, chromeHidden])

  function acceptAll() {
    setConsentState({ analytics: true, marketing: true })
    setAnalytics(true)
    setMarketing(true)
    setHasChoice(true)
    promptRef.current.stored = { analytics: true, marketing: true, v: CONSENT_PURPOSES_VERSION }
    setSurface('hidden')
    setPrefsOpen(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
  }

  function declineAll() {
    setConsentState({ analytics: false, marketing: false })
    setAnalytics(false)
    setMarketing(false)
    setHasChoice(true)
    promptRef.current.stored = { analytics: false, marketing: false, v: CONSENT_PURPOSES_VERSION }
    setSurface('hidden')
    setPrefsOpen(false)
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
  }

  function saveChoices() {
    setConsentState({ analytics, marketing })
    setHasChoice(true)
    promptRef.current.stored = { analytics, marketing, v: CONSENT_PURPOSES_VERSION }
    setPrefsOpen(false)
    setSurface('hidden')
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: analytics && marketing ? 'all' : 'essential' }))
  }

  function closeWithoutAnswer() {
    try {
      sessionStorage.setItem(CONSENT_PROMPT_DISMISS_KEY, '1')
    } catch {
      /* private mode */
    }
    const now = Date.now() // hydration-safe: click handler
    writeBookkeeping({ ...readBookkeeping(), lastShownAt: now })
    setSurface('hidden')
    setPrefsOpen(false)
  }

  function openChooser() {
    const stored = promptRef.current.stored
    if (stored) {
      setAnalytics(stored.analytics)
      setMarketing(stored.marketing)
    } else {
      setAnalytics(!promptRef.current.restricted)
      setMarketing(false)
    }
    setPrefsOpen(true)
  }

  const acceptVariant = restricted ? 'secondary' : 'default'
  const declineVariant = 'secondary' as const
  const showIcon = hasChoice && surface === 'hidden' && !prefsOpen && !chromeHidden
  const showFirstLayer = !gpcOn && !chromeHidden && !prefsOpen && surface === 'bar'

  // The phone dock and sticky ask sit above this bar via --v3-cookie-bar-h.
  // The old fallback (5.5rem) is shorter than this sheet, so they landed on Decline.
  useEffect(() => {
    const root = document.documentElement
    if (!showFirstLayer) {
      root.style.removeProperty('--v3-cookie-bar-h')
      return
    }
    const bar = document.querySelector<HTMLElement>('[data-cookie-notice="bar"]')
    if (!bar) return
    const apply = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height)
      root.style.setProperty('--v3-cookie-bar-h', `${height}px`)
    }
    apply()
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.removeProperty('--v3-cookie-bar-h')
    }
    const observer = new ResizeObserver(apply)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--v3-cookie-bar-h')
    }
  }, [showFirstLayer])

  if (!showFirstLayer && !prefsOpen && !showIcon) return null

  return (
    <>
    <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
      <DialogContent
        className="z-[120] bg-card sm:max-w-md max-h-[min(32rem,calc(100svh-2rem))] overflow-y-auto"
        overlayClassName="z-[120]"
      >
        <DialogHeader>
          <DialogTitle>Choose what to allow</DialogTitle>
          {gpcOn ? (
            <DialogDescription>{COOKIE_GPC_SETTINGS_COPY}</DialogDescription>
          ) : (
            <DialogDescription>
              Essential cookies stay on. Turn the others on only if you want them.
            </DialogDescription>
          )}
        </DialogHeader>
        {gpcOn ? null : (
          <div className="grid gap-4">
            <p className="text-sm" data-consent-essential="always">
              Essential (always on): sign-in session, your cookie choice.
            </p>
            <Label className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm">Analytics: Google (Google Analytics)</span>
              <Switch
                className="mt-0.5 shrink-0"
                data-consent-toggle="analytics"
                checked={analytics}
                onCheckedChange={(checked) => setAnalytics(checked === true)}
              />
            </Label>
            <Label className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm">
                Marketing (Meta and Google ads): Meta (Facebook, Instagram) and Google (Google Ads)
              </span>
              <Switch
                className="mt-0.5 shrink-0"
                data-consent-toggle="marketing"
                checked={marketing}
                onCheckedChange={(checked) => setMarketing(checked === true)}
              />
            </Label>
          </div>
        )}
        {gpcOn ? null : (
          <DialogFooter className="bg-card sm:flex-col">
            <Button type="button" className="h-11 w-full flex-1" onClick={saveChoices}>Save choices</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    {showIcon ? (
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Cookie settings"
        data-cookie-settings="icon"
        className="fixed z-[90] min-h-11 min-w-11"
        style={{
          left: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          bottom:
            'max(0.75rem, calc(var(--rr-dock-h, 0px) + var(--rr-sticky-bottom, 0px) + env(safe-area-inset-bottom, 0px)))',
        }}
        onClick={openChooser}
      >
        <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
      </Button>
    ) : null}
    {showFirstLayer ? (
    /* role="region", not role="dialog": non-modal bottom bar / sheet.
       Scroll and the close control do not record consent.
       z-90: above the z-80 bottom docks so those docks cannot cover Decline. */
    <div
      role="region"
      aria-label="Cookie notice"
      data-cookie-notice="bar"
      data-consent-region={restricted ? 'restricted' : 'us'}
      className="fixed bottom-0 left-0 right-0 z-[90] max-h-[85svh] overflow-y-auto rounded-t-xl border-t border-border bg-card px-4 pt-3 shadow-md sm:rounded-none sm:px-6"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="relative mx-auto max-w-3xl pe-12">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-0 top-0 min-h-11 min-w-11"
          aria-label="Close cookie notice"
          onClick={closeWithoutAnswer}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
        <p className="text-sm font-medium text-foreground sm:text-base">
          {COOKIE_NOTICE_HEADING}
        </p>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {COOKIE_NOTICE_BODY}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/privacy" className="font-medium text-foreground underline hover:no-underline">Privacy and cookies</Link>
          {' · '}
          <Link href="/privacy#donotsell" className="font-medium text-foreground underline hover:no-underline">Do Not Sell My Personal Information</Link>
        </p>
        <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
          <Button
            type="button"
            variant={declineVariant}
            className={CONSENT_CHOICE_BUTTON_CLASS}
            data-consent-action="decline"
            onClick={declineAll}
          >
            Decline
          </Button>
          <Button
            type="button"
            variant={acceptVariant}
            className={CONSENT_CHOICE_BUTTON_CLASS}
            data-consent-action="accept"
            onClick={acceptAll}
          >
            Accept all
          </Button>
        </div>
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto px-0"
          onClick={openChooser}
        >
          Choose what to allow
        </Button>
      </div>
    </div>
    ) : null}
    </>
  )
}
