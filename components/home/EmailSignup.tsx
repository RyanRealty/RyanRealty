'use client'

import { useState } from 'react'
import { subscribeNewsletter } from '@/app/actions/home'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="email-signup-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="email-signup-heading" className="text-2xl font-bold tracking-tight text-primary">
          Stay Ahead of the Market
        </h2>
        <p className="mt-2 text-muted-foreground">
          Get new listings, price drops, and market insights delivered to your inbox.
        </p>
        {status === 'success' ? (
          <p className="mt-6 rounded-lg bg-success/20 px-4 py-3 text-success font-medium">
            You&apos;re in! Check your email for a welcome message.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Label htmlFor="newsletter-email" className="sr-only">
              Email address
            </Label>
            <Input
              id="newsletter-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </Button>
          </form>
        )}
        {status === 'error' && errorMessage && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  )
}
