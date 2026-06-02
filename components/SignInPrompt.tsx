'use client'

import { Suspense, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import type { AuthUser } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { GoogleIcon, FacebookIcon } from '@/components/icons/AuthProviderIcons'

const DISMISS_KEY = 'ryan_realty_signin_prompt_dismissed'
const DISMISS_HOURS = 24

function wasDismissed(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const t = Number(raw)
    if (Number.isNaN(t)) return false
    return Date.now() - t < DISMISS_HOURS * 60 * 60 * 1000
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
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
  // Ad / marketing traffic (Matt directive 2026-06-02): a visitor arriving from a
  // paid click should never be asked to continue with Google or Facebook. Detect
  // the click ids plus any utm_* and suppress the auto-pop for that page load.
  const fromAdClick = (() => {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search || '')
    return qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid') ||
      [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  })()

  useEffect(() => {
    if (user) return
    // Never interrupt a landing-page or paid-traffic conversion with the social modal.
    if (isLandingPage || fromAdClick) return
    if (hasNextParam) {
      if (!isNotFoundPage()) setShow(true)
      return
    }
    if (wasDismissed()) return
    // Prompt logged-out visitors right away (don't wait). Tiny delay lets the first paint land.
    // Re-check the 404 flag at fire time — by 1s the not-found page's effect has set it.
    const t = setTimeout(() => {
      if (!isNotFoundPage()) setShow(true)
    }, 1000)
    return () => clearTimeout(t)
  }, [user, hasNextParam, isHome, isLandingPage, fromAdClick])

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
    <>
      <div className="fixed inset-0 z-40 bg-primary/50" aria-hidden onClick={handleMaybeLater} />
      <div
        role="dialog"
        aria-labelledby="signin-prompt-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8"
      >
        <h2 id="signin-prompt-title" className="text-xl font-semibold text-foreground">
          Get the most out of Ryan Realty
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with Google or Facebook. No new password needed.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground" aria-hidden>
          <li>Save searches and get new listing alerts</li>
          <li>Pick up where you left off on any device</li>
        </ul>
        <div className="mt-6 space-y-3">
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
        </div>
        <Button
          type="button"
          onClick={handleMaybeLater}
          variant="ghost"
          className="mt-4 w-full text-sm text-muted-foreground hover:text-muted-foreground"
        >
          Maybe later
        </Button>
      </div>
    </>
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
