'use client'

/**
 * /buy/alerts capture island. Same action as the other listing-alert sheets:
 * submitSearchAlertSignup, honeypot company, guest-watch residual, alert_create.
 * Cadence and unsubscribe are visitor-visible sentences in this file so
 * ci:alert-capture-disclosure can read them after comments are stripped.
 *
 * 2026-10-14: the form is the cream slab on the Stage photograph, the way the
 * address field is on /sell. Towns are chips, the email and the one filled
 * ask follow, and price and bedrooms fold under one disclosure so the fold
 * carries the ask and not a six-field form.
 */
import Link from 'next/link'
import { useCallback, useState, type FormEvent } from 'react'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { V3Button, V3Eyebrow } from '@/components/site/v3/atoms'
import { V3Input } from '@/components/site/v3/V3Input'
import { formatPriceStop, V3_PRICE_STOPS } from '@/components/site/v3/V3Range.logic'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { fireSearchEvent } from '@/components/search/search-events.client'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { getLpContext, readRrSessionId, trackEvent } from '@/lib/tracking'
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

  return (
    <div className="buy-alerts-slab" id="signup" aria-label={BUY_ALERTS_COPY.signupHeading}>
      {/* The H1 over the slab already says what this is; the slab's own line is
          the one fact a visitor weighs before typing (evaluator 2026-10-14: the
          page named itself four times in the fold). */}
      <header className="buy-alerts-slab__head">
        <V3Eyebrow>{BUY_ALERTS_COPY.signupEyebrow}</V3Eyebrow>
      </header>

      {status === 'sent' ? (
        <div className="buy-alerts-status buy-alerts-status--sent" role="status">
          <p>
            <strong>{BUY_ALERTS_COPY.formConfirmHeading}.</strong> {BUY_ALERTS_COPY.formConfirmBody}
          </p>
          <p>
            <Link href={BUY_ALERTS_LINKS.bendHomes}>{BUY_ALERTS_COPY.linkBendHomes}</Link>
          </p>
        </div>
      ) : (
        <form className="buy-alerts-form" onSubmit={onSubmit} noValidate={false}>
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

          <fieldset className="buy-alerts-towns-set">
            <legend className="buy-alerts-label">{BUY_ALERTS_COPY.formTowns}</legend>
            <div className="buy-alerts-towns">
              {BUY_ALERTS_TOWNS.map((town) => (
                <label key={town.id} className="buy-alerts-town">
                  <input
                    type="checkbox"
                    name="town"
                    value={town.id}
                    defaultChecked={DEFAULT_TOWNS.has(town.id)}
                  />
                  <span>{town.label}</span>
                </label>
              ))}
            </div>
            <p className="buy-alerts-hint">{BUY_ALERTS_COPY.formTownHint}</p>
          </fieldset>

          <details className="buy-alerts-more">
            <summary className="buy-alerts-more__summary">{BUY_ALERTS_COPY.formMoreFilters}</summary>
            <div className="buy-alerts-more__fields">
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
            </div>
          </details>

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

          {status === 'failed' && problem ? (
            <p className="buy-alerts-status" role="alert">
              {problem}
            </p>
          ) : null}
          {status === 'sending' ? <p className="buy-alerts-status">{BUY_ALERTS_COPY.formSending}</p> : null}

          <div className="buy-alerts-actions">
            <V3Button type="submit" disabled={status === 'sending'}>
              {BUY_ALERTS_COPY.formSubmit}
            </V3Button>
          </div>

          {/* The ask sits right under the field so it is in the first viewport
              at 1440 and 375; the opt-in cookie box and the notices follow it. */}
          <div className="buy-alerts-consent">
            <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
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
      )}
    </div>
  )
}
