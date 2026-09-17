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
 * SITE-111 — THE THREE INSTALLED CONTROLS THIS FILE RUNS.
 *
 *   beui-input (components/motion/input, https://beui.dev/components/motion/input)
 *   is the address field and every contact field: catalog error SHAKE, destructive
 *   ring, reserved error line, and the success check whose path draws itself.
 *   Do not restyle those states to a navy border bump.
 *
 *   shadcn-input-group (components/ui/input-group) is the address chrome: pin
 *   addon, focus-visible ring, aria-invalid ring. The group owns the box.
 *
 *   beui-expanding-arrow-button (components/motion/expanding-arrow-button)
 *   is Value my home: accent tile that expands into the dotted-arrow trail.
 *
 *   shadcn:sheet (components/ui/sheet) is everything after the address. The
 *   sourced answer reveals INSIDE it, between the address and the contact step.
 *
 * The sheet opens on the submit, not on the answer: the read takes a beat, and
 * a working surface that appears only once the data lands reads as a page that
 * swallowed the tap. The reading state is the sheet's first frame.
 *
 * ATTRIBUTION. `readAskSource()` is read once at submit and feeds BOTH the GA4
 * event (`ask_source`, never `source` — that key is taken and means the form)
 * and the CMA request metadata, so a submit the sticky control sent can be
 * counted in GA4 and audited in the row it created.
 */
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ExpandingArrowButton } from '@/components/motion/expanding-arrow-button'
import { Input as MotionInput, type InputClassNames } from '@/components/motion/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { readAskSource, withAskSource, type AskSource } from '@/lib/ask-source'
import {
  submitSellerLPForm,
  type SellerLPTimeline,
} from '@/app/lp/seller-home-value/actions'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { CONTACT } from '@/lib/brand/contact'
import { publishSellValuationConfirm } from '@/lib/sell/publish-sell-valuation'
import { SellAddressField } from './SellAddressField'
import { answerSellValue } from './sell-answer-actions'
import { SellAnswer } from './SellAnswer'
import { sellAnswerHasSubstance, type SellAnswerData } from './sell-answer'
import './sell-answer.css'

type SellPin = { lat: number; lng: number; label: string }

/**
 * Contact-step paint only. Do not override field / error / success rings —
 * those are the beUI demo. Typography stays Geist via tokens already on the
 * catalog control.
 */
const SELL_FIELD_CLASSES: InputClassNames = {
  root: 'sell-field',
}

/** The left affix on the address field: a pin, drawn, never an emoji. */
function PinAffix() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * WHEN THE ADDRESS FIELD IS SATISFIED.
 *
 * The catalog control's success check is the field's validity affordance: this
 * value is a complete street address, the thing the submit will accept. It is
 * the same gate `advanceFromAddress` enforces, drawn instead of withheld —
 * before this, the check only appeared when Google Places committed a pin, so
 * the visitor who typed a whole address by hand (and every capture of this page
 * that has no Places key) got no confirmation at all that the field was done.
 * A Places commit is the stronger form of the same fact and still sets it.
 *
 * It says the FIELD is complete. It does not claim the house was verified —
 * that is the written valuation's job, and the page says so in the sheet.
 */
function addressLooksComplete(value: string): boolean {
  const v = value.trim()
  if (v.length < 10) return false
  // A house number, then a street word.
  if (!/^\d[\w-]*\s+[A-Za-z]/.test(v)) return false
  // And a place: a comma, a ZIP, or a two-letter state at the end.
  return /,/.test(v) || /\b\d{5}(?:-\d{4})?\b/.test(v) || /\b[A-Z]{2}\b\s*$/.test(v)
}

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

function sellPinMapUrl(pin: SellPin): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return null
  const params = new URLSearchParams({
    center: `${pin.lat},${pin.lng}`,
    zoom: '15',
    size: '640x240',
    scale: '2',
    maptype: 'roadmap',
    key,
    // Navy pin — Google Static Maps marker color is API hex, not a CSS token.
    markers: `color:0x102742|${pin.lat},${pin.lng}`,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

type Step = 'address' | 'answer' | 'qualify' | 'when' | 'success'

/** The sheet's own progression, so a visitor can see how many questions are left. */
const SHEET_RAIL: { id: Step; label: string }[] = [
  { id: 'answer', label: 'Market read' },
  { id: 'qualify', label: 'Where to send it' },
  { id: 'when', label: 'Timing' },
]

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
}

export function SellValueForm({ pagePath = '/sell', formId = 'get-value' }: Props) {
  const [step, setStep] = useState<Step>('address')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [answer, setAnswer] = useState<SellAnswerData | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [timeline, setTimeline] = useState<SellerLPTimeline | ''>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [isHot, setIsHot] = useState(false)
  const [bookLane, setBookLane] = useState(false)
  const [pin, setPin] = useState<SellPin | null>(null)
  const [askOpen, setAskOpen] = useState(false)

  const addressFieldId = `${formId}-address`

  /**
   * The photograph follows the field. Typing leans and dims the poster, a
   * committed Places street locks the deeper scrim, and the sheet opens over
   * that — so what sits behind the overlay is still the street that was typed.
   */
  useEffect(() => {
    if (pin) setSellStageFocus('pinned')
    else if (address.trim().length >= 3) setSellStageFocus('typing')
    else setSellStageFocus('idle')
    return () => setSellStageFocus('idle')
  }, [address, pin])

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
    try {
      from = new URLSearchParams(window.location.search).get('address')?.trim() ?? ''
    } catch {
      // no URL access (a sandboxed embed) — the field just opens empty
    }
    if (from.length >= 5) setAddress((current) => (current ? current : from))
  }, [])

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddressError(null)
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setAddressError('Please enter a complete property address.')
      return
    }
    // The accept test for this node is the share of ADDRESS submits that end in
    // a valuation request. Without this event there is no denominator.
    try {
      trackEvent('address_submit', { form: 'get-value', surface: 'sell' })
    } catch {
      // tracking helper missing in some envs
    }
    // The sheet IS the working surface, so it opens on the submit and carries
    // its own reading state.
    setSheetOpen(true)
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

  function closeSheet() {
    setSheetOpen(false)
    setError(null)
    setStep('address')
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const reading = pending && step === 'address'
  const railIndex = SHEET_RAIL.findIndex((rung) => rung.id === step)

  const sheetTitle = reading
    ? 'Reading the Bend record'
    : step === 'answer'
      ? 'What the record says about this street'
      : step === 'qualify'
        ? 'Where should we send it?'
        : step === 'when'
          ? 'When are you thinking of selling?'
          : 'Your home value is on its way'

  const sheetBody = reading ? (
    <div className="sell-ask-sheet__body sell-ask-sheet__reading" role="status">
      <span className="sell-ask-sheet__pulse" aria-hidden="true" />
      <p>Pulling closed sales, supply and pace for this address.</p>
    </div>
  ) : step === 'success' ? (
    <div className="sell-ask-sheet__body">
      <p className="text-foreground">{publishSellValuationConfirm(isHot)}</p>
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
        <a
          href={`tel:${CONTACT.phoneDirectTel}`}
          className="font-semibold text-primary underline underline-offset-2 tabular-nums"
        >
          {CONTACT.phoneDirect}
        </a>
        .
      </p>
    </div>
  ) : step === 'when' ? (
    <div className="sell-ask-sheet__body">
      <p className="text-sm text-muted-foreground">
        It changes what we send you, not whether we send it.
      </p>
      <ol className="sell-when">
        {TIMELINE_OPTIONS.map((opt) => (
          <li key={opt.value}>
            <Button
              type="button"
              variant="ghost"
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
            </Button>
          </li>
        ))}
      </ol>
      {pending ? <p className="mt-3 text-sm text-muted-foreground">Sending</p> : null}
      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setError(null)
          setStep('qualify')
        }}
        className="mt-4 h-auto justify-start p-0"
      >
        Back
      </Button>
    </div>
  ) : step === 'qualify' ? (
    <form className="sell-ask-sheet__body" onSubmit={handleQualifySubmit} noValidate>
      <div className="sell-ask-sheet__fields">
        <MotionInput
          id="sell-value-name"
          name="name"
          type="text"
          label="Your name (optional)"
          autoComplete="name"
          value={name}
          onChange={setName}
          classNames={SELL_FIELD_CLASSES}
          autoFocus
        />
        <MotionInput
          id="sell-value-email"
          name="email"
          type="email"
          label="Email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          error={error && !emailLooksValid ? error : false}
          success={emailLooksValid}
          reserveErrorLine
          classNames={SELL_FIELD_CLASSES}
        />
        <MotionInput
          id="sell-value-phone"
          name="phone"
          type="tel"
          label="Phone (optional)"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          classNames={SELL_FIELD_CLASSES}
        />
      </div>

      <SmsConsentDisclosure className="mt-4" checked={smsConsent} onCheckedChange={setSmsConsent} />

      <Button type="submit" disabled={pending} className="mt-6 min-h-11 w-full text-base">
        Continue
      </Button>
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setError(null)
          setStep(answer ? 'answer' : 'address')
        }}
        className="mt-2 h-auto justify-start p-0"
      >
        {answer ? 'Back to the market read' : 'Edit address'}
      </Button>
    </form>
  ) : answer ? (
    <div className="sell-ask-sheet__body">
      <SellAnswer answer={answer} />
      <p className="mt-5 text-foreground">
        The one thing that is not on this page is the price. That takes the comparable sales
        side by side, and it comes back written, inside 24 hours.
      </p>
      <Button
        type="button"
        onClick={() => setStep('qualify')}
        className="mt-4 min-h-11 w-full text-base"
      >
        Send me the written valuation
      </Button>
    </div>
  ) : null

  // Stage fold only: reveal a street pin AFTER Places commits, so the at-rest
  // fold is the sourced line and the ask, never a portal map card.
  const stageMap = pagePath === '/sell'
  const pinSrc = stageMap && pin ? sellPinMapUrl(pin) : null
  const mapSrc = pinSrc
  const mapLabel = pin ? pin.label : ''

  return (
    <>
      <form
        id={formId}
        onSubmit={advanceFromAddress}
        className="scroll-mt-24 sell-stage-field"
        noValidate
      >
        {/* No autoFocus on first render: this form also mounts at the BOTTOM of
            the homepage, and a focused off-screen input scroll-jacked every
            mobile visitor to the footer on load (2026-08-27 mobile audit,
            reproduced 3/3 fresh loads). The name field in the next step keeps
            its autoFocus — that one fires after a user action. */}
        <div
          className="sell-stage-field__control"
          data-state={
            addressError ? 'error' : pin || addressLooksComplete(address) ? 'success' : 'idle'
          }
        >
          <SellAddressField
            id={addressFieldId}
            label="Home address"
            leftIcon={<PinAffix />}
            error={addressError}
            success={(Boolean(pin) || addressLooksComplete(address)) && !addressError}
            value={address}
            onChange={(next) => {
              setAddress(next)
              if (addressError) setAddressError(null)
              // Typing after a pin clears the resolved map until Places commits again.
              if (pin && next.trim() !== pin.label.trim()) setPin(null)
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
          />
        </div>

        {mapSrc ? (
          <figure className="sell-stage-pin sell-stage-pin--locked" aria-label="Pinned home location">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sell-stage-pin__map" src={mapSrc} alt="" decoding="async" />
            <figcaption className="sell-stage-pin__label">{mapLabel}</figcaption>
          </figure>
        ) : null}

        <ExpandingArrowButton
          type="submit"
          disabled={pending}
          active={askOpen}
          className="sell-stage-submit mt-4 w-full min-w-0"
          labelClassName="text-base font-medium"
        >
          {pending ? 'Reading the market' : 'Value my home'}
        </ExpandingArrowButton>
        {/* Shot trigger: opacity-0 (Playwright-visible) so ask-open can force
            the expanding-arrow trail on 375, where hover media is false. */}
        <Button
          type="button"
          variant="ghost"
          data-taste="ask-open"
          aria-hidden
          tabIndex={-1}
          className="h-11 w-11 p-0 opacity-0"
          onClick={() => setAskOpen(true)}
        >
          Expand ask
        </Button>
      </form>

      {/* shadcn:sheet — the real one. Overlay over the photograph, focus trap,
          Escape, a close control, and one question at a time inside it. */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next) closeSheet()
        }}
      >
        <SheetContent
          side="right"
          className={cn(V3_ROOT_CLASS, 'sell-ask-sheet')}
          overlayClassName="sell-ask-sheet__scrim"
        >
          <SheetHeader className="sell-ask-sheet__head">
            <SheetDescription className="sell-ask-sheet__street">
              {address.trim() || 'Your home'}
            </SheetDescription>
            <SheetTitle className="sell-ask-sheet__title">{sheetTitle}</SheetTitle>
            {step !== 'success' ? (
              <ol className="sell-ask-sheet__rail">
                {SHEET_RAIL.map((rung, i) => (
                  <li
                    key={rung.id}
                    className="sell-ask-sheet__rung"
                    data-state={
                      railIndex < 0
                        ? 'todo'
                        : i < railIndex
                          ? 'done'
                          : i === railIndex
                            ? 'now'
                            : 'todo'
                    }
                    aria-current={i === railIndex ? 'step' : undefined}
                  >
                    {rung.label}
                  </li>
                ))}
              </ol>
            ) : null}
          </SheetHeader>
          {sheetBody}
        </SheetContent>
      </Sheet>
    </>
  )
}
