'use client'

/**
 * /refer-a-client capture as a barrel Sheet. One question per step.
 * Honeypot is `company` via V3Sheet trap. Phone steps require the
 * carrier SMS disclosure (ci:sms-consent).
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { trackEvent } from '@/lib/tracking'
import { submitInboundAgentReferral } from '@/app/actions/inbound-agent-referral'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const ASK_STEPS: readonly V3SheetStep[] = [
  {
    id: 'intent',
    label: 'Are they buying, selling, or both?',
    field: {
      kind: 'choice',
      name: 'intent',
      label: 'Intent',
      required: true,
      requiredMessage: 'Say whether they are buying, selling, or both.',
      options: [
        { value: 'buy', label: 'Buying' },
        { value: 'sell', label: 'Selling' },
        { value: 'both', label: 'Both' },
      ],
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'area',
    label: 'Which city or community?',
    field: {
      name: 'area',
      label: 'Area',
      required: true,
      maxLength: 200,
      placeholder: 'Bend, Tetherow, Sunriver',
      requiredMessage: 'Name the city or community they want.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'clientName',
    label: 'What is the client\'s name?',
    field: {
      name: 'clientName',
      label: 'Client name',
      required: true,
      autoComplete: 'off',
      maxLength: 120,
      requiredMessage: 'Enter the client\'s name.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'clientEmail',
    label: 'What is the client\'s email?',
    field: {
      kind: 'email',
      name: 'clientEmail',
      label: 'Client email',
      required: true,
      autoComplete: 'off',
      maxLength: 254,
      requiredMessage: 'An email is required so we can write the referral.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'clientPhone',
    label: 'A number for the client, if you have one.',
    field: {
      kind: 'tel',
      name: 'clientPhone',
      label: 'Client phone',
      autoComplete: 'off',
      maxLength: 40,
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'agentName',
    label: 'What is your name?',
    field: {
      name: 'agentName',
      label: 'Your name',
      required: true,
      autoComplete: 'name',
      maxLength: 120,
      requiredMessage: 'Enter your name.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'agentEmail',
    label: 'Where should we write you?',
    field: {
      kind: 'email',
      name: 'agentEmail',
      label: 'Your email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      requiredMessage: 'An email is required so we can send the referral agreement.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'brokerage',
    label: 'Which brokerage are you with?',
    field: {
      name: 'brokerage',
      label: 'Brokerage',
      required: true,
      maxLength: 200,
      requiredMessage: 'Enter your brokerage.',
    },
    advanceLabel: 'Continue',
  },
  {
    id: 'notes',
    label: 'Anything the receiving broker should know?',
    field: {
      kind: 'textarea',
      name: 'notes',
      label: 'Notes',
      rows: 3,
      maxLength: 1000,
      placeholder: 'Timing, budget, what they asked you',
    },
    advanceLabel: 'Send the referral',
  },
]

export function ReferSheet() {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('intent')
  const [problem, setProblem] = useState<string>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await submitInboundAgentReferral({
          intent: answers.intent ?? '',
          area: answers.area ?? '',
          clientName: answers.clientName ?? '',
          clientEmail: answers.clientEmail ?? '',
          clientPhone: answers.clientPhone ?? '',
          agentName: answers.agentName ?? '',
          agentEmail: answers.agentEmail ?? '',
          brokerage: answers.brokerage ?? '',
          notes: answers.notes ?? '',
          company: answers.company ?? '',
          smsConsent,
        })
        if (result.ok) {
          try {
            trackEvent('generate_lead', {
              source: 'inbound_agent_referral',
              intent: answers.intent,
            })
          } catch {
            // Tracking helper unavailable. Server-side lead still landed.
          }
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
    [smsConsent],
  )

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
      ? [
          {
            id: 'sent',
            label:
              'Referral received. A broker will write you first. We do not contact your client until the referral is in writing.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Sending the referral.' }]
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
    <>
      <V3Sheet
        id="refer-form"
        eyebrow="The referral"
        heading="Send a client"
        steps={steps}
        trap={{ name: 'company', label: 'Company' }}
        currentStepId={currentStepId}
        showProgress={status === 'asking'}
        onStepChange={(id) => {
          if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
          setStepId(id)
        }}
        onAdvance={onAdvance}
      />
      {status === 'asking' || status === 'failed' ? (
        <SmsConsentDisclosure checked={smsConsent} onCheckedChange={setSmsConsent} />
      ) : null}
    </>
  )
}
