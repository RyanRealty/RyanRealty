'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getSignInUrl } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'

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

type Props = { user: AuthUser | null }

export default function SignInPrompt({ user }: Props) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user) return
    if (wasDismissed()) return
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [user])

  async function handleSignIn() {
    setLoading('google')
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const next = pathname && pathname !== '/' ? pathname : '/'
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
      <div className="fixed inset-0 z-40 bg-zinc-900/50" aria-hidden onClick={handleMaybeLater} />
      <div
        role="dialog"
        aria-labelledby="signin-prompt-title"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <h2 id="signin-prompt-title" className="text-xl font-semibold text-zinc-900">
          Get the most out of Ryan Realty
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with your existing account to save searches, get updates, and pick up where you left off—no new password needed.
        </p>
        <div className="mt-6">
          <button
            type="button"
            disabled={!!loading}
            onClick={handleSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading ? '…' : 'Continue with Google'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleMaybeLater}
          className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-700"
        >
          Maybe later
        </button>
      </div>
    </>
  )
}
