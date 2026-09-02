'use client'

/**
 * Income-property alert capture on /invest — HomeAlertSheet's sibling with the
 * multi-family pin (a narrowing filter, so the capture contract holds). Same
 * hardened submitSearchAlertSignup path: honeypot, per-IP limit, native buyer
 * lead, instant sequence enroll.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const FILTERS = { propertyType: 'multi-family' } as const

export function InvestAlertSheet() {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
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
        rememberGuestWatch(buildGuestWatchFromFilters({ ...FILTERS })) // hydration-safe
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
    label: 'Where should new income listings go?',
    children: 'One email per new multi-family or income listing in Central Oregon. Unsubscribe any time.',
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
    advanceLabel: 'Get income-property alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: 'Set. New income listings land by email when they hit the market.',
            children: 'One email per new listing. Pause or unsubscribe from any alert email.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Setting up your alert.' }]
        : status === 'failed'
          ? [askStep, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : [askStep]

  const currentStepId =
    status === 'sent' ? 'sent' : status === 'sending' ? 'sending' : status === 'failed' ? 'failed' : 'email'

  return (
    <V3Sheet
      id="alerts"
      eyebrow="Income-property alerts"
      heading="Hear about income properties first"
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
