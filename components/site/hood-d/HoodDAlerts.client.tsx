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
import { readRrSessionId } from '@/lib/tracking'

export function HoodDAlerts({
  cityName,
  neighborhoodName,
}: {
  cityName: string
  neighborhoodName: string
}) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const res = await submitSearchAlertSignup({
        email,
        filters: { city: cityName, propertyType: 'A' },
        company,
        sessionId: readRrSessionId(), // hydration-safe: event/effect storage only
      })
      if (res.ok) {
        rememberGuestWatch( // hydration-safe: event/effect storage only
          buildGuestWatchFromPlace({
            communityName: cityName,
            city: cityName,
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
    <section className="hood-d-alerts" id="alerts">
      <div className="hood-d-wrap">
        <h2 className="hood-d-display">Alerts</h2>
        <p>
          Enter your email. When a home hits the market in {cityName} (including {neighborhoodName}
          ), you hear first. One email per new listing. Unsubscribe any time.
        </p>
        {state === 'done' ? (
          <p className="hood-d-alerts-done">You are on the list.</p>
        ) : (
          <form className="hood-d-alerts-form" onSubmit={onSubmit}>
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
              className="hood-d-hp"
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending' : `Alert me in ${neighborhoodName}`}
            </Button>
          </form>
        )}
        {state === 'error' ? <p className="hood-d-alerts-done">Try that email again.</p> : null}
      </div>
    </section>
  )
}
