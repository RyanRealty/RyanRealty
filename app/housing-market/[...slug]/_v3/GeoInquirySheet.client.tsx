'use client'

/**
 * The catch-all geo report's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. It calls the same server action the KB
 * page's LeadCaptureBlock called, `submitMarketPageInquiry` in
 * app/housing-market/actions.ts, with the same payload shape and the same
 * three field names: `name`, `email`, `message`, under `variant: 'inquiry'`.
 * Nothing about what reaches submitPageCTA (CRM person and event, Meta CAPI,
 * canonical tagging, GA4 mirror) moved. Only the markup did. The payload is
 * written as an object literal rather than typed through LeadCapturePayload
 * so this file imports nothing from the legacy flat register. Three fields,
 * no phone, so the page still ships no SMS-consent surface.
 *
 * One sheet serves both the city branch and the community branch. Each route
 * owns its ask: this file is not an import of the hub or region sheet.
 *
 * Client because the step the visitor is on and the answers carried forward
 * are visitor-caused state, and because the send happens from the browser.
 *
 * CONTROLLED, on purpose. `steps` and `currentStepId` are derived from one
 * status value and always change together. While the send is in flight the
 * only rendered step is the terminal one, so a second click cannot fire a
 * second submit.
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
      placeholder: 'Buying, selling, or reading the numbers for a specific street',
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

export function GeoInquirySheet({ geoName }: { geoName: string }) {
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

  const heading = `Questions about the ${geoName} market?`

  return (
    <V3Sheet
      id="ask"
      heading={heading}
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
