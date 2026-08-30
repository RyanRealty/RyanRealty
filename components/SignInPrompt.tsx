'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import type { AuthUser } from '@/app/actions/auth'
import { signInPromptSkipReason } from '@/lib/auth/signin-prompt-policy'
import { promptGoogleOneTap, RR_OPEN_SIGNIN, RR_OPEN_SIGNIN_FLAG } from '@/lib/auth/google-gis'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FacebookIcon } from '@/components/icons/AuthProviderIcons'
import { GoogleContinueButton, useGoogleCommsConsent } from '@/components/auth/GoogleCommsCard'

const DISMISS_KEY = 'ryan_realty_signin_prompt_dismissed'
const DISMISS_HOURS = 24
const PV_KEY = 'rr_session_pageviews'

function countPageview(pathname: string): number {
  try {
    const seenKey = `${PV_KEY}:seen`
    const seen = new Set(
      (sessionStorage.getItem(seenKey) || '').split('|').filter(Boolean),
    )
    if (!seen.has(pathname)) {
      seen.add(pathname)
      sessionStorage.setItem(seenKey, [...seen].join('|'))
      sessionStorage.setItem(PV_KEY, String(seen.size))
      return seen.size
    }
    return Number(sessionStorage.getItem(PV_KEY) || '0')
  } catch {
    return 2
  }
}

function wasDismissed(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const t = Number(raw)
    if (Number.isNaN(t)) return false
    return Date.now() - t < DISMISS_HOURS * 60 * 60 * 1000 // hydration-safe: effect/handler dismiss clock, not render
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now())) // hydration-safe: effect/handler storage only
  } catch {
    /* ignore */
  }
}

function isNotFoundPage(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.notFound === '1'
}

function consumeOpenFlag(): boolean {
  try {
    if (sessionStorage.getItem(RR_OPEN_SIGNIN_FLAG) !== '1') return false
    sessionStorage.removeItem(RR_OPEN_SIGNIN_FLAG)
    return true
  } catch {
    return false
  }
}

type InnerProps = {
  user: AuthUser | null
  searchParams: ReturnType<typeof useSearchParams>
  googleClientId: string | null
}

function SignInPromptInner({ user, searchParams, googleClientId }: InnerProps) {
  const [fallback, setFallback] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const comms = useGoogleCommsConsent()
  const hasNextParam = typeof window !== 'undefined' ? !!searchParams?.get('next') : false
  const pathname = usePathname()
  const cancelTap = useRef<(() => void) | null>(null)
  const fromAdClick = (() => {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search || '')
    return qs.has('fbclid') || qs.has('gclid') || qs.has('msclkid') || qs.has('ttclid') ||
      [...qs.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  })()
  const fromOutreachClick = (() => {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search || '')
    return qs.has('agent') || qs.has('_pid') || qs.has('_fuid')
  })()

  const nextPath = (() => {
    const nextFromUrl = searchParams?.get('next')
    if (nextFromUrl && nextFromUrl.startsWith('/')) return nextFromUrl
    if (typeof window !== 'undefined') return window.location.pathname + window.location.search
    return '/'
  })()

  const onGoogleCredential = useCallback(
    async (rawNonce: string, credential: string) => {
      setLoading('google')
      await comms.persist()
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
        nonce: rawNonce,
      })
      if (error) {
        setLoading(null)
        setFallback(true)
        return
      }
      window.location.reload()
    },
    [comms],
  )

  const showFallback = useCallback(() => {
    cancelTap.current?.()
    cancelTap.current = null
    setFallback(true)
  }, [])

  const startContinue = useCallback(
    async (forced: boolean) => {
      if (user) return
      if (!forced) {
        const skip = signInPromptSkipReason({
          pathname: pathname || '/',
          fromAdClick,
          fromOutreachClick,
          isNotFound: isNotFoundPage(),
        })
        if (skip) return
      }
      setFallback(false)
      if (!googleClientId) {
        showFallback()
        return
      }
      try {
        cancelTap.current = await promptGoogleOneTap({
          clientId: googleClientId,
          onCredential: onGoogleCredential,
          onUnavailable: showFallback,
        })
      } catch {
        showFallback()
      }
    },
    [user, googleClientId, pathname, fromAdClick, fromOutreachClick, onGoogleCredential, showFallback],
  )

  useEffect(() => {
    if (user) return
    if (fromOutreachClick) {
      setDismissed()
      return
    }
    const onOpen = () => {
      void startContinue(true)
    }
    window.addEventListener(RR_OPEN_SIGNIN, onOpen)
    if (consumeOpenFlag()) {
      void startContinue(true)
      return () => window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
    }
    const skip = signInPromptSkipReason({
      pathname: pathname || '/',
      fromAdClick,
      fromOutreachClick,
      isNotFound: false,
    })
    if (skip) {
      return () => window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
    }
    if (hasNextParam) {
      if (!isNotFoundPage()) void startContinue(false)
      return () => window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
    }
    if (wasDismissed()) {
      return () => window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
    }
    if (countPageview(pathname || '/') < 2) {
      return () => window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
    }
    const t = setTimeout(() => {
      if (!isNotFoundPage()) void startContinue(false)
    }, 1000)
    return () => {
      clearTimeout(t)
      window.removeEventListener(RR_OPEN_SIGNIN, onOpen)
      cancelTap.current?.()
    }
  }, [user, hasNextParam, pathname, fromAdClick, fromOutreachClick, startContinue])

  async function handleSignIn(provider: 'google' | 'facebook') {
    setLoading(provider)
    await comms.persist()
    const result = await signInWithOAuthBrowser(provider, nextPath)
    if (result.error) setLoading(null)
  }

  function handleMaybeLater() {
    setDismissed()
    cancelTap.current?.()
    cancelTap.current = null
    setFallback(false)
  }

  if (!fallback) return null

  return (
    <Dialog open={fallback} onOpenChange={(open) => { if (!open) handleMaybeLater() }}>
      <DialogContent
        closeButtonVariant="outline"
        className="max-w-sm p-6"
      >
        <DialogTitle className="text-lg font-semibold text-foreground">
          Continue
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Save homes and get alerts. Phone and updates are optional.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <GoogleContinueButton
            loading={loading === 'google'}
            disabled={!!loading}
            onClick={() => handleSignIn('google')}
            className="w-full"
          />
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

function SignInPromptWithParams({
  user,
  googleClientId,
}: {
  user: AuthUser | null
  googleClientId: string | null
}) {
  const searchParams = useSearchParams()
  return (
    <SignInPromptInner
      user={user}
      searchParams={searchParams}
      googleClientId={googleClientId}
    />
  )
}

type Props = { user: AuthUser | null; googleClientId?: string | null }

export default function SignInPrompt({ user, googleClientId = null }: Props) {
  return (
    <Suspense fallback={null}>
      <SignInPromptWithParams user={user} googleClientId={googleClientId} />
    </Suspense>
  )
}
