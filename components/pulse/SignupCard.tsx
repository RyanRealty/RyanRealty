'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dismissSignup } from '@/lib/pulse-saves'
import { trackEvent } from '@/lib/tracking'

type Props = {
  onDismiss: () => void
  triggeredBy: 'like_threshold' | 'dwell' | 'manual'
}

/**
 * In-feed signup card. Surfaces after a user likes 3 listings, replacing
 * the older modal flow. Card sits in the scroll like any other feed item
 * so it doesn't break the addictive scroll loop.
 */
export default function SignupCard({ onDismiss, triggeredBy }: Props) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorText, setErrorText] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setStatus('idle')
    setErrorText(null)
    try {
      const eventId = `pulse-signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const resp = await fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'Lead',
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          eventId,
          customData: {
            content_name: 'Pulse In-Feed Signup',
            lead_type: 'pulse_feed',
            value: 100,
            currency: 'USD',
            triggered_by: triggeredBy,
          },
        }),
      })
      if (!resp.ok) throw new Error(`signup failed (${resp.status})`)
      trackEvent('generate_lead', {
        source: 'pulse_feed_card_signup',
        triggered_by: triggeredBy,
      })
      setStatus('ok')
      dismissSignup()
      setTimeout(onDismiss, 1500)
    } catch (err) {
      setStatus('error')
      setErrorText(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDismiss() {
    dismissSignup()
    onDismiss()
  }

  if (status === 'ok') {
    return (
      <article className="overflow-hidden rounded-2xl bg-emerald-700 text-emerald-50 shadow-lg">
        <div className="p-6 text-center">
          <p
            className="font-display text-2xl"
            style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
          >
            Got it. You will hear from us.
          </p>
          <p className="mt-2 text-sm text-emerald-100/90">
            Watch your inbox for a note when similar homes hit the market.
          </p>
        </div>
      </article>
    )
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg">
      <div className="px-5 pb-6 pt-6 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/75">
          Liked a few?
        </p>
        <p
          className="mt-2 font-display text-2xl leading-tight sm:text-3xl"
          style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
        >
          Save your favorites. We will text you when similar homes hit the market.
        </p>
        <p className="mt-2 text-sm text-primary-foreground/85">
          A short note when something interesting moves. No spam, no pressure. Unsubscribe whenever.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              placeholder="First name (optional)"
              className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/40"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/40"
            />
          </div>
          {status === 'error' && (
            <p className="rounded-md border border-rose-300/40 bg-rose-500/10 p-2 text-xs text-rose-50">
              {errorText ?? 'We could not send that. Try again in a moment.'}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              disabled={submitting}
              className="text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Keep browsing
            </Button>
            <Button
              type="submit"
              disabled={submitting || !email.trim()}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              {submitting ? 'Sending…' : 'Send me updates'}
            </Button>
          </div>
        </form>
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-primary-foreground/55">
          Ryan Realty · 541.213.6706 · ryan-realty.com
        </p>
      </div>
    </article>
  )
}
