'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setMyNewsletterMembership } from '@/app/actions/newsletter-membership-user'
import { CONTACT } from '@/lib/brand/contact'
import { cn } from '@/lib/utils'

type Props = {
  initialSubscribed: boolean
  /** False when a compliance hard stop makes the ON position unavailable. */
  canSubscribe: boolean
}

/**
 * The 'Monthly newsletter' toggle, backed by the user's newsletter_subscribers
 * row. Turning it off routes through the same status flip the one-click
 * unsubscribe link uses. Turning it on is consent-gated server-side and never
 * re-enables a hard-stopped address — when that is the case the switch renders
 * disabled with an explanation instead of failing on tap.
 *
 * Hand-rolled switch in the KB idiom (real button, role="switch", design
 * tokens) — account surfaces are shadcn burn-down targets per the G47 gate.
 */
export function NewsletterToggle({ initialSubscribed, canSubscribe }: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const [pending, startTransition] = useTransition()

  const blockedFromSubscribing = subscribed === false && canSubscribe === false
  const disabled = pending || blockedFromSubscribing

  function onToggle(next: boolean) {
    const previous = subscribed
    setSubscribed(next)
    startTransition(async () => {
      const result = await setMyNewsletterMembership(next)
      if (result.ok === false) {
        setSubscribed(previous)
        toast.error(result.error)
        return
      }
      setSubscribed(result.subscribed)
      toast.success(result.subscribed ? 'You are on the newsletter list.' : 'Newsletter turned off.')
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor="newsletter-toggle" className="text-sm font-semibold text-foreground">
            Monthly newsletter
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One issue a month with Central Oregon market numbers, new listings, and local events.
            Every issue carries a one-click unsubscribe link.
          </p>
        </div>
        <button
          id="newsletter-toggle"
          type="button"
          role="switch"
          aria-checked={subscribed}
          aria-label="Monthly newsletter"
          disabled={disabled}
          onClick={() => onToggle(subscribed === false)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            subscribed ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'block size-5 rounded-full bg-background shadow-sm transition-transform',
              subscribed ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
      {blockedFromSubscribing ? (
        <p className="text-xs text-muted-foreground">
          Email to this address is currently paused, so the newsletter cannot be turned back on
          here. Reply to any of our emails or call {CONTACT.phoneDirect} to turn it back on.
        </p>
      ) : null}
    </div>
  )
}
