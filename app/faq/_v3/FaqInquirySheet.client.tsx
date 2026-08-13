'use client'

/**
 * The FAQ hub and answer pages' one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. It calls submitMarketPageInquiry with
 * variant: 'inquiry' and the same three field names: name, email, message.
 * Three fields, no phone, so the page ships no SMS-consent surface.
 *
 * This file is the FAQ route's own, not an import of a market-page sheet.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const ASK_STEPS: readonly V3SheetStep[] = [
  {
    id: 'question',
    label: 'What are you weighing?',
    field: {
      kind: 'textarea',
      name: 'message',
      label: 'Your question',
      rows: 4,
      maxLength: 1200,
      placeholder: 'A neighborhood, a first purchase, listing cost, or how we work',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'name',
    label: 'Who should the broker reply to?',
    field: {
      name: 'name',
      label: 'Name',
      required: true,
      autoComplete: 'name',
      maxLength: 120,
      requiredMessage: 'A name is required so the reply is addressed to someone.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'email',
    label: 'Where should the answer go?',
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 200,
      requiredMessage: 'An email is required so the answer has somewhere to land.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Ask a broker',
  },
]

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Sending your question.',
}

export function FaqInquirySheet() {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('question')
  const [problem, setProblem] = useState<string>('')
  const [confirmation, setConfirmation] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(async (answers: Readonly<Record<string, string>>) => {
    setStatus('sending')
    try {
      const result = await submitMarketPageInquiry({
        variant: 'inquiry',
        name: answers.name ?? '',
        email: answers.email ?? '',
        message: answers.message ?? '',
      })
      if (result.ok) {
        setConfirmation(result.message ?? 'Got it. A local broker will follow up.')
        setStatus('sent')
        return
      }
      setProblem(result.message ?? 'That did not send. Try again.')
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

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [{ id: 'sent', label: confirmation }]
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
          : stepId

  return (
    <V3Sheet
      id="ask"
      heading="Did we miss your question?"
      eyebrow="Talk to a broker"
      steps={steps}
      currentStepId={currentStepId}
      showProgress={status === 'asking'}
      onStepChange={(id) => {
        if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
        setStepId(id)
      }}
      onAdvance={onAdvance}
    />
  )
}
