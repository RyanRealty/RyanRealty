'use client'

import { Suspense, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import type { AuthUser } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { GoogleIcon, FacebookIcon } from '@/components/icons/AuthProviderIcons'

const DISMISS_KEY = 'ryan_realty_signin_prompt_dismissed'
const DISMISS_HOURS = 24
const PV_KEY = 'rr_session_pageviews'

/**
 * Engagement gate (2026-06-11, polish-audit P2 + Matt's conversion standard):
 * the prompt used to fire 1s into the FIRST pageview, stacking with the cookie
 * banner over the money pages — a login wall before a visitor saw a single
 * home. Now: first pageview of the session is never interrupted; the prompt
 * waits for the second pageview (the engaged visitor, who actually converts).
 */
function countPageview(): number {
  try {
    const n = Number(sessionStorage.getItem(PV_KEY) || '0') + 1
    sessionStorage.setItem(PV_KEY, String(n))
    return n
  } catch {
    return 2 // storage unavailable: keep legacy behavior
  }
}

function wasDismissed(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const t = Number(raw)
    if (Number.isNaN(t)) return false
    return Date.now() - t < DISMISS_HOURS * 60 * 60 * 1000 // hydration-safe — only called from useEffect
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now())) // hydration-safe — only called from event handlers
  } catch {
    // ignore
  }
}

// A 404 serves at an arbitrary path, so pathname can't identify it. The
// not-found page (components/NotFoundClient) flags <html data-not-found> while
// mounted; never auto-pop the social modal over that dead-end page.
function isNotFoundPage(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.notFound === '1'
}

type InnerProps = { user: AuthUser | null; searchParams: ReturnType<typeof useSearchParams> }

function SignInPromptInner({ user, searchParams }: InnerProps) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const hasNextParam = typeof window !== 'undefined' ? !!searchParams?.get('next') : false
  const pathname = usePathname()
  const isHome = pathname === '/'
  // Dedicated landing pages own their own conversion funnel (their own lead form).
  // The global social sign-in modal must never auto-pop over an /lp/* page.
  const isLandingPage = (pathname || '').startsWith('/lp/')
  // /login and /signup ARE the sign-in UI — popping the modal over them (e.g. after
  // a Save-listing redirect with ?next=) stacks two identical OAuth prompts.
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password'
  // Lead-form pages: a visitor mid tour-request/valuation/contact is the hottest
  // conversion moment on the site — never interrupt it with an OAuth modal.
  const isLeadFormPage =
    pathname === '/contact' ||
    pathname === '/sell/valuation' ||
    pathname === '/refer-a-client' ||
    pathname === '/join'
  // Ad / marketing traffic (Matt directive 2026-06-02): a visitor arriving from a
  // paid click should never be asked to continue with Google or Facebook. Detect
  // the click ids plus any utm_* and suppress the auto-pop for that page load.
  const fromAdClick = (() => {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search || '')
    return qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid') ||
      [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  })()
  // Outreach traffic (2026-07-15 conversion audit): a market-report email or CRM
  // text link arrives carrying ?agent= / ?_pid= / ?_fuid=. That visitor is a KNOWN
  // contact — the identity stitch already happened server-side, so the sign-in
  // modal offers them nothing and interrupts the report they were sent. Unlike the
  // per-page-load ad suppression, dismiss for the full 24h window: the params are
  // stripped/lost on the next client nav, but the visitor is still the same
  // identified contact mid-visit.
  const fromOutreachClick = (() => {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search || '')
    return qs.has('agent') || qs.has('_pid') || qs.has('_fuid')
  })()

  useEffect(() => {
    if (user) return
    if (fromOutreachClick) {
      setDismissed()
      return
    }
    // Never interrupt a landing-page or paid-traffic conversion with the social modal.
    if (isLandingPage || fromAdClick) return
    // Never stack the modal over the dedicated auth pages or a lead form.
    if (isAuthPage || isLeadFormPage) return
    if (hasNextParam) {
      if (!isNotFoundPage()) setShow(true)
      return
    }
    if (wasDismissed()) return
    // Engagement gate: never interrupt the first pageview of a session.
    if (countPageview() < 2) return
    // Re-check the 404 flag at fire time — by 1s the not-found page's effect has set it.
    const t = setTimeout(() => {
      if (!isNotFoundPage()) setShow(true)
    }, 1000)
    return () => clearTimeout(t)
  }, [user, hasNextParam, isHome, isLandingPage, fromAdClick, fromOutreachClick, isAuthPage, isLeadFormPage])

  async function handleSignIn(provider: 'google' | 'facebook') {
    setLoading(provider)
    const nextFromUrl = searchParams?.get('next')
    const next = nextFromUrl && nextFromUrl.startsWith('/') ? nextFromUrl : '/'
    const result = await signInWithOAuthBrowser(provider, next)
    if (result.error) setLoading(null)
  }

  function handleMaybeLater() {
    setDismissed()
    setShow(false)
  }

  if (!show) return null

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleMaybeLater() }}>
      <DialogContent showCloseButton={false} className="max-w-md overflow-hidden p-0">
        {/* Benefits-forward treatment (Matt 2026-08-05: the plain prompt sold
            nothing). Same engagement gating; the pitch is now three concrete
            things a signed-in visitor actually gets. */}
        <div className="bg-primary px-6 pb-5 pt-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/70">
            Free account access
          </p>
          <DialogTitle className="mt-1 text-2xl font-semibold leading-tight text-primary-foreground">
            Get alerts when homes match or change
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-primary-foreground/80">
            One tap with Google or Facebook. No new password.
          </DialogDescription>
        </div>
        <div className="px-6 pt-5 sm:px-8">
          <ul className="space-y-3.5">
            {[
              {
                title: 'New matches, the morning they list',
                sub: 'Save any search and we watch the MLS for you.',
              },
              {
                title: 'Price changes on homes you follow',
                sub: 'Track a home and see every cut the day it happens.',
              },
              {
                title: 'Your own portal',
                sub: 'Saved homes, alerts, and reports in one place, on any device.',
              },
            ].map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="mt-1 flex size-5 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2.5 8.5l3.5 3.5 7.5-8" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{b.title}</span>
                  <span className="block text-sm text-muted-foreground">{b.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 px-6 pb-6 pt-6 sm:px-8">
          <Button
            type="button"
            disabled={!!loading}
            onClick={() => handleSignIn('google')}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <GoogleIcon className="size-5" />
            {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          <Button
            type="button"
            disabled={!!loading}
            onClick={() => handleSignIn('facebook')}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <FacebookIcon className="size-5" />
            {loading === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
          </Button>
          <Button
            type="button"
            onClick={handleMaybeLater}
            variant="ghost"
            className="w-full text-sm text-muted-foreground hover:text-muted-foreground"
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SignInPromptWithParams({ user }: { user: AuthUser | null }) {
  const searchParams = useSearchParams()
  return <SignInPromptInner user={user} searchParams={searchParams} />
}

type Props = { user: AuthUser | null }

export default function SignInPrompt({ user }: Props) {
  return (
    <Suspense fallback={null}>
      <SignInPromptWithParams user={user} />
    </Suspense>
  )
}
