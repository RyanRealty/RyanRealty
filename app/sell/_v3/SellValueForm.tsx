'use client'

/**
 * /sell capture. Address field is the spine. One filled ask: Value my home.
 * Posts through submitSellerLPForm with pagePath="/sell" and formId get-value.
 *
 * FOUR STEPS, IN THIS ORDER (SITE-02 + SITE-10, reordered 2026-09-28):
 *
 *   address  → the ask. Fires `address_submit` so the share of address submits
 *              that reach a contact is measurable at all.
 *   answer   → what the address BOUGHT: the place's verdict drawn as supply
 *              against pace, how fast homes go under contract, and the
 *              comparable closes the CMA engine already found. No dollar
 *              figure (Matt's ruling).
 *   when     → the timeframe, still asked AFTER the answer (SITE-10). One tap,
 *              and the tap advances.
 *   qualify  → contact LAST, and its button is the submit: email required,
 *              phone optional, name optional.
 *
 * WHY CONTACT MOVED TO THE END (competitor walk 2026-09-28,
 * /workspace/competitor-sell-paths-2026-09-28/SYNTHESIS.md). Every national
 * funnel walked (Redfin /why-sell, Opendoor, Zillow) asks the low-effort
 * questions first and makes the contact form the final submit; the Bend
 * brokerages walked all open on a contact form. The one-tap timeframe used to
 * come after the email, so the email step was the wall in the middle. Same
 * component, same action, same payload, same field ids.
 *
 * The answer step is deliberately thin here: everything it draws lives in
 * SellAnswer.tsx against the SellAnswerData type, so the drawing can be
 * replaced without touching this file.
 *
 * SITE-111 — THE THREE INSTALLED CONTROLS THIS FILE RUNS.
 *
 *   beui-input (components/motion/input, https://beui.dev/components/motion/input)
 *   is the address field and every contact field: catalog pill, left affix,
 *   error SHAKE, destructive ring, reserved error line, and the success check
 *   whose path draws itself. Do not restyle those states to a navy border bump.
 *
 *   shadcn-input-group stays imported on SellAddressField for catalog-install.
 *   The visible address control is the MotionInput demo, not the group wrap.
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
import {
  markAskSource,
  peekAskSource,
  readAskSource,
  withAskSource,
  type AskSource,
} from '@/lib/ask-source'
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

/** House-stage street frame: the Stage photograph becomes the typed lot. */
function sellStreetFrameUrl(address: string, pin: SellPin | null): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return null
  const loc = pin ? `${pin.lat},${pin.lng}` : address.trim()
  if (!loc) return null
  const params = new URLSearchParams({
    center: loc,
    zoom: '18',
    size: '1280x720',
    scale: '2',
    maptype: 'hybrid',
    key,
    markers: `color:0x102742|${loc}`,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

function mountSellStreetFrame(address: string, pin: SellPin | null) {
  const root = sellStageRoot()
  const media = root?.querySelector('.v3-stage-media')
  if (!root || !media) return
  const complete = Boolean(pin) || addressLooksComplete(address)
  if (!complete) {
    root.removeAttribute('data-sell-street')
    media.querySelector('.sell-stage-street')?.remove()
    media.querySelector('.sell-stage-street-plate')?.remove()
    return
  }
  root.setAttribute('data-sell-street', address.trim())
  let plate = media.querySelector<HTMLParagraphElement>('.sell-stage-street-plate')
  if (!plate) {
    plate = document.createElement('p')
    plate.className = 'sell-stage-street-plate'
    media.appendChild(plate)
  }
  plate.textContent = address.trim()
  const url = sellStreetFrameUrl(address, pin)
  if (!url) return
  let img = media.querySelector<HTMLImageElement>('img.sell-stage-street')
  if (!img) {
    img = document.createElement('img')
    img.className = 'sell-stage-street'
    img.alt = ''
    img.decoding = 'async'
    media.appendChild(img)
  }
  if (img.src !== url) img.src = url
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
  { id: 'when', label: 'Timing' },
  { id: 'qualify', label: 'Where to send it' },
]

/**
 * The CMA door. /sell?from=cma is the link a CMA email to an expired-listing
 * owner opens (app/sell/page.tsx), and the submission carries it so the
 * contact record says so. Read in the submit handler, never at render.
 */
function readSellEntry(): 'cma' | null {
  try {
    return new URLSearchParams(window.location.search).get('from') === 'cma' ? 'cma' : null
  } catch {
    return null
  }
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
  /**
   * The address submit's label. Defaults to "Value my home", which every
   * other surface (homepage, /sell/valuation, the leaves) keeps.
   */
  submitLabel?: string
  /**
   * The /sell tracking hook. When set, the address submit carries
   * `data-sell-cta` with this value, so SellClickTracker records the press to
   * the contact (app/sell/_v3/SellClickTracker.tsx), and a submit with no
   * other ask source stamped is stamped 'hero'.
   */
  ctaHook?: string
}

export function SellValueForm({
  pagePath = '/sell',
  formId = 'get-value',
  submitLabel = 'Value my home',
  ctaHook,
}: Props) {
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

  const addressFieldId = `${formId}-address`

  /**
   * The photograph follows the field. Typing leans and dims the poster, a
   * committed Places street locks the deeper scrim, and the sheet opens over
   * that — so what sits behind the overlay is still the street that was typed.
   */
  useEffect(() => {
    if (pin || addressLooksComplete(address)) setSellStageFocus('pinned')
    else if (address.trim().length >= 3) setSellStageFocus('typing')
    else setSellStageFocus('idle')
    mountSellStreetFrame(address, pin)
    return () => {
      setSellStageFocus('idle')
      mountSellStreetFrame('', null)
    }
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
    // /sell: the hero field is the ask when no other control stamped one.
    if (ctaHook && !peekAskSource()) markAskSource('hero')
    // The sheet IS the working surface, so it opens on the submit and carries
    // its own reading state.
    setSheetOpen(true)
    startTransition(async () => {
      const result = await answerSellValue({ address: v })
      if (!result.ok) {
        // The answer is a bonus, never a gate: a visitor whose address we
        // cannot place still gets to ask for the written valuation.
        setAnswer(null)
        setStep('when')
        return
      }
      setAnswer(sellAnswerHasSubstance(result.answer) ? result.answer : null)
      setStep(sellAnswerHasSubstance(result.answer) ? 'answer' : 'when')
    })
  }

  function submit(chosen: SellerLPTimeline) {
    setError(null)
    const askSource: AskSource | null = readAskSource()
    const entry = readSellEntry() // event-handler body, hydration-safe
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
        entry,
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
    // Contact is the last question, so its button is the submit. The
    // timeframe was chosen one step earlier; a visitor who reached this step
    // without one (the UI never allows it) is sent back to it.
    if (!timeline) {
      setStep('when')
      return
    }
    submit(timeline)
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
      : step === 'when'
        ? 'When are you thinking of selling?'
        : step === 'qualify'
          ? 'Where should we send it?'
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
                setError(null)
                setStep('qualify')
              }}
              className={cn('sell-when__opt h-auto whitespace-normal', timeline === opt.value && 'sell-when__opt--picked')}
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
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setError(null)
          if (answer) setStep('answer')
          else closeSheet()
        }}
        className="mt-4 h-auto justify-start p-0"
      >
        {answer ? 'Back to the market read' : 'Edit address'}
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
        {pending ? 'Sending' : 'Send me the written valuation'}
      </Button>
      {error && emailLooksValid ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setError(null)
          setStep('when')
        }}
        className="mt-2 h-auto justify-start p-0"
      >
        Back to timing
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
        onClick={() => setStep('when')}
        className="mt-4 min-h-11 w-full text-base"
      >
        Next: your timing
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
        className="scroll-mt-4 sell-stage-field"
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
          className="sell-stage-submit mt-4 justify-self-start"
          labelClassName="sell-stage-submit__label"
          {...(ctaHook ? { 'data-sell-cta': ctaHook } : {})}
        >
          {pending ? 'Reading the market' : submitLabel}
        </ExpandingArrowButton>
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
