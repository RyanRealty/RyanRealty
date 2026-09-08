'use client'

/**
 * V3 PLACE VALUE. The first-screen ask on a place page (site queue SITE-01).
 *
 * One address in, one answer out, then the email that delivers the rest. The visitor
 * types their address and sees, with no contact asked, how this place is selling right
 * now and how many recent sales compare to their home. The dollar figure is never on
 * the page (Matt 2026-09-07): it is what the written valuation carries, which is why
 * the email step exists.
 *
 * Built on V3Sheet in controlled mode so the visible step is always derived from one
 * status value and a send in flight renders only a terminal step, so nothing double
 * submits. The primitive sends nothing itself: the two calls arrive as props, which
 * keeps the barrel free of app imports and lets a route bind its own server actions.
 *
 * The honeypot is V3Sheet's `trap`: rendered on every step, aria-hidden, off-screen,
 * and its value is forwarded verbatim so the server branch can fire.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from './V3Sheet'
import { V3Button } from './atoms'
import { readRrSessionId, trackEvent } from '@/lib/tracking'
import type {
  PlaceValueAnswerInput,
  PlaceValueAnswerResult,
  PlaceValueRequestInput,
  PlaceValueRequestResult,
} from '@/lib/site/place-value'

type Status = 'address' | 'answering' | 'answer' | 'sending' | 'sent' | 'failed'

const TRAP = { name: 'company', label: 'Company' } as const

export type V3PlaceValueProps = {
  /** The place's route slug, passed through to both calls and to the events. */
  slug: string
  /** The name the copy uses. */
  placeName: string
  answer: (input: PlaceValueAnswerInput) => Promise<PlaceValueAnswerResult>
  request: (input: PlaceValueRequestInput) => Promise<PlaceValueRequestResult>
  id?: string
  className?: string
}

type Answer = Extract<PlaceValueAnswerResult, { ok: true }>
type Sent = Extract<PlaceValueRequestResult, { ok: true }>

export function V3PlaceValue({ slug, placeName, answer, request, id, className }: V3PlaceValueProps) {
  const [status, setStatus] = useState<Status>('address')
  const [stepId, setStepId] = useState<string>('answer')
  const [got, setGot] = useState<Answer | null>(null)
  const [sent, setSent] = useState<Sent | null>(null)
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const ask = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('answering')
      try {
        const result = await answer({
          slug,
          address: answers.address ?? '',
          company: answers[TRAP.name] ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          setGot(result)
          setStepId('answer')
          setStatus('answer')
          trackEvent('place_value_answer', {
            place: slug,
            comp_count: result.compCount ?? undefined,
            verdict: result.verdictLabel ?? undefined,
            subject_found: result.subjectFound,
          })
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not go through. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [answer, slug],
  )

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await request({
          slug,
          address: got?.address ?? answers.address ?? '',
          email: answers.email ?? '',
          phone: answers.phone ?? '',
          company: answers[TRAP.name] ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          setSent(result)
          setStatus('sent')
          trackEvent('valuation_requested', { source: 'place_page', place: slug })
          trackEvent('generate_lead', { source: 'place_page', place: slug })
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [request, slug, got],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...answersRef.current, ...event.answers }
      if (event.toStepId !== null) {
        setStepId(event.toStepId)
        return
      }
      // No answer yet means the address step is what is being (re)submitted,
      // including "Try again" after an address-step failure. Only an answered
      // sheet sends.
      if (status === 'address' || !got) {
        void ask(answersRef.current)
        return
      }
      void send(answersRef.current)
    },
    [ask, send, status, got],
  )

  const addressStep: V3SheetStep = {
    id: 'address',
    label: 'Start with your street address.',
    children: `You'll see how ${placeName} is selling right now and how many recent sales compare to your home. No email needed for that part.`,
    field: {
      kind: 'text',
      name: 'address',
      label: 'Street address',
      required: true,
      autoComplete: 'street-address',
      minLength: 5,
      maxLength: 200,
      placeholder: '123 Ranch House Lane',
      requiredMessage: 'Start with your street address.',
      invalidMessage: 'That does not look like a street address yet.',
    },
    advanceLabel: 'Show me',
  }

  const answerStep: V3SheetStep | null = got
    ? {
        id: 'answer',
        label: got.headline,
        // The answer names the home it answered for, even when the subject did
        // not match a record: the echo is off on this sheet, so this is the
        // one place the typed address comes back to the visitor.
        children: [`For ${got.address}.`, ...got.body],
        blocks: got.facts.length
          ? [
              {
                kind: 'facts',
                label: `${placeName} right now`,
                items: got.facts.map((f) => ({ label: f.label, value: f.value, ...(f.note ? { note: f.note } : {}) })),
              },
            ]
          : undefined,
        source: got.source,
        advanceLabel: 'Send me the written valuation',
      }
    : null

  const emailStep: V3SheetStep = {
    id: 'email',
    label: 'Where should we send the written valuation?',
    children: `It has the number, the comparable sales, and what we'd list at. One email for ${got?.address ?? 'your home'}. Nothing else lands unless you ask.`,
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      placeholder: 'you@email.com',
      requiredMessage: 'An email is where the valuation goes.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Next',
  }

  const phoneStep: V3SheetStep = {
    id: 'phone',
    label: 'Want a call about it? Add a number.',
    children: `Optional. We only call about ${got?.address ?? 'your home'}.`,
    field: {
      kind: 'tel',
      name: 'phone',
      label: 'Phone',
      required: false,
      autoComplete: 'tel',
      maxLength: 24,
      placeholder: '541 555 0100',
      invalidMessage: 'That number does not look complete.',
    },
    advanceLabel: 'Send my valuation',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent' && sent
      ? [
          {
            id: 'sent',
            label: `Sent. Your ${placeName} valuation for ${got?.address ?? 'your home'} is on its way.`,
            children: [
              `A summary of what you just saw lands in your inbox within a few minutes.`,
              `${sent.brokerFirst} sends the written valuation by the next business day.`,
            ],
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Sending your valuation request.' }]
        : status === 'answering'
          ? [{ id: 'answering', label: `Reading ${placeName} sales.`, children: 'A few seconds.' }]
          : status === 'failed'
            ? [
                ...(answerStep ? [answerStep, emailStep, phoneStep] : [addressStep]),
                { id: 'failed', label: problem, advanceLabel: 'Try again' },
              ]
            : status === 'answer' && answerStep
              ? [answerStep, emailStep, phoneStep]
              : [addressStep]

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'answering'
          ? 'answering'
          : status === 'failed'
            ? 'failed'
            : status === 'answer'
              ? stepId
              : 'address'

  return (
    <div className={['v3-place-value', className].filter(Boolean).join(' ')} id={id}>
      <V3Sheet
        heading={`What would your home sell for in ${placeName}?`}
        headingLevel={2}
        eyebrow="Value my home"
        steps={steps}
        trap={TRAP}
        currentStepId={currentStepId}
        onStepChange={setStepId}
        onAdvance={onAdvance}
        showEcho={false}
        showProgress={false}
      />
      {status === 'sent' && sent ? (
        <p className="v3-place-value__after">
          <V3Button href={sent.bookHref} variant="ghost">
            {`Book a call with ${sent.brokerFirst}`}
          </V3Button>
        </p>
      ) : null}
    </div>
  )
}
