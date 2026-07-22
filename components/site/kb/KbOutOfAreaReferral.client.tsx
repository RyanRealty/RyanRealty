'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { submitOutOfAreaReferral } from '@/app/actions/out-of-area-referral'

/**
 * KB Out-of-area referral capture — the /oregon/[city] form (W12 referral
 * tier). Same KB register as KbCommunityAlerts (navy comm-alerts family from
 * kb.css), stacked fields instead of a single row: name, email, and what they
 * are looking for. Email-only contact field by design: no phone input, so no
 * SMS consent surface is required (A2P gate). The server action tags
 * geo:out-of-area + referral:candidate and NOTHING auto-sends to the lead.
 */
export function KbOutOfAreaReferral({ citySlug, cityName }: { citySlug: string; cityName: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [company, setCompany] = useState('') // honeypot, humans never see it
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setState('idle')
    setErrorMsg('')
    startTransition(async () => {
      const res = await submitOutOfAreaReferral({ citySlug, name, email, notes, company })
      if (res.ok) {
        setState('done')
      } else {
        setState('error')
        setErrorMsg(res.error)
      }
    })
  }

  const showArrow = !pending

  if (state === 'done') {
    return (
      <section className="section comm-alerts" id="referral" aria-label={`${cityName} broker referral`}>
        <div className="comm-alerts-inner">
          <p className="comm-alerts-confirm">
            Got it. A broker from our team reads this today and connects you with a {cityName} agent
            worth your time. Watch your inbox.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="section comm-alerts" id="referral" aria-label={`${cityName} broker referral`}>
      <div className="comm-alerts-inner">
        <div className="comm-alerts-copy">
          <span className="sec-index">The referral</span>
          <h2 className="comm-alerts-h display">
            Get a {cityName}
            <br />
            broker we trust
          </h2>
          <p className="comm-alerts-p">
            Tell us what you are looking for in {cityName}. We find a local broker who fits, make the
            introduction, and step back. No cost to you, no obligation.
          </p>
        </div>
        <div className="comm-alerts-form-wrap">
          <form className="comm-alerts-form comm-alerts-form-stack" onSubmit={onSubmit} noValidate>
            {/* Honeypot: visually + a11y hidden, not tab-reachable. Bots fill it. */}
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="sr-only"
            />
            <input
              type="text"
              name="name"
              autoComplete="name"
              maxLength={120}
              placeholder="Your name"
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="comm-alerts-input comm-alerts-field"
              disabled={pending}
            />
            <input
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              required
              placeholder="you@email.com"
              aria-label={`Email for your ${cityName} broker introduction`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="comm-alerts-input comm-alerts-field"
              disabled={pending}
            />
            <textarea
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder={`What are you looking for in ${cityName}? Buying, selling, budget, timing.`}
              aria-label="What you are looking for"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="comm-alerts-input comm-alerts-field comm-alerts-textarea"
              disabled={pending}
            />
            <button
              type="submit"
              disabled={pending}
              className="comm-alerts-btn comm-alerts-field"
              aria-label="Request a broker introduction"
            >
              {pending ? 'Sending...' : 'Connect me'}
              {showArrow ? <span className="arr" aria-hidden="true"> →</span> : null}
            </button>
          </form>
          {state === 'error' && errorMsg ? (
            <p className="comm-alerts-error" role="alert">{errorMsg}</p>
          ) : null}
          <p className="comm-alerts-fine">One introduction. Your email goes to our team, not a list.</p>
        </div>
      </div>
    </section>
  )
}
