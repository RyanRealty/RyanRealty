'use client'

import { useState } from 'react'
import { subscribeNewsletter } from '@/app/actions/home'
import { trackEvent } from '@/lib/tracking'

export default function EmailSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setStatus('loading')
    setErrorMessage('')
    const result = await subscribeNewsletter(value)
    if (result.ok) {
      setStatus('success')
      setEmail('')
      trackEvent('newsletter_signup', { cta_location: 'email_signup' })
    } else {
      setStatus('error')
      setErrorMessage(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="email-signup-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="email-signup-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          Stay Ahead of the Market
        </h2>
        <p className="mt-2 text-[var(--text-secondary)]">
          Get new listings, price drops, and market insights delivered to your inbox.
        </p>
        {status === 'success' ? (
          <p className="mt-6 rounded-lg bg-[var(--success)]/20 px-4 py-3 text-[var(--brand-navy)] font-medium">
            You&apos;re in! Check your email for a welcome message.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="min-w-0 flex-1 rounded-lg border border-[var(--gray-border)] bg-white px-4 py-3 text-[var(--brand-navy)] placeholder:text-[var(--gray-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && errorMessage && (
          <p className="mt-2 text-sm text-[var(--urgent)]" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  )
}
