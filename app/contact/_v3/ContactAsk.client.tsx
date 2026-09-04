'use client'
/**
 * The contact form: one screen (V3Ask), the same send as the old five-step
 * sheet. Owns nothing the primitive does not need: the inquiry options, the
 * tour-time options, the SMS consent line, and the send itself — FormData to
 * submitContactForm, then the Meta and GA lead events the sheet fired.
 */
import { useCallback, useMemo, useState } from 'react'
import { V3Ask, type V3AskField, type V3AskResult } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import './contact-ask.css'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitContactForm } from '../actions'
import { publishTourConfirmation } from '@/lib/contact/publish-tour-confirmation'
import { CONTACT_FIELD_IDS } from './contact-constants'

const BASE_INQUIRY_OPTIONS = [
  { value: 'Buying', label: 'Buying' },
  { value: 'Selling', label: 'Selling' },
  { value: 'Both', label: 'Both' },
  { value: 'General Inquiry', label: 'General inquiry' },
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

export function ContactAsk({
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
  const [smsConsent, setSmsConsent] = useState(false)

  const inquiryOptions = useMemo(() => {
    const extra =
      defaultInquiryType && !BASE_INQUIRY_OPTIONS.some((o) => o.value === defaultInquiryType)
        ? [{ value: defaultInquiryType, label: defaultInquiryType }]
        : []
    return [...BASE_INQUIRY_OPTIONS, ...extra]
  }, [defaultInquiryType])

  const fields = useMemo<V3AskField[]>(
    () => [
      {
        name: 'inquiryType',
        label: 'How can we help',
        kind: 'select',
        required: true,
        options: inquiryOptions,
        defaultValue: defaultInquiryType ?? 'General Inquiry',
      },
      ...(isTour
        ? [
            {
              name: 'tourTime',
              label: 'When works',
              kind: 'select' as const,
              required: true,
              options: TOUR_TIME_OPTIONS.map((t) => ({ value: t, label: t })),
            },
          ]
        : []),
      { id: CONTACT_FIELD_IDS.name, name: 'name', label: 'Name', required: true, autoComplete: 'name' },
      { id: CONTACT_FIELD_IDS.email, name: 'email', label: 'Email', kind: 'email', required: true, autoComplete: 'email' },
      { id: CONTACT_FIELD_IDS.phone, name: 'phone', label: 'Phone', kind: 'tel', autoComplete: 'tel', hint: 'for a text back' },
      {
        id: CONTACT_FIELD_IDS.message,
        name: 'message',
        label: isTour ? 'Anything the broker should know' : 'Your message',
        kind: 'textarea',
        required: !isTour,
        maxLength: 2000,
        placeholder: listingSummary ? `About ${listingSummary}` : undefined,
      },
    ],
    [inquiryOptions, defaultInquiryType, isTour, listingSummary],
  )

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>): Promise<V3AskResult> => {
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
      if (!result.success) {
        return { ok: false, message: result.error || 'The message did not send. Call or text instead, or try again.' }
      }
      if (result.eventId && typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead', { content_name: formData.get('inquiryType') }, { eventID: result.eventId })
      }
      trackEvent('generate_lead', { source: 'contact_page', inquiry: formData.get('inquiryType') })
      return {
        ok: true,
        heading: isTour ? 'Tour request received' : 'Message received',
        body: isTour
          ? publishTourConfirmation(listingSummary)
          : 'A broker replies within one business day. Calling or texting gets you an answer sooner.',
      }
    },
    [defaultInquiryType, isTour, listingKey, listingSummary, smsConsent],
  )

  return (
    <V3Ask
      id="write"
      className="contact-ask"
      eyebrow="Talk to a broker"
      heading={isTour ? 'Request a tour' : 'Send a message'}
      headingLevel={2}
      lede={isTour && listingSummary ? listingSummary : undefined}
      fields={fields}
      consent={<SmsConsentDisclosure checked={smsConsent} onCheckedChange={setSmsConsent} />}
      submitLabel={isTour ? 'Request a tour' : 'Send message'}
      onSubmit={send}
    />
  )
}
