'use client'

import { useState } from 'react'
import { subscribeNewsletterAction } from '@/app/actions/newsletter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Body } from '@/components/site/primitives'

/**
 * NewsletterSignup — compact public email signup for the site footer band.
 *
 * Posts to subscribeNewsletterAction (no auth) with a hidden source so the
 * subscriber row records where it came from. Shows an inline success state
 * after a successful subscribe and an inline error if it fails.
 *
 * Brand-voice clean, shadcn Input/Button/Label only, semantic token classes,
 * no banned words, no em-dashes. White-on-navy text uses the on-photo tone of
 * the site Body primitive so no raw color class lands in this file. The form
 * sits on a bg-card panel so the Input renders its semantic tokens on a light
 * surface for contrast against the navy footer.
 */

export function NewsletterSignup({ source = 'site-footer' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'submitting') return
    setStatus('submitting')
    setMessage('')

    const formData = new FormData()
    formData.set('email', email.trim())
    formData.set('source', source)

    try {
      const result = await subscribeNewsletterAction(formData)
      if (result.ok) {
        setStatus('done')
      } else {
        setStatus('error')
        setMessage(
          result.error === 'invalid_email'
            ? 'That email does not look right. Check it and try again.'
            : 'We could not sign you up just now. Try again in a moment.',
        )
      }
    } catch {
      setStatus('error')
      setMessage('We could not sign you up just now. Try again in a moment.')
    }
  }

  const isDone = status === 'done'
  const isSubmitting = status === 'submitting'
  const isError = status === 'error'

  return (
    <div className="w-full max-w-md">
      <h3 className="font-display text-lg tracking-[-0.01em] text-primary-foreground">
        Bend real estate, monthly.
      </h3>
      <Body size="small" tone="on-photo" className="mt-1 text-primary-foreground/75">
        Market shifts, new listings, and one neighborhood, once a month. No spam.
      </Body>

      {isDone ? (
        <div className="mt-4 rounded-xl bg-card px-4 py-3">
          <Body size="small" tone="primary">
            You are in. Watch for the next issue.
          </Body>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 rounded-xl bg-card p-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label htmlFor="newsletter-email" className="sr-only">
              Email address
            </Label>
            <Input
              id="newsletter-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="shrink-0">
            {isSubmitting ? 'Subscribing' : 'Subscribe'}
          </Button>
        </form>
      )}

      {isError && message ? (
        <Body size="small" tone="on-photo" className="mt-2 text-primary-foreground/80" role="alert">
          {message}
        </Body>
      ) : null}
    </div>
  )
}

export default NewsletterSignup
