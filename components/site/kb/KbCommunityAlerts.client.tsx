'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { BellAlertIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'

/**
 * KB Community Alerts — inline email capture for community pages.
 *
 * Reuses the existing guest listing-alert backend (`submitSearchAlertSignup`
 * + `guest_search_alerts` table). Prefills city + subdivision from the
 * community registry so the captured alert matches the page the visitor
 * is looking at. No new backend wiring — same server action, same DB table,
 * same FUB integration that SearchAlertCapture uses on /search.
 *
 * KB design register: navy background, cream text, hard borders — consistent
 * with the KB section library (kb.css `.comm-alerts-*` classes).
 */
export function KbCommunityAlerts({
  communityName,
  city,
  subdivision,
}: {
  communityName: string
  city: string
  subdivision: string
}) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — humans never see this
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const filters: Record<string, string> = {
    city,
    ...(subdivision ? { subdivision } : {}),
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setState('idle')
    setErrorMsg('')
    startTransition(async () => {
      const res = await submitSearchAlertSignup({ email, filters, company })
      if (res.ok) {
        setState('done')
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
            Get new {communityName}
            <br />
            listings by email
          </h2>
          <p className="comm-alerts-p">
            Enter your email. When a home hits the market in {communityName}, you hear first.
          </p>
        </div>
        <form className="comm-alerts-form" onSubmit={onSubmit} noValidate>
          {/* Honeypot: visually + a11y hidden, not tab-reachable. Bots fill it. */}
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
