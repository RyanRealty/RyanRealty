'use client'

/**
 * The homepage's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED from KbCommunityAlerts on this route:
 *   - the same server action, `submitSearchAlertSignup`
 *   - the same payload: `{ email, filters, company }`
 *   - filters are `{ city: '', propertyType: 'A' }` (SFR across the regional MLS,
 *     empty city, no subdivision). hasNarrowingFilter accepts propertyType alone.
 *   - field NAME `email`, trap NAME `company`
 *   - post-success: guest-watch residual, then `alert_create`
 *
 * Disclosure (visitor-readable): "One email per new listing. Unsubscribe any time."
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

const FILTERS = { propertyType: 'A' } as const

export function HomeAlertSheet() {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(async (answers: Readonly<Record<string, string>>) => {
    setStatus('sending')
    try {
      const result = await submitSearchAlertSignup({
        email: answers.email ?? '',
        filters: { city: '', ...FILTERS },
        company: answers.company ?? '',
      })
      if (result.ok) {
        rememberGuestWatch( // hydration-safe
          buildGuestWatchFromPlace({
            communityName: 'Central Oregon',
            city: '',
            extraFilters: { propertyType: 'A' },
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
  }, [])

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
    label: 'Where should new Central Oregon listings go?',
    children: 'One email per new listing. Unsubscribe any time.',
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
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: 'Set. New Central Oregon listings land by email when they hit the market.',
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
      heading="Get new Central Oregon listings by email"
      steps={steps}
      trap={{ name: 'company', label: 'Company' }}
      currentStepId={currentStepId}
      showProgress={false}
      showEcho={false}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
