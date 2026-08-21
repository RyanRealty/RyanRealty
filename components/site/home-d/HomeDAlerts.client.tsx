'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

export function HomeDAlerts() {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const res = await submitSearchAlertSignup({
        email,
        filters: { propertyType: 'A' },
        company,
      })
      if (res.ok) {
        rememberGuestWatch( // hydration-safe: event/effect storage only
          buildGuestWatchFromPlace({
            communityName: 'Central Oregon',
            city: '',
            extraFilters: { propertyType: 'A' },
          }),
        )
        setState('done')
        fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
      } else {
        setState('error')
      }
    })
  }

  return (
    <section className="home-d-alerts" id="get-alerts">
      <div className="home-d-wrap">
        <h2 className="home-d-display">New listings by email</h2>
        <p>When a single-family home lists in Central Oregon, you hear first.</p>
        {state === 'done' ? (
          <p className="home-d-alerts-done">You are on the list.</p>
        ) : (
          <form className="home-d-alerts-form" onSubmit={onSubmit}>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              className="home-d-hp"
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending' : 'Email me'}
            </Button>
          </form>
        )}
        {state === 'error' ? <p className="home-d-alerts-done">Try that email again.</p> : null}
      </div>
    </section>
  )
}
