'use client'

/**
 * The one listing act: tour or ask, on this page, as one V3Sheet.
 * Sends through submitContactForm. Does not route to /contact.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitContactForm } from '@/app/contact/actions'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Sending your message.',
}

export function ListingActSheet({
  listingKey,
  listingSummary,
}: {
  listingKey: string
  listingSummary?: string
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('intent')
  const [problem, setProblem] = useState<string>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const answersRef = useRef<Record<string, string>>({})

  useEffect(() => {
    setSessionId(readRrSessionId() ?? '')
  }, [])

  const askSteps: readonly V3SheetStep[] = useMemo(
    () => [
      {
        id: 'intent',
        label: 'Tour this home, or ask a question.',
        children: listingSummary,
        field: {
          kind: 'choice',
          name: 'intent',
          label: 'What do you want',
          required: true,
          options: [
            { value: 'tour', label: 'Tour this home' },
            { value: 'question', label: 'Ask a question' },
          ],
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
          requiredMessage: 'A name is required so the broker knows who to reply to.',
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
          requiredMessage: 'An email is required so the reply has somewhere to land.',
          invalidMessage: 'That address does not look complete.',
        },
        advanceLabel: 'Continue',
      },
      {
        id: 'phone',
        label: 'A number to call or text, if you want one.',
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
        id: 'message',
        label: 'What should the broker know?',
        field: {
          kind: 'textarea',
          name: 'message',
          label: 'Message',
          rows: 4,
          maxLength: 2000,
        },
        advanceLabel: 'Send',
      },
    ],
    [listingSummary],
  )

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const isTour = answers.intent === 'tour'
        const formData = new FormData()
        formData.set('name', answers.name ?? '')
        formData.set('email', answers.email ?? '')
        formData.set('phone', answers.phone ?? '')
        formData.set('inquiryType', isTour ? 'Tour request' : 'Listing question')
        formData.set('message', answers.message ?? '')
        if (smsConsent) formData.set('smsConsent', 'yes')
        if (sessionId) formData.set('sessionId', sessionId)
        if (listingKey) formData.set('listingKey', listingKey)

        const result = await submitContactForm(formData)
        if (result.success) {
          if (result.eventId && typeof window !== 'undefined' && window.fbq) {
            window.fbq(
              'track',
              'Lead',
              { content_name: formData.get('inquiryType') },
              { eventID: result.eventId },
            )
          }
          trackEvent('generate_lead', {
            source: 'listing_act_sheet',
            inquiry: formData.get('inquiryType'),
          })
          setStatus('sent')
          return
        }
        setProblem(result.error ?? 'That did not send. Try again.')
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [listingKey, sessionId, smsConsent],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...event.answers }
      if (event.toStepId !== null) return
      void send(answersRef.current)
    },
    [send],
  )

  const sentLabel = listingSummary
    ? `Message received about ${listingSummary}. We respond the same day.`
    : 'Message received. We respond the same day.'

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [{ id: 'sent', label: sentLabel }]
      : status === 'sending'
        ? [SENDING_STEP]
        : status === 'failed'
          ? [...askSteps, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : askSteps

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
        id="listing-act"
        heading="Talk about this home"
        eyebrow="Tour or ask"
        steps={steps}
        trap={{ name: 'company', label: 'Company' }}
        currentStepId={currentStepId}
        defaultAnswers={{ intent: 'tour' }}
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
