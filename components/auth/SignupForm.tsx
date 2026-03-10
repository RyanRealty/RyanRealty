'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignInUrl, signUpWithEmailPassword } from '@/app/actions/auth'

type Props = { next: string }

export default function SignupForm({ next }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleGoogle() {
    setLoading('google')
    setError(null)
    const result = await getSignInUrl('google', next)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setError(result.error)
  }

  async function handleSubmit(e: React.FormEvent) {
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
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      else window.location.href = '/dashboard?welcome=1'
      return
    }
    setError(result.error)
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-zinc-500">or</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="block text-sm font-medium text-zinc-700">
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          <p className="mt-0.5 text-xs text-zinc-500">At least 6 characters</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg bg-[var(--brand-navy)] py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading === 'email' ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
