'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { BellAlertIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'

/**
 * KB listing-alert email capture (city, community, listing, OH, price-drops).
 *
 * Reuses `submitSearchAlertSignup` + unified `listing_alerts`. Prefills filters
 * so the alert matches the page. Optional extraFilters (beds, price band) support
 * listing "homes like this" capture without a new backend.
 *
 * KB register: navy ground, cream text — `.comm-alerts-*` in kb.css.
 */
export function KbCommunityAlerts({
  communityName,
  city,
  subdivision = '',
  extraFilters,
  headline,
  body,
}: {
  communityName: string
  city: string
  /** Empty string = whole city (no subdivision filter). */
  subdivision?: string
  /** Extra narrowing filters (beds, minPrice, maxPrice, propertyType, …). Strings only. */
  extraFilters?: Record<string, string>
  /** Override H2 first line target name (defaults to communityName). */
  headline?: string
  /** Override supporting sentence. */
  body?: string
}) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — humans never see this
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const filters: Record<string, string> = {
    city,
    ...(subdivision ? { subdivision } : {}),
    ...(extraFilters ?? {}),
  }

  const titleTarget = headline ?? communityName
  const support =
    body ??
    `Enter your email. When a home hits the market in ${communityName}, you hear first.`

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setState('idle')
    setErrorMsg('')
    startTransition(async () => {
      const res = await submitSearchAlertSignup({ email, filters, company })
      if (res.ok) {
        setState('done')
        // Same alert_create event as SearchAlertCapture (measurement parity).
        fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
      } else {
        setState('error')
        setErrorMsg(res.error)
      }
    })
  }

  if (state === 'done') {
    return (
      <section className="section comm-alerts" aria-label={`${communityName} listing alerts`}>
        <div className="comm-alerts-inner">
          <BellAlertIcon className="comm-alerts-icon" aria-hidden />
          <p className="comm-alerts-confirm">
            Set. New {communityName} listings come to your inbox when they land.
          </p>
        </div>
      </section>
    )
  }

  const showArrow = !pending

  return (
    <section className="section comm-alerts" aria-label={`${communityName} listing alerts`}>
      <div className="comm-alerts-inner">
        <div className="comm-alerts-copy">
          <span className="sec-index">New listings</span>
          <h2 className="comm-alerts-h display">
            Get new {titleTarget}
            <br />
            listings by email
          </h2>
          <p className="comm-alerts-p">{support}</p>
        </div>
        <form className="comm-alerts-form" onSubmit={onSubmit} noValidate>
          <Input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="sr-only h-px w-px"
          />
          <Input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@email.com"
            aria-label={`Email for ${communityName} listing alerts`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="comm-alerts-input"
            disabled={pending}
          />
          <Button type="submit" disabled={pending} className="comm-alerts-btn" aria-label="Sign up for listing alerts">
            {pending ? 'Setting up...' : 'Get alerts'}
            {showArrow ? <span className="arr" aria-hidden="true">→</span> : null}
          </Button>
        </form>
        {state === 'error' && errorMsg ? (
          <p className="comm-alerts-error" role="alert">{errorMsg}</p>
        ) : null}
        <p className="comm-alerts-fine">One email per new listing. Unsubscribe any time.</p>
      </div>
    </section>
  )
}
