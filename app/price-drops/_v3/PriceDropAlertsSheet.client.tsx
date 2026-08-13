'use client'

/**
 * Price-drop pages' on-page ask. Same capture contract as KbCommunityAlerts
 * on these routes: submitSearchAlertSignup, field `email`, filters as passed.
 * Product is new matching listings, not a price-drop digest.
 * Trap `company` is the honeypot the action already checks.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

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
  const answersRef = useRef<Record<string, string>>({})
  const filters = useMemo(() => extraFilters ?? {}, [extraFilters])

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const payloadFilters: Record<string, string> = { ...filters }
      if (city) payloadFilters.city = city
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters: payloadFilters,
          company: answers.company ?? '',
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
    [city, filters, placeLabel],
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
            children: 'Pause from any alert email.',
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
      trap={{ name: 'company', label: 'Company' }}
      steps={steps}
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
