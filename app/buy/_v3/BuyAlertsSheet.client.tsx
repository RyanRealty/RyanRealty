'use client'

/**
 * /buy listing-alert ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. Same action the KB band called:
 * submitSearchAlertSignup in app/actions/search-alert-capture.ts, fields
 * email + filters (propertyType A, empty city = Central Oregon SFR) +
 * company honeypot. Guest-watch residual and alert_create measurement stay.
 */
import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const FILTERS = { propertyType: 'A' } as const

const ASK_STEP: V3SheetStep = {
  id: 'email',
  label: 'Where should new listings go?',
  field: {
    kind: 'email',
    name: 'email',
    label: 'Email',
    placeholder: 'you@email.com',
    required: true,
    autoComplete: 'email',
    maxLength: 200,
    requiredMessage: 'An email is required so the alert has somewhere to land.',
    invalidMessage: 'That address does not look complete.',
  },
  children: 'When a single-family home lists in Bend, Redmond, Sisters, Sunriver, or nearby, we email you. One email per new listing. Unsubscribe any time.',
  advanceLabel: 'Get listing alerts',
}

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Saving your alert.',
}

export function BuyAlertsSheet() {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState('email')
  const [problem, setProblem] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(async (answers: Readonly<Record<string, string>>) => {
    setStatus('sending')
    try {
      const result = await submitSearchAlertSignup({
        email: answers.email ?? '',
        filters: { ...FILTERS },
        company: answers.company ?? '',
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (result.ok) {
        rememberGuestWatch( // hydration-safe: event/effect storage only
          buildGuestWatchFromPlace({
            communityName: 'Central Oregon',
            city: '',
            extraFilters: { ...FILTERS },
          }),
        )
        fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
        setConfirmation('Alert saved. New single-family listings in Central Oregon will come to that inbox.')
        setStatus('sent')
        return
      }
      setProblem(result.error ?? 'That did not save. Try again.')
      setStatus('failed')
    } catch {
      setProblem('That did not save. Check the connection and try again.')
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

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [{ id: 'sent', label: confirmation }]
      : status === 'sending'
        ? [SENDING_STEP]
        : status === 'failed'
          ? [{ ...ASK_STEP, id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : [ASK_STEP]

  const currentStepId =
    status === 'sent' ? 'sent' : status === 'sending' ? 'sending' : status === 'failed' ? 'failed' : stepId

  return (
    <V3Sheet
      id="get-alerts"
      heading="Get listing alerts"
      eyebrow="Central Oregon"
      steps={steps}
      currentStepId={currentStepId}
      trap={{ name: 'company', label: 'Company' }}
      showProgress={status === 'asking'}
      onStepChange={(id) => {
        if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
        setStepId(id)
      }}
      onAdvance={onAdvance}
    />
  )
}
