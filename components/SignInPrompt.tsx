'use client'

import { Suspense, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getSignInUrl } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { GoogleIcon, AppleIcon, FacebookIcon } from '@/components/icons/AuthProviderIcons'

const DISMISS_KEY = 'ryan_realty_signin_prompt_dismissed'
const DISMISS_HOURS = 72
const VISIT_COUNT_KEY = 'ryan_realty_page_views'
const FIRST_VISIT_KEY = 'ryan_realty_first_visit'
/** Minimum page views before showing the prompt (let visitors browse first) */
const MIN_PAGE_VIEWS = 3

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

/** Track page views and first visit time so we don't interrupt first-time visitors. */
function hasEngagedEnough(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    // Record first visit
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()))
    }
    // Increment page views
    const views = Number(localStorage.getItem(VISIT_COUNT_KEY) || '0') + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(views))
    // Must have viewed at least MIN_PAGE_VIEWS pages
    if (views < MIN_PAGE_VIEWS) return false
    // Must have been on site at least 60 seconds
    const firstVisit = Number(localStorage.getItem(FIRST_VISIT_KEY) || '0')
    if (firstVisit > 0 && Date.now() - firstVisit < 60_000) return false
    return true
  } catch {
    return false
  }
}

type InnerProps = { user: AuthUser | null; searchParams: ReturnType<typeof useSearchParams> }

function SignInPromptInner({ user, searchParams }: InnerProps) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const hasNextParam = typeof window !== 'undefined' ? !!searchParams?.get('next') : false
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    if (user) return
    // Always show immediately when there's a ?next= param (user was redirected to sign in)
    if (hasNextParam) {
      setShow(true)
      return
    }
    if (wasDismissed()) return
    // Don't interrupt first-time visitors — wait until they've browsed a few pages
    if (!hasEngagedEnough()) return
    const t = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(t)
  }, [user, hasNextParam])

  async function handleSignIn(provider: 'google' | 'apple' | 'facebook') {
    setLoading(provider)
    const nextFromUrl = searchParams?.get('next')
    const next = nextFromUrl && nextFromUrl.startsWith('/') ? nextFromUrl : '/'
    const result = await getSignInUrl(provider, next)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
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
          Sign in with Google, Apple, or Facebook to unlock your account—no new password needed.
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
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <GoogleIcon className="size-5" />
            {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          <Button
            type="button"
            disabled={!!loading}
            onClick={() => handleSignIn('apple')}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <AppleIcon className="size-5" />
            {loading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
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
