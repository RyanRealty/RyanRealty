'use client'

/**
 * The one listing act: tour, ask, or save. Lives in one V3Sheet on this page.
 * Tour/ask send through submitContactForm. Save uses the listing save action.
 * Does not route to /contact.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitContactForm } from '@/app/contact/actions'
import { redirectToLoginForSave } from '@/lib/pending-save'
import { useResumePendingSave } from '@/lib/hooks/useResumePendingSave'

type Status = 'asking' | 'sending' | 'sent' | 'saving' | 'saved' | 'failed'

type SaveResult = { saved: boolean; needsAuth?: boolean }

const SENDING_STEP: V3SheetStep = {
  id: 'sending',
  label: 'Sending your message.',
}

const SAVING_STEP: V3SheetStep = {
  id: 'saving',
  label: 'Saving this home.',
}

export function ListingActSheet({
  listingKey,
  saveListingKey,
  listingSummary,
  onSave,
  initialSaved = false,
}: {
  listingKey: string
  saveListingKey: string
  listingSummary?: string
  onSave?: (listingKey: string) => Promise<SaveResult>
  initialSaved?: boolean
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('intent')
  const [problem, setProblem] = useState<string>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [saved, setSaved] = useState(initialSaved)
  const answersRef = useRef<Record<string, string>>({})

  useEffect(() => {
    setSessionId(readRrSessionId() ?? '')
  }, [])

  useResumePendingSave({
    listingKey: saveListingKey,
    alreadySaved: saved,
    onSaved: () => {
      setSaved(true)
      setStatus('saved')
    },
  })

  const saveThisHome = useCallback(async () => {
    if (saved) {
      setStatus('saved')
      return
    }
    if (!onSave) return
    setStatus('saving')
    const result = await onSave(saveListingKey)
    if (result.saved) {
      setSaved(true)
      setStatus('saved')
      return
    }
    if (result.needsAuth) {
      setStatus('asking')
      setStepId('intent')
      redirectToLoginForSave(saveListingKey)
      return
    }
    setProblem('Could not save this home. Try again.')
    setStatus('failed')
  }, [onSave, saveListingKey, saved])

  const askSteps: readonly V3SheetStep[] = useMemo(
    () => [
      {
        id: 'intent',
        label: 'Tour this home, ask a question, or save it.',
        children: listingSummary,
        field: {
          kind: 'choice',
          name: 'intent',
          label: 'What do you want',
          required: true,
          options: [
            { value: 'tour', label: 'Tour this home' },
            { value: 'question', label: 'Ask a question' },
            { value: 'save', label: 'Save this home' },
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
      if (event.fromStepId === 'failed') {
        if (answersRef.current.intent === 'save') {
          void saveThisHome()
          return
        }
        setStatus('asking')
        setStepId('intent')
        return
      }
      if (event.answers.intent === 'save' && event.fromStepId === 'intent') {
        void saveThisHome()
        return
      }
      if (event.toStepId !== null) {
        setStepId(event.toStepId)
        return
      }
      void send(answersRef.current)
    },
    [saveThisHome, send],
  )

  const sentLabel = listingSummary
    ? `Message received about ${listingSummary}. We respond the same day.`
    : 'Message received. We respond the same day.'

  const savedLabel = listingSummary
    ? `Saved. ${listingSummary} is on your list.`
    : 'Saved. This home is on your list.'

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [{ id: 'sent', label: sentLabel }]
      : status === 'sending'
        ? [SENDING_STEP]
        : status === 'saving'
          ? [SAVING_STEP]
          : status === 'saved'
            ? [{ id: 'saved', label: savedLabel }]
            : status === 'failed'
              ? [...askSteps, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
              : askSteps

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'saving'
          ? 'saving'
          : status === 'saved'
            ? 'saved'
            : status === 'failed'
              ? 'failed'
              : stepId

  return (
    <>
      <V3Sheet
        id="listing-act"
        heading="Talk about this home"
        eyebrow="Tour, ask, or save"
        steps={steps}
        trap={{ name: 'company', label: 'Company' }}
        currentStepId={currentStepId}
        defaultAnswers={{ intent: 'tour' }}
        showProgress={status === 'asking'}
        onStepChange={(id) => {
          if (answersRef.current.intent === 'save') return
          if (id === 'failed' || id === 'sent' || id === 'sending' || id === 'saving' || id === 'saved') {
            return
          }
          setStatus('asking')
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
