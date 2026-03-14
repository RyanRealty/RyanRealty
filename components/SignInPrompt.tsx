'use client'

import { Suspense, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getSignInUrl } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'
import { Button } from "@/components/ui/button"

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

type InnerProps = { user: AuthUser | null; searchParams: ReturnType<typeof useSearchParams> }

function SignInPromptInner({ user, searchParams }: InnerProps) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const hasNextParam = typeof window !== 'undefined' ? !!searchParams?.get('next') : false
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    if (user) return
    if (hasNextParam) {
      setShow(true)
      return
    }
    if (!isHome) return
    if (wasDismissed()) return
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [user, hasNextParam, isHome])

  async function handleSignIn() {
    setLoading('google')
    const nextFromUrl = searchParams?.get('next')
    const next = nextFromUrl && nextFromUrl.startsWith('/') ? nextFromUrl : '/'
    const result = await getSignInUrl('google', next)
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
          Sign in with your existing account to save searches, get updates, and pick up where you left off—no new password needed.
        </p>
        <div className="mt-6">
          <Button
            type="button"
            disabled={!!loading}
            onClick={handleSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            {loading ? '…' : 'Continue with Google'}
          </Button>
        </div>
        <Button
          type="button"
          onClick={handleMaybeLater}
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
