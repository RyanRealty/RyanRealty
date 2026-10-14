'use client'

/**
 * Listing-alert capture on the under-$500K hub. Same action as /buy and
 * /buy/alerts: submitSearchAlertSignup. Ad-cookie box + US/EU notice match
 * the other public forms. No SMS signup. gclid / fbclid / utm ride in
 * getLpContext + landingSearch.
 */
import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { V3Button } from '@/components/site/v3/atoms'
import { V3Input } from '@/components/site/v3/V3Input'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { fireSearchEvent } from '@/components/search/search-events.client'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { getLpContext, readRrSessionId, trackEvent, trackLandingPageView } from '@/lib/tracking'
import { buildBuyAlertFilters } from '@/app/buy/alerts/_v3/buy-alerts-filters'
import { ALERT_TOWNS, DEFAULT_ALERT_TOWNS, FORM_ID, LINKS, LP_VARIANT, TRAP } from './constants'
import '@/components/site/v3/V3Ask.css'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const DEFAULT_TOWNS = new Set<string>(DEFAULT_ALERT_TOWNS)

export function Under500kSignup() {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState('')
  const [adCookies, setAdCookies] = useState(false)
  const [adMatch, setAdMatch] = useState(false)
  const restricted = useFormConsentRestricted()

  useEffect(() => {
    trackLandingPageView(LP_VARIANT) // hydration-safe: effect only
  }, [])

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const data = new FormData(form)
      const towns = data.getAll('town').map((v) => String(v)).filter(Boolean)
      const email = String(data.get('email') ?? '')
      if (towns.length === 0) {
        setProblem('Pick at least one town.')
        setStatus('failed')
        return
      }
      if (!email.trim()) {
        setProblem('Enter an email so we can send new listings.')
        setStatus('failed')
        return
      }

      writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render
      trackEvent('click_cta', {
        cta: 'get_listing_alerts',
        cta_location: 'signup',
        surface: 'buy_under_500k',
      })

      const filters = buildBuyAlertFilters({
        towns,
        maxPrice: 500_000,
      })
      const lpContext = getLpContext(LP_VARIANT) // hydration-safe
      setStatus('sending')
      setProblem('')
      try {
        const result = await submitSearchAlertSignup({
          email,
          filters,
          company: String(data.get(TRAP.name) ?? ''),
          sessionId: readRrSessionId(), // hydration-safe
          formId: FORM_ID,
          lpVariant: LP_VARIANT,
          lpContext,
          landingSearch: typeof window !== 'undefined' ? window.location.search : '',
          adMatchConsent: restricted === true && adMatch,
        })
        if (result.ok) {
          rememberGuestWatch(buildGuestWatchFromFilters(filters)) // hydration-safe: event/effect storage only
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
          trackEvent('sign_up', { method: 'email', form: FORM_ID })
          setStatus('sent')
          return
        }
        setProblem(result.error ?? 'We could not save that alert. Try again.')
        setStatus('failed')
      } catch {
        setProblem('We could not save that alert. Try again.')
        setStatus('failed')
      }
    },
    [adCookies, adMatch, restricted],
  )

  if (status === 'sent') {
    return (
      <div className="v3-under500-status" role="status">
        <p>
          <strong>You are on the list.</strong> We will email when a new residential listing under $500,000 matches the towns you picked.
        </p>
      </div>
    )
  }

  return (
    <form className="v3-ask__form" onSubmit={onSubmit} noValidate={false}>
      <div className="v3-under500-trap" aria-hidden="true">
        <label htmlFor="under500-company">{TRAP.label}</label>
        <input
          id="under500-company"
          name={TRAP.name}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="v3-ask__fields">
        <fieldset className="v3-ask__field v3-ask__field--full">
          <legend className="v3-ask__label">Towns</legend>
          <p className="v3-under500-hint">Residential listings under $500,000. You can change towns later.</p>
          <div className="v3-under500-towns">
            {ALERT_TOWNS.map((town) => (
              <label key={town.id} className="v3-under500-town">
                <input type="checkbox" name="town" value={town.id} defaultChecked={DEFAULT_TOWNS.has(town.id)} />
                {town.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="v3-ask__field--full">
          <V3Input
            id="under500-email"
            name="email"
            label="Email"
            kind="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            maxLength={200}
          />
        </div>
      </div>

      <div className="v3-ask__consent">
        <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
      </div>

      {status === 'failed' && problem ? (
        <p className="v3-under500-status" role="alert">
          {problem}
        </p>
      ) : null}
      {status === 'sending' ? <p className="v3-under500-status">Saving your alert.</p> : null}

      <div className="v3-ask__actions">
        <V3Button type="submit" disabled={status === 'sending'}>
          Email me new listings under $500K
        </V3Button>
      </div>

      <p className="v3-under500-cadence">
        Free. One email per new listing. Unsubscribe any time.{' '}
        <Link href={LINKS.privacy}>Privacy</Link>
      </p>

      <FormAdConsentNotice
        surface="ask"
        restricted={restricted}
        adMatchChecked={adMatch}
        onAdMatchCheckedChange={setAdMatch}
      />
    </form>
  )
}
