'use client'

/**
 * Regional (or city-scoped) listing-alert capture as a barrel Sheet.
 *
 * Same action (`submitSearchAlertSignup`) and field name (`email`) as the KB
 * band it replaced. A place detail (a school, park, trail, course, venue or
 * event) passes its city, and the alert is that city, every property type,
 * daily (Matt 2026-10-14). The indexes pass no city, and the alert stays
 * houses (`propertyType: 'A'`) across the region: with no place and no type
 * the filter would match the whole feed, which hasNarrowingFilter refuses.
 * Every row is daily and its first email goes at signup. Same two side
 * effects on success: guest-watch residual, then `alert_create`.
 *
 * The honeypot is a sheet-level `trap` named `company`. Its value rides in
 * onAdvance().answers and is forwarded to the action. A filled trap is the
 * action's signal to fake a success and write nothing. Hardcoding `company: ''`
 * is the same as having no trap.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3/V3Sheet'
import { submitSearchAlertSignup } from '@/lib/analytics/submit-alert-signup'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

/** The region-wide indexes only: houses, so the alert is not the whole feed. */
const REGION_PROPERTY_TYPE = 'A'

export function RegionalAlertSheet({
  placeLabel,
  city = '',
}: {
  /** Visible name in the heading. Indexes pass "Central Oregon". */
  placeLabel: string
  /** MLS City filter. Empty string = whole region, same as the KB band. */
  city?: string
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const filters: Record<string, string> = city ? { city } : { propertyType: REGION_PROPERTY_TYPE }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
          frequency: 'daily',
          company: answers.company ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: placeLabel,
              ...(city ? { city } : { extraFilters: { propertyType: REGION_PROPERTY_TYPE } }),
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
    [city, placeLabel],
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
    label: `Where should new ${placeLabel} listings go?`,
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
    children: city
      ? 'Every new listing, every property type, in one email each morning. Unsubscribe any time.'
      : 'Every new house listing, in one email each morning. Unsubscribe any time.',
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${placeLabel} listings land in your inbox each morning.`,
            children: 'Every new listing in one email, with price changes on those homes. Unsubscribe from any alert email.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Setting up your alert.' }]
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
      eyebrow="New listings"
      heading={`Get new ${placeLabel} listings by email`}
      steps={steps}
      trap={{ name: 'company', label: 'Company' }}
      currentStepId={currentStepId}
      showEcho={false}
      showProgress={false}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
