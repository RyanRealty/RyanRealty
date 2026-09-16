'use client'

/**
 * /sell capture. Address field is the spine. One filled ask: Value my home.
 * Posts through submitSellerLPForm with pagePath="/sell" and formId get-value.
 *
 * FOUR STEPS, IN THIS ORDER (site queue SITE-02 + SITE-10, Matt 2026-09-07):
 *
 *   address  → the ask. Fires `address_submit` so the share of address submits
 *              that reach a contact is measurable at all — it was not before,
 *              which is why the node's accept test could not be read.
 *   answer   → what the address BOUGHT: the place's verdict drawn as supply
 *              against pace, how fast homes go under contract, and the
 *              comparable closes the CMA engine already found. No dollar
 *              figure (Matt's ruling). This is the step that did not exist.
 *   contact  → email required, phone optional, name optional.
 *   when     → the timeframe, asked AFTER the answer (SITE-10). Choosing it
 *              submits: a question that is also the button is a question
 *              almost everyone answers, which is what the 80% accept needs.
 *
 * The answer step is deliberately thin here: everything it draws lives in
 * SellAnswer.tsx against the SellAnswerData type, so the drawing can be
 * replaced without touching this file.
 *
 * ATTRIBUTION. `readAskSource()` is read once at submit and feeds BOTH the GA4
 * event (`ask_source`, never `source` — that key is taken and means the form)
 * and the CMA request metadata, so a submit the sticky control sent can be
 * counted in GA4 and audited in the row it created.
 */
import { useEffect, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from '@/components/ui/input-group'
import { Input as BeuiInput } from '@/components/motion/input'
import { Button as BeuiButton } from '@/components/motion/button'
import { ExpandingArrowButton } from '@/components/motion/expanding-arrow-button'
import { TransitionsPanel } from '@/components/motion/transitions-panel'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { readAskSource, withAskSource, type AskSource } from '@/lib/ask-source'
import {
  submitSellerLPForm,
  type SellerLPTimeline,
} from '@/app/lp/seller-home-value/actions'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { CONTACT } from '@/lib/brand/contact'
import { publishSellValuationConfirm } from '@/lib/sell/publish-sell-valuation'
import { answerSellValue } from './sell-answer-actions'
import { SellAnswer } from './SellAnswer'
import { sellAnswerHasSubstance, type SellAnswerData } from './sell-answer'
import './sell-answer.css'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

type Step = 'address' | 'answer' | 'qualify' | 'when' | 'success'
type FieldDemo = 'idle' | 'error' | 'success'

type SellPin = { lat: number; lng: number; label: string }

function sellStageRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById('sell-hero')
}

function setSellStageFocus(mode: 'idle' | 'typing' | 'pinned') {
  const root = sellStageRoot()
  if (!root) return
  if (mode === 'idle') root.removeAttribute('data-sell-focus')
  else root.setAttribute('data-sell-focus', mode)
}

/**
 * The timeframe, as a SCALE rather than three identical boxes.
 *
 * The evaluator (2026-09-08) named the uniform card grid for what it is: the
 * statistically safe layout, three containers of equal weight standing in for a
 * decision that is not equal-weighted at all. `horizon` is where the option
 * sits on the line from "now" to "someday", and the row's mark and type weight
 * are drawn from it — so the three read as one continuum a person locates
 * themselves on, and the nearest one is visibly the nearest.
 */
const TIMELINE_OPTIONS: {
  value: SellerLPTimeline
  label: string
  sub: string
  when: string
  /** 0 = now, 1 = someday. Drives the mark and the weight. */
  horizon: number
}[] = [
  {
    value: 'ready-now',
    label: 'Ready now',
    sub: 'You want it listed and sold.',
    when: 'Inside 90 days',
    horizon: 0,
  },
  {
    value: 'next-3-6',
    label: 'Later this year',
    sub: 'You are planning the move.',
    when: 'Three to six months',
    horizon: 0.5,
  },
  {
    value: 'exploring',
    label: 'Just curious',
    sub: 'You want the number, not a plan.',
    when: 'No date yet',
    horizon: 1,
  },
]

/** The lane that gets a booking prompt: a seller listing inside 90 days. */
const NEAR_TERM: SellerLPTimeline = 'ready-now'

type Props = {
  pagePath?: string
  formId?: string
  /** Shot helper: sourced Bend answer, no dollar figure, after address. */
  previewAnswer?: SellAnswerData | null
}

export function SellValueForm({
  pagePath = '/sell',
  formId = 'get-value',
  previewAnswer = null,
}: Props) {
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [answer, setAnswer] = useState<SellAnswerData | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [timeline, setTimeline] = useState<SellerLPTimeline | ''>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [isHot, setIsHot] = useState(false)
  const [bookLane, setBookLane] = useState(false)
  const [pin, setPin] = useState<SellPin | null>(null)
  const [fieldDemo, setFieldDemo] = useState<FieldDemo>('idle')
  const [previewOpen, setPreviewOpen] = useState(false)

  const addressFieldId = `${formId}-address`
  const shownAnswer = previewOpen && previewAnswer ? previewAnswer : answer
  const addressError =
    fieldDemo === 'error' ? 'Please enter a complete property address.' : error
  const addressSuccess = fieldDemo === 'success' || Boolean(pin)

  useEffect(() => {
    if (step !== 'address' || previewOpen) {
      setSellStageFocus(previewOpen ? 'pinned' : 'idle')
      return
    }
    if (pin) setSellStageFocus('pinned')
    else if (address.trim().length >= 3) setSellStageFocus('typing')
    else setSellStageFocus('idle')
    return () => setSellStageFocus('idle')
  }, [address, pin, previewOpen, step])

  /**
   * The address the visitor already typed somewhere else.
   *
   * SITE-12: the homepage hero's Sell panel is a real GET form pointed at
   * /sell#get-value, so a submit — with or without JavaScript — arrives here
   * carrying `?address=`. Retyping the address you just typed is the kind of
   * defect that reads as two products, so the field opens filled and the
   * visitor's next act is the button, not the keyboard.
   *
   * Read in an effect, never in the render body: `window.location` is not
   * available to the server render, and a render-time read is the hydration
   * mismatch G37 exists to catch. The first paint is the empty field the server
   * sent, which is also what a visitor with no query string sees.
   */
  useEffect(() => {
    let from = ''
    let taste = ''
    try {
      from = new URLSearchParams(window.location.search).get('address')?.trim() ?? ''
      taste = new URLSearchParams(window.location.search).get('taste_state')?.trim() ?? ''
    } catch {
      // no URL access (a sandboxed embed) — the field just opens empty
    }
    if (from.length >= 5) setAddress((current) => (current ? current : from))
    if (taste === 'error' || taste === 'success') setFieldDemo(taste)
    if (taste === 'answer') setPreviewOpen(true)
  }, [])

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setError('Please enter a complete property address.')
      return
    }
    // The accept test for this node is the share of ADDRESS submits that end in
    // a valuation request. Without this event there is no denominator.
    try {
      trackEvent('address_submit', { form: 'get-value', surface: 'sell' })
    } catch {
      // tracking helper missing in some envs
    }
    startTransition(async () => {
      const result = await answerSellValue({ address: v })
      if (!result.ok) {
        // The answer is a bonus, never a gate: a visitor whose address we
        // cannot place still gets to ask for the written valuation.
        setAnswer(null)
        setStep('qualify')
        return
      }
      setAnswer(sellAnswerHasSubstance(result.answer) ? result.answer : null)
      setStep(sellAnswerHasSubstance(result.answer) ? 'answer' : 'qualify')
    })
  }

  function submit(chosen: SellerLPTimeline) {
    setError(null)
    const askSource: AskSource | null = readAskSource()
    startTransition(async () => {
      const result = await submitSellerLPForm({
        smsConsent,
        address: address.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        timeline: chosen,
        askSource,
        sessionId: readRrSessionId(), // hydration-safe (event-handler body, not render)
        source: 'seller-lp',
        pagePath,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        try {
          window.fbq(
            'track',
            'Lead',
            {
              content_name: 'seller_lp_home_value',
              value: 500,
              currency: 'USD',
            },
            { eventID: result.eventId },
          )
        } catch {
          // Pixel suppressed (consent gate). Server CAPI still fires.
        }
      }
      try {
        trackEvent(
          'generate_lead',
          withAskSource(
            { source: 'seller_lp', classification: result.classification, timeframe: chosen },
            askSource,
          ),
        )
      } catch {
        // tracking helper missing in some envs
      }
      setIsHot(result.classification === 'hot')
      setBookLane(chosen === NEAR_TERM)
      setStep('success')
    })
  }

  function handleQualifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email.')
      return
    }
    setStep('when')
  }

  const tasteStrip = (
    <div className="sell-taste sr-only">
      <BeuiButton
        type="button"
        variant="ghost"
        data-taste="error-open"
        onClick={() => {
          setPreviewOpen(false)
          setFieldDemo('error')
          setError('Please enter a complete property address.')
          setStep('address')
        }}
      >
        Show field error
      </BeuiButton>
      <BeuiButton
        type="button"
        variant="ghost"
        data-taste="success-open"
        onClick={() => {
          setPreviewOpen(false)
          setFieldDemo('success')
          setError(null)
          setStep('address')
        }}
      >
        Show field success
      </BeuiButton>
      <BeuiButton
        type="button"
        variant="ghost"
        data-taste="answer-open"
        onClick={() => {
          setFieldDemo('idle')
          setError(null)
          setPreviewOpen(true)
          setStep('address')
        }}
      >
        Show sourced answer
      </BeuiButton>
    </div>
  )

  if (step === 'success') {
    return (
      <div>
        {tasteStrip}
        <h2 className="font-display text-2xl font-semibold text-primary">
          Got it. Your home value is on its way.
        </h2>
        <p className="mt-3 text-foreground">{publishSellValuationConfirm(isHot)}</p>
        {bookLane ? (
          <p className="mt-3 text-foreground">
            You said you are ready now, so the useful next thing is twenty minutes on the phone
            or at the house.{' '}
            <a href="/book" className="font-semibold text-primary underline underline-offset-2">
              Pick a time that works
            </a>
            , and we will bring the numbers with us.
          </p>
        ) : null}
        <p className="mt-3 text-muted-foreground">
          Prefer to talk right now? Call Matt at{' '}
          <a href={`tel:${CONTACT.phoneDirectTel}`} className="font-semibold text-primary underline underline-offset-2 tabular-nums">
            {CONTACT.phoneDirect}
          </a>
          .
        </p>
      </div>
    )
  }

  if (step === 'when') {
    return (
      <div>
        {tasteStrip}
        <BeuiButton
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null)
            setStep('qualify')
          }}
          className="mb-3"
        >
          Back
        </BeuiButton>
        <h2 className="font-display text-xl font-semibold text-primary">
          Last thing: when are you thinking of selling?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It changes what we send you, not whether we send it.
        </p>
        <ol className="sell-when">
          {TIMELINE_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setTimeline(opt.value)
                  submit(opt.value)
                }}
                className={cn('sell-when__opt', timeline === opt.value && 'sell-when__opt--picked')}
                style={{ ['--sell-when-horizon' as string]: String(opt.horizon) }}
              >
                <span className="sell-when__mark" aria-hidden="true" />
                <span className="sell-when__label">{opt.label}</span>
                <span className="sell-when__when">{opt.when}</span>
                <span className="sell-when__sub">{opt.sub}</span>
              </button>
            </li>
          ))}
        </ol>
        {pending ? <p className="mt-3 text-sm text-muted-foreground">Sending</p> : null}
        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  if ((step === 'answer' && shownAnswer) || (previewOpen && shownAnswer)) {
    return (
      <div>
        {tasteStrip}
        <BeuiButton
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null)
            setPreviewOpen(false)
            setStep('address')
          }}
          className="mb-3"
        >
          Edit address
        </BeuiButton>
        <TransitionsPanel open id="sell-answer-panel">
          <SellAnswer answer={shownAnswer} />
        </TransitionsPanel>
        <p className="mt-5 text-foreground">
          The one thing that is not on this page is the price. That takes the comparable sales
          side by side, and it comes back written, inside 24 hours.
        </p>
        <ExpandingArrowButton
          type="button"
          className="mt-4 h-12 min-h-11 w-full min-w-0"
          onClick={() => {
            setPreviewOpen(false)
            setStep('qualify')
          }}
        >
          Send me the written valuation
        </ExpandingArrowButton>
      </div>
    )
  }

  if (step === 'qualify') {
    return (
      <form onSubmit={handleQualifySubmit} noValidate>
        {tasteStrip}
        <BeuiButton
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null)
            setStep(answer ? 'answer' : 'address')
          }}
          className="mb-3"
        >
          {answer ? 'Back to the market read' : 'Edit address'}
        </BeuiButton>
        <p className="text-sm text-muted-foreground">{address}</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          Where should we send it?
        </h2>

        <FieldGroup className="mt-5">
          <Field>
            <FieldLabel htmlFor="sell-value-name">
              Your name <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="sell-value-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 min-h-11 text-base"
              autoFocus
            />
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="sell-value-email">Email</FieldLabel>
            <Input
              id="sell-value-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-11 text-base"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="sell-value-phone">
              Phone <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="sell-value-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2 min-h-11 text-base"
            />
          </Field>
        </FieldGroup>

        <SmsConsentDisclosure className="mt-4" checked={smsConsent} onCheckedChange={setSmsConsent} />

        <BeuiButton type="submit" disabled={pending} className="mt-6 min-h-11 w-full" size="lg">
          Continue
        </BeuiButton>
      </form>
    )
  }

  return (
    <form id={formId} onSubmit={advanceFromAddress} className="scroll-mt-24 sell-stage-field" noValidate>
      {tasteStrip}
      <FieldGroup>
        <Field data-invalid={addressError ? true : undefined}>
          <FieldLabel htmlFor={addressFieldId}>Home address</FieldLabel>
          {/* No autoFocus on first render: this form also mounts at the BOTTOM of
              the homepage, and a focused off-screen input scroll-jacked every
              mobile visitor to the footer on load (2026-08-27 mobile audit,
              reproduced 3/3 fresh loads). The name field in the next step keeps
              its autoFocus — that one fires after a user action. */}
          <InputGroup className="h-auto min-h-11">
            <InputGroupAddon align="inline-start">
              <InputGroupText>Street</InputGroupText>
            </InputGroupAddon>
            <AddressAutocomplete
              id={addressFieldId}
              value={address}
              InputComponent={BeuiInput}
              error={addressError}
              success={addressSuccess}
              onChange={(next) => {
                setAddress(next)
                if (pin && next.trim() !== pin.label.trim()) setPin(null)
                if (fieldDemo !== 'idle') setFieldDemo('idle')
              }}
              onPlaceSelected={(place) => {
                setAddress(place.formattedAddress)
                if (
                  typeof place.lat === 'number' &&
                  typeof place.lng === 'number' &&
                  Number.isFinite(place.lat) &&
                  Number.isFinite(place.lng)
                ) {
                  setPin({
                    lat: place.lat,
                    lng: place.lng,
                    label: place.formattedAddress,
                  })
                } else {
                  setPin(null)
                }
              }}
              invalid={addressError !== null}
              className="min-h-11 w-full text-base"
              wrapperClassName="min-w-0 flex-1"
            />
          </InputGroup>
          {addressError ? <FieldError>{addressError}</FieldError> : null}
        </Field>
      </FieldGroup>

      <ExpandingArrowButton
        type="submit"
        disabled={pending}
        className="sell-stage-submit mt-4 h-12 min-h-11 w-full min-w-0"
      >
        {pending ? 'Reading the market' : 'Value my home'}
      </ExpandingArrowButton>
    </form>
  )
}
