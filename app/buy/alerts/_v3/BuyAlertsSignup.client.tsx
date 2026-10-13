'use client'

/**
 * /buy/alerts capture island. Same action as the other listing-alert sheets:
 * submitSearchAlertSignup, honeypot company, guest-watch residual, alert_create.
 * Cadence and unsubscribe are visitor-visible sentences in this file so
 * ci:alert-capture-disclosure can read them after comments are stripped.
 */
import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { V3Button } from '@/components/site/v3/atoms'
import { V3Input } from '@/components/site/v3/V3Input'
import { formatPriceStop, V3_PRICE_STOPS } from '@/components/site/v3/V3Range.logic'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { fireSearchEvent } from '@/components/search/search-events.client'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { getLpContext, readRrSessionId, trackEvent, trackLandingPageView } from '@/lib/tracking'
import {
  BUY_ALERTS_BED_OPTIONS,
  BUY_ALERTS_COPY,
  BUY_ALERTS_DEFAULT_TOWNS,
  BUY_ALERTS_FORM_ID,
  BUY_ALERTS_LINKS,
  BUY_ALERTS_LP_VARIANT,
  BUY_ALERTS_TOWNS,
} from './buy-alerts-constants'
import { buildBuyAlertFilters, parseOptionalBound } from './buy-alerts-filters'
import '@/components/site/v3/V3Ask.css'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const FORM_CADENCE: typeof BUY_ALERTS_COPY.formCadence =
  'Free. One email per new listing. Unsubscribe any time.'

const PRICE_OPTIONS = V3_PRICE_STOPS.filter((n) => n > 0).map((n) => ({
  value: String(n),
  label: formatPriceStop(n),
}))

const DEFAULT_TOWNS = new Set<string>(BUY_ALERTS_DEFAULT_TOWNS)

export function BuyAlertsSignup() {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState('')
  const [adCookies, setAdCookies] = useState(false)
  const [adMatch, setAdMatch] = useState(false)
  const restricted = useFormConsentRestricted()

  useEffect(() => {
    trackLandingPageView(BUY_ALERTS_LP_VARIANT) // hydration-safe: effect only
  }, [])

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const data = new FormData(form)
      const towns = data.getAll('town').map((v) => String(v)).filter(Boolean)
      const email = String(data.get('email') ?? '')
      if (towns.length === 0) {
        setProblem(BUY_ALERTS_COPY.formTownRequired)
        setStatus('failed')
        return
      }
      if (!email.trim()) {
        setProblem(BUY_ALERTS_COPY.formEmailRequired)
        setStatus('failed')
        return
      }

      writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render
      trackEvent('click_cta', {
        cta: 'get_listing_alerts',
        cta_location: 'signup',
        surface: 'buy_alerts',
      })

      const filters = buildBuyAlertFilters({
        towns,
        minPrice: parseOptionalBound(String(data.get('minPrice') ?? '')),
        maxPrice: parseOptionalBound(String(data.get('maxPrice') ?? '')),
        beds: parseOptionalBound(String(data.get('beds') ?? '')),
      })
      const lpContext = getLpContext(BUY_ALERTS_LP_VARIANT) // hydration-safe
      setStatus('sending')
      setProblem('')
      try {
        const result = await submitSearchAlertSignup({
          email,
          filters,
          company: String(data.get('company') ?? ''),
          sessionId: readRrSessionId(), // hydration-safe
          formId: BUY_ALERTS_FORM_ID,
          lpVariant: BUY_ALERTS_LP_VARIANT,
          lpContext,
        })
        if (result.ok) {
          rememberGuestWatch(buildGuestWatchFromFilters(filters)) // hydration-safe: event/effect storage only
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
          trackEvent('sign_up', { method: 'email', form: BUY_ALERTS_FORM_ID })
          setStatus('sent')
          return
        }
        setProblem(result.error ?? BUY_ALERTS_COPY.formFailed)
        setStatus('failed')
      } catch {
        setProblem(BUY_ALERTS_COPY.formFailed)
        setStatus('failed')
      }
    },
    [adCookies],
  )

  if (status === 'sent') {
    return (
      <div className="buy-alerts-status" role="status">
        <p>
          <strong>{BUY_ALERTS_COPY.formConfirmHeading}.</strong> {BUY_ALERTS_COPY.formConfirmBody}
        </p>
      </div>
    )
  }

  return (
    <form className="v3-ask__form buy-alerts-form" onSubmit={onSubmit} noValidate={false}>
      <div className="buy-alerts-trap" aria-hidden="true">
        <label htmlFor="buy-alerts-company">Company</label>
        <input
          id="buy-alerts-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="v3-ask__fields">
        <fieldset className="v3-ask__field v3-ask__field--full">
          <legend className="v3-ask__label">{BUY_ALERTS_COPY.formTowns}</legend>
          <p className="buy-alerts-hint">{BUY_ALERTS_COPY.formTownHint}</p>
          <div className="buy-alerts-towns">
            {BUY_ALERTS_TOWNS.map((town) => (
              <label key={town.id} className="buy-alerts-town">
                <input
                  type="checkbox"
                  name="town"
                  value={town.id}
                  defaultChecked={DEFAULT_TOWNS.has(town.id)}
                />
                {town.label}
              </label>
            ))}
          </div>
        </fieldset>

        <V3Input
          id="buy-alerts-min"
          name="minPrice"
          label={BUY_ALERTS_COPY.formPriceFrom}
          kind="select"
          options={[{ value: '', label: 'Any' }, ...PRICE_OPTIONS]}
          defaultValue=""
        />
        <V3Input
          id="buy-alerts-max"
          name="maxPrice"
          label={BUY_ALERTS_COPY.formPriceTo}
          kind="select"
          options={[{ value: '', label: 'Any' }, ...PRICE_OPTIONS]}
          defaultValue=""
        />
        <V3Input
          id="buy-alerts-beds"
          name="beds"
          label={BUY_ALERTS_COPY.formBeds}
          kind="select"
          options={BUY_ALERTS_BED_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          defaultValue=""
        />
        <div className="v3-ask__field--full">
          <V3Input
            id="buy-alerts-email"
            name="email"
            label={BUY_ALERTS_COPY.formEmail}
            kind="email"
            required
            autoComplete="email"
            placeholder={BUY_ALERTS_COPY.formEmailPlaceholder}
            maxLength={200}
          />
        </div>
      </div>

      <div className="v3-ask__consent">
        <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
      </div>

      {status === 'failed' && problem ? (
        <p className="buy-alerts-status" role="alert">
          {problem}
        </p>
      ) : null}
      {status === 'sending' ? <p className="buy-alerts-status">{BUY_ALERTS_COPY.formSending}</p> : null}

      <div className="v3-ask__actions">
        <V3Button type="submit" disabled={status === 'sending'}>
          {BUY_ALERTS_COPY.formSubmit}
        </V3Button>
      </div>

      <p className="buy-alerts-cadence">
        {FORM_CADENCE}{' '}
        <Link href={BUY_ALERTS_LINKS.privacy}>{BUY_ALERTS_COPY.linkPrivacy}</Link>
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
