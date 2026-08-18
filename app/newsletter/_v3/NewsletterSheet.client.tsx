'use client'

/**
 * /newsletter capture, as a barrel Sheet.
 *
 * Posts email + hidden source + sessionId to subscribeNewsletterAction.
 * Honeypot is the sheet trap (`company`). No send. No listing invent.
 */

import { useCallback, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { subscribeNewsletterAction } from '@/app/actions/newsletter-subscribe'
import { readRrSessionId } from '@/lib/tracking'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Subscribing.',
}

const ASK_STEPS: readonly V3SheetStep[] = [
  {
    id: 'email',
    label: 'Where should the briefing go?',
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      requiredMessage: 'An email is required so the briefing has somewhere to land.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Subscribe',
  },
]

export function NewsletterSheet({ source = 'newsletter-page' }: { source?: string }) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState('')

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const formData = new FormData()
        formData.set('email', answers.email ?? '')
        formData.set('source', source)
        formData.set('company', answers.company ?? '')
        const sessionId = readRrSessionId()
        if (sessionId) formData.set('sessionId', sessionId)

        const result = await subscribeNewsletterAction(formData)
        if (result.ok) {
          setStatus('sent')
          return
        }
        setProblem(
          result.error === 'invalid_email'
            ? 'That email does not look right. Check it and try again.'
            : 'We could not sign you up just now. Try again in a moment.',
        )
        setStatus('failed')
      } catch {
        setProblem('We could not sign you up just now. Try again in a moment.')
        setStatus('failed')
      }
    },
    [source],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      if (event.toStepId !== null) return
      void send(event.answers)
    },
    [send],
  )

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [{ id: 'sent', label: 'You are in. Watch for the next issue.' }]
      : status === 'sending'
        ? [SENDING_STEP]
        : status === 'failed'
          ? [...ASK_STEPS, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : ASK_STEPS

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
      id="newsletter"
      heading="Subscribe"
      eyebrow="Monthly briefing"
      steps={steps}
      currentStepId={currentStepId}
      trap={{ name: 'company', label: 'Company' }}
      showEcho={false}
      showProgress={false}
      onStepChange={(id) => {
        if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
