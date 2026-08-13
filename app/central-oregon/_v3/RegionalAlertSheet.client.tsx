'use client'

/**
 * Regional (or city-scoped) SFR listing-alert capture as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS CARRIED ACROSS from RegionalSfrAlertsBand /
 * KbCommunityAlerts. Same action (`submitSearchAlertSignup`), same field name
 * (`email`), same filter map the KB band built: `city` (empty string on the
 * indexes, a city name on a place detail) plus `propertyType: 'A'`. Same two
 * side effects on success: guest-watch residual, then `alert_create`.
 *
 * The honeypot is a sheet-level `trap` named `company`. Its value rides in
 * onAdvance().answers and is forwarded to the action. A filled trap is the
 * action's signal to fake a success and write nothing. Hardcoding `company: ''`
 * is the same as having no trap.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const PROPERTY_TYPE = 'A'

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
      const filters: Record<string, string> = {
        city,
        propertyType: PROPERTY_TYPE,
      }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
          company: answers.company ?? '',
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: placeLabel,
              city,
              extraFilters: { propertyType: PROPERTY_TYPE },
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
    children: 'One email per new listing. Unsubscribe any time.',
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${placeLabel} listings land by email when they hit the market.`,
            children: 'One email per new listing. Pause or unsubscribe from any alert email.',
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
