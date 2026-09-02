'use client'

/**
 * Per-broker valuation ask. Capture contract unchanged: submitBrokerSellerLead
 * with variant 'seller' and fields address / name / email / phone / timeline / notes.
 * Payload is an object literal so this file imports nothing from LeadCaptureBlock.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, V3_ROOT_CLASS, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { submitBrokerSellerLead } from '@/app/team/actions'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

function askSteps(firstName: string): readonly V3SheetStep[] {
  return [
    {
      id: 'address',
      label: `The home ${firstName} should value`,
      field: {
        name: 'address',
        label: 'Property address',
        required: true,
        autoComplete: 'street-address',
        maxLength: 200,
        requiredMessage: 'An address is required so the CMA is about a real home.',
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
      label: 'Where should the CMA go?',
      field: {
        kind: 'email',
        name: 'email',
        label: 'Email',
        required: true,
        autoComplete: 'email',
        maxLength: 200,
        requiredMessage: 'An email is required so the CMA has somewhere to land.',
        invalidMessage: 'That address does not look complete.',
      },
      advanceLabel: 'Continue',
    },
    {
      id: 'phone',
      label: 'A number to call, if you want one.',
      field: {
        kind: 'tel',
        name: 'phone',
        label: 'Phone',
        autoComplete: 'tel',
        maxLength: 40,
      },
      advanceLabel: 'Continue',
    },
    {
      id: 'timeline',
      label: 'When are you thinking of selling?',
      field: {
        name: 'timeline',
        label: 'Timeline',
        placeholder: '3 to 6 months',
        maxLength: 80,
      },
      advanceLabel: 'Continue',
    },
    {
      id: 'notes',
      label: 'Anything else about the home?',
      field: {
        kind: 'textarea',
        name: 'notes',
        label: 'Notes',
        rows: 3,
        maxLength: 1200,
      },
      advanceLabel: 'Value my home',
    },
  ]
}

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Sending your request.',
}

export function BrokerValuationSheet({ firstName }: { firstName: string }) {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('address')
  const [problem, setProblem] = useState<string>('')
  const [confirmation, setConfirmation] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})
  const stepsAsking = askSteps(firstName)

  const send = useCallback(async (answers: Readonly<Record<string, string>>) => {
    setStatus('sending')
    try {
      const result = await submitBrokerSellerLead({
        variant: 'seller',
        address: answers.address ?? '',
        name: answers.name ?? '',
        email: answers.email ?? '',
        phone: answers.phone ?? '',
        timeline: answers.timeline ?? '',
        notes: answers.notes ?? '',
      })
      if (result.ok) {
        setConfirmation(result.message ?? 'Got it. Your broker will reach out with a valuation.')
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
          ? [...stepsAsking, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : stepsAsking

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'failed'
          ? 'failed'
          : stepId

  return (
    <section id="home-value-ask" className={cn(V3_ROOT_CLASS, 'broker-ask')}>
      <V3Sheet
        id="home-value"
        heading={`A CMA from ${firstName}`}
        eyebrow="Home value"
        steps={steps}
        currentStepId={currentStepId}
        showProgress={status === 'asking'}
        onStepChange={(id) => {
          if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
          setStepId(id)
        }}
        onAdvance={onAdvance}
      />
      {status === 'asking' || status === 'failed' ? (
        <div className="v3-sheet__consent">
          <SmsConsentDisclosure />
        </div>
      ) : null}
    </section>
  )
}
