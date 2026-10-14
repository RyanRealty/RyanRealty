'use client'

/**
 * Price-drop pages' on-page ask. Same capture contract as the other listing
 * alerts: submitSearchAlertSignup, field `email`, company trap. The row is a
 * price-cut watch (price_change on, everything else off), not a new-listing
 * feed. Ads consent and gclid/fbclid/utm ride the same path as /sell and
 * /contact. generate_lead stays lead_type + form_id only.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/lib/analytics/submit-alert-signup'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { FormAdConsentNotice, FormAdCookieBox, useFormConsentRestricted } from '@/components/site/FormAdConsent'
import { writeFormAdConsent } from '@/lib/identity/form-ad-consent'
import { PRICE_DROP_ALERT_EVENTS } from './drops-constants'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function PriceDropAlertsSheet({
  placeLabel,
  city,
  extraFilters,
}: {
  placeLabel: string
  city: string
  extraFilters?: Record<string, string>
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const [adCookies, setAdCookies] = useState(false)
  const [adMatch, setAdMatch] = useState(false)
  const answersRef = useRef<Record<string, string>>({})
  const filters = useMemo(() => extraFilters ?? {}, [extraFilters])
  const restricted = useFormConsentRestricted()

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const payloadFilters: Record<string, string> = { ...filters }
      if (city) payloadFilters.city = city
      writeFormAdConsent(adCookies) // hydration-safe: submit handler, not render
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters: payloadFilters,
          company: answers.company ?? '',
          sessionId: readRrSessionId(), // hydration-safe
          events: { ...PRICE_DROP_ALERT_EVENTS },
          ...(restricted && adMatch ? { adMatchConsent: true } : {}),
          landingSearch: typeof window !== 'undefined' ? window.location.search : '', // hydration-safe: submit handler, not render
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: placeLabel,
              city,
              extraFilters: filters,
            }),
          )
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
          setStatus('sent')
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [adCookies, adMatch, city, filters, placeLabel, restricted],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...event.answers }
      if (event.toStepId !== null) return
      void send(answersRef.current)
    },
    [send],
  )

  const askStep: V3SheetStep = {
    id: 'email',
    label: `Where should ${placeLabel} price cuts go?`,
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      placeholder: 'you@email.com',
      requiredMessage: 'An email is required so the alert has somewhere to land.',
      invalidMessage: 'That address does not look complete.',
    },
    children: 'One email per new listing that drops its price. Unsubscribe any time.',
    advanceLabel: 'Watch price cuts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. We email you when a ${placeLabel} home drops its asking price.`,
            children: 'Unsubscribe any time from any alert email.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Setting up your price-drop alert.' }]
        : status === 'failed'
          ? [askStep, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : [askStep]

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'failed'
          ? 'failed'
          : 'email'

  return (
    <V3Sheet
      id="alerts"
      eyebrow="Price-drop alerts"
      heading={`Email me when homes in ${placeLabel} drop their price`}
      trap={{ name: 'company', label: 'Company' }}
      steps={steps}
      currentStepId={currentStepId}
      showEcho={false}
      showProgress={false}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
      footer={
        status === 'sent' || status === 'sending' ? null : (
          <div className="flex flex-col gap-3">
            <FormAdCookieBox checked={adCookies} onCheckedChange={setAdCookies} />
            <FormAdConsentNotice
              restricted={restricted}
              adMatchChecked={adMatch}
              onAdMatchCheckedChange={setAdMatch}
            />
          </div>
        )
      }
    />
  )
}
