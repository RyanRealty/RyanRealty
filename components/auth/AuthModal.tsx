'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignInUrl, signInWithEmailPassword, signUpWithEmailPassword } from '@/app/actions/auth'

type Props = {
  open: boolean
  onClose: () => void
  /** After auth, run this (e.g. retry save). */
  onSuccess?: () => void
  next?: string
}

export default function AuthModal({ open, onClose, onSuccess, next = '/dashboard' }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  if (!open) return null

  async function handleGoogle() {
    setLoading('google')
    setError(null)
    const result = await getSignInUrl('google', next)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setError(result.error)
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    setLoading('email')
    const result = await signInWithEmailPassword(email.trim(), password, { next })
    setLoading(null)
    if (result.ok) {
      onClose()
      router.refresh()
      onSuccess?.()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setError(result.error)
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading('email')
    const result = await signUpWithEmailPassword(email.trim(), password, {
      fullName: fullName.trim() || undefined,
      next,
    })
    setLoading(null)
    if (result.ok) {
      onClose()
      router.refresh()
      onSuccess?.()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setError(result.error)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-bold text-[var(--brand-navy)]">Ryan Realty</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(null) }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === 'signin'
                ? 'border-[var(--brand-navy)] text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null) }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === 'signup'
                ? 'border-[var(--brand-navy)] text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Create account
          </button>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={!!loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <div className="my-4 border-t border-zinc-200" />
          {tab === 'signin' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!!loading}
                className="w-full rounded-lg bg-[var(--brand-navy)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading === 'email' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="Password (min 6)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!!loading}
                className="w-full rounded-lg bg-[var(--brand-navy)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading === 'email' ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
