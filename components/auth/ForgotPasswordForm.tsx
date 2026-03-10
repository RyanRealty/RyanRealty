'use client'

import { useState } from 'react'
import { resetPasswordForEmail } from '@/app/actions/auth'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    setLoading(true)
    const result = await resetPasswordForEmail(email.trim())
    setLoading(false)
    if (result.ok) {
      setSent(true)
      return
    }
    setError(result.error)
  }

  if (sent) {
    return (
      <p className="mt-6 text-center text-sm text-zinc-600">
        Check your email for a reset link. If you don&apos;t see it, check spam.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--brand-navy)] py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
