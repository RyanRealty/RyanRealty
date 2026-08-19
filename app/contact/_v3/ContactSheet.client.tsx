'use client'

/**
 * /contact capture, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. It posts FormData to submitContactForm
 * with the same field names: name, email, phone, inquiryType, message,
 * smsConsent, listingKey, sessionId, and tourTime folded into message on
 * tour intent. fbq Lead + trackEvent generate_lead still fire on success.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitContactForm } from '../actions'
import { CONTACT_FIELD_IDS } from './contact-constants'
import { publishTourConfirmation } from '@/lib/contact/publish-tour-confirmation'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const BASE_INQUIRY_OPTIONS = [
  { value: 'Buying', label: 'Buying' },
  { value: 'Selling', label: 'Selling' },
  { value: 'Both', label: 'Both' },
  { value: 'General Inquiry', label: 'General Inquiry' },
  { value: 'Relocation', label: 'Relocation' },
  { value: 'Join the team', label: 'Join the team' },
] as const

const TOUR_TIME_OPTIONS = [
  'As soon as possible',
  'This weekend',
  'A weekday evening',
  'A weekday daytime',
  'Flexible, broker suggests times',
] as const

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Sending your message.',
}

export function ContactSheet({
  defaultInquiryType,
  listingKey,
  intent,
  listingSummary,
}: {
  defaultInquiryType?: string
  listingKey?: string
  intent?: 'tour' | 'question'
  listingSummary?: string
}) {
  const isTour = intent === 'tour'
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('inquiry')
  const [problem, setProblem] = useState<string>('')
  const [confirmation, setConfirmation] = useState<string>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const answersRef = useRef<Record<string, string>>({})

  const inquiryOptions = useMemo(() => {
    const extra =
      defaultInquiryType && !BASE_INQUIRY_OPTIONS.some((o) => o.value === defaultInquiryType)
        ? [{ value: defaultInquiryType, label: defaultInquiryType }]
        : []
    return [...BASE_INQUIRY_OPTIONS, ...extra]
  }, [defaultInquiryType])

  const askSteps: readonly V3SheetStep[] = useMemo(() => {
    const steps: V3SheetStep[] = [
      {
        id: 'inquiry',
        label: isTour ? 'Schedule a tour' : intent === 'question' ? 'Ask about this home' : 'How can we help?',
        children: listingSummary ? listingSummary : undefined,
        field: {
          kind: 'select',
          name: 'inquiryType',
          label: 'Inquiry type',
          options: inquiryOptions,
        },
        advanceLabel: 'Continue',
      },
    ]
    if (isTour) {
      steps.push({
        id: 'tourTime',
        label: 'When would you like to see it?',
        field: {
          kind: 'select',
          name: 'tourTime',
          label: 'Preferred time',
          options: TOUR_TIME_OPTIONS.map((value) => ({ value, label: value })),
        },
        advanceLabel: 'Continue',
      })
    }
    steps.push(
      {
        id: 'name',
        label: 'Who should the broker reply to?',
        field: {
          id: CONTACT_FIELD_IDS.name,
          name: 'name',
          label: 'Name',
          autoComplete: 'name',
          maxLength: 120,
        },
        advanceLabel: 'Continue',
      },
      {
        id: 'email',
        label: 'Where should the answer go?',
        field: {
          id: CONTACT_FIELD_IDS.email,
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
          id: CONTACT_FIELD_IDS.phone,
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
        label: isTour ? 'Anything else?' : 'What should the broker know?',
        field: {
          id: CONTACT_FIELD_IDS.message,
          kind: 'textarea',
          name: 'message',
          label: 'Message',
          rows: 4,
          maxLength: 2000,
        },
        advanceLabel: isTour ? 'Request a tour' : 'Send message',
      },
    )
    return steps
  }, [inquiryOptions, isTour, intent, listingSummary])

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const formData = new FormData()
        formData.set('name', answers.name ?? '')
        formData.set('email', answers.email ?? '')
        formData.set('phone', answers.phone ?? '')
        formData.set('inquiryType', answers.inquiryType || defaultInquiryType || 'General Inquiry')
        let message = answers.message ?? ''
        if (isTour && answers.tourTime) {
          message = `Tour request. Preferred time: ${answers.tourTime}.${message ? `\n${message}` : ''}`
        }
        formData.set('message', message)
        if (smsConsent) formData.set('smsConsent', 'yes')
        const rrSession = readRrSessionId() // hydration-safe: event/effect storage only
        if (rrSession) formData.set('sessionId', rrSession)
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
            source: 'contact_page',
            inquiry: formData.get('inquiryType'),
          })
          setConfirmation(
            isTour
              ? publishTourConfirmation(listingSummary)
              : 'Message received. We respond within one business day.',
          )
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
    [defaultInquiryType, isTour, listingKey, listingSummary, smsConsent],
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
      ? [{ id: 'sent', label: confirmation }]
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
        id="contact-form"
        heading={isTour ? 'Request a tour' : 'Send a message'}
        eyebrow="Talk to a broker"
        steps={steps}
        currentStepId={currentStepId}
        defaultAnswers={{
          inquiryType: defaultInquiryType ?? (listingKey ? 'Buying' : 'General Inquiry'),
          ...(isTour ? { tourTime: TOUR_TIME_OPTIONS[0] } : {}),
        }}
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
