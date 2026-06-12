'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitSellerLPForm, saveSellerPartialLead, type SellerLPTimeline } from './actions'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export type SellerLPFormProps = {
  /** When true, server already detected a fub_cid cookie. We treat the visitor as returning. */
  knownVisitor: boolean
  /** Prefilled name (first or full) if we already know it. */
  prefillName?: string | null
  /** Prefilled email if we already know it. */
  prefillEmail?: string | null
  /** Prefilled phone if we already know it. */
  prefillPhone?: string | null
  /**
   * When true AND the form is on the address step, render the address field +
   * button + microcopy WITHOUT the card chrome, sized as the centered hero
   * centerpiece on the dark hero photo. The qualify and success steps still
   * render in their card-style layout (on the light background below the fold,
   * since the page scrolls past the hero once the visitor advances).
   */
  heroVariant?: boolean
  /**
   * 'home-value' (default) — standard seller valuation copy.
   * 'list-now'            — high-intent BOFU listing copy.
   */
  variant?: 'home-value' | 'list-now'
  /**
   * DOM id for the address-step form element. Defaults to 'get-value' (the
   * anchor the sticky CTA + closing band link to). Pass a different id when
   * rendering a SECOND instance on the same page (e.g. the closing navy band)
   * so the document never carries duplicate ids.
   */
  formId?: string
}

type Step = 'address' | 'qualify' | 'success'

const TIMELINE_OPTIONS: { value: SellerLPTimeline; label: string; sub: string }[] = [
  { value: 'ready-now', label: 'Ready to sell', sub: "Let's get moving." },
  { value: 'next-3-6', label: 'Sometime this year', sub: 'Planning ahead, no rush.' },
  { value: 'exploring', label: 'Just curious', sub: 'Here for the number, not the sales pitch.' },
]

export default function SellerLPForm({
  knownVisitor,
  prefillName,
  prefillEmail,
  prefillPhone,
  heroVariant = false,
  variant = 'home-value',
  formId = 'get-value',
}: SellerLPFormProps) {
  const isListNow = variant === 'list-now'
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [name, setName] = useState(prefillName ?? '')
  const [email, setEmail] = useState(prefillEmail ?? '')
  const [phone, setPhone] = useState(prefillPhone ?? '')
  const [timeline, setTimeline] = useState<SellerLPTimeline | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [resultClassification, setResultClassification] = useState<'hot' | 'warm' | 'nurture' | 'unknown' | null>(null)

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setError('Please enter a complete property address.')
      return
    }
    // Fire partial-lead capture non-blocking before advancing the step.
    void saveSellerPartialLead({
      address: v,
      sessionId: readRrSessionId(),
      source: isListNow ? 'list-now-lp' : 'seller-lp',
    })
    // Known visitor with email already known: skip step 2 entirely.
    if (knownVisitor && (prefillEmail || email)) {
      submit({ skipQualify: true })
      return
    }
    setStep('qualify')
  }

  function submit(opts: { skipQualify?: boolean } = {}) {
    setError(null)
    startTransition(async () => {
      const result = await submitSellerLPForm({
        address: address.trim(),
        name: opts.skipQualify ? prefillName ?? name.trim() : name.trim(),
        email: opts.skipQualify ? prefillEmail ?? email.trim() : email.trim(),
        phone: opts.skipQualify ? prefillPhone ?? phone.trim() : phone.trim(),
        timeline: (timeline || undefined) as SellerLPTimeline | undefined,
        sessionId: readRrSessionId(),
        source: isListNow ? 'list-now-lp' : 'seller-lp',
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      // Browser pixel — fires standard Lead with shared eventID for Meta dedup.
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        try {
          window.fbq('track', 'Lead', {
            content_name: 'seller_lp_home_value',
            value: 500,
            currency: 'USD',
          }, { eventID: result.eventId })
        } catch {
          // Pixel suppressed (consent gate) — server CAPI still fires.
        }
      }
      try {
        trackEvent('generate_lead', { source: 'seller_lp', classification: result.classification })
      } catch {
        // tracking helper missing in some envs; ignore.
      }
      setResultClassification(result.classification)
      setStep('success')
    })
  }

  function handleQualifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const trimmedEmail = email.trim()
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your name.')
      return
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    submit()
  }

  // ─── Success state ─────────────────────────────────────────────────────
  if (step === 'success') {
    const isHot = resultClassification === 'hot'
    if (isListNow) {
      return (
        <div className="rounded-2xl border border-primary/15 bg-card p-8 text-left shadow-sm">
          <h2 className="font-display text-2xl font-semibold text-primary">
            Thanks. A local broker will reach out to start your sale.
          </h2>
          <p className="mt-3 text-lg text-foreground/85">
            {"We'll review your home and recent comps, then call you to talk pricing and a plan."}
            {isHot ? ' Because your timeline is short, expect a call very soon.' : ''}
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            Prefer to talk right now? Call Matt directly at{' '}
            <a href="tel:+15417033095" className="font-semibold text-primary underline underline-offset-2 tabular-nums">
              541.703.3095
            </a>.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-2xl border border-primary/15 bg-card p-8 text-left shadow-sm">
        <h2 className="font-display text-2xl font-semibold text-primary">
          Got it. Your home value is on its way.
        </h2>
        <p className="mt-3 text-lg text-foreground/85">
          {"We'll prepare a real comparative market analysis from recent local sales and send it your way."}
          {isHot ? ' Because your timeline is short, Matt will personally reach out shortly to walk through your number.' : ' Matt will follow up with your number and answer any questions.'}
        </p>
        <p className="mt-3 text-base text-foreground/75">
          Your report lands in your inbox within one business day.
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          Prefer to talk right now? Call Matt directly at{' '}
          <a href="tel:+15417033095" className="font-semibold text-primary underline underline-offset-2 tabular-nums">
            541.703.3095
          </a>.
        </p>
      </div>
    )
  }

  // ─── Address step — hero centerpiece variant ────────────────────────────
  // No card chrome. The address field is the brightest, highest-contrast
  // element on the hero: full-width of the centered column, white, large.
  if (step === 'address' && heroVariant) {
    return (
      <form
        id={formId}
        onSubmit={advanceFromAddress}
        className="mx-auto w-full max-w-xl scroll-mt-24"
        aria-label="Get your Bend home value"
        noValidate
      >
        <Label htmlFor={`${formId}-seller-lp-address`} className="sr-only">
          Property address
        </Label>
        <AddressAutocomplete
          id={`${formId}-seller-lp-address`}
          value={address}
          onChange={setAddress}
          placeholder="Enter your home address"
          invalid={error !== null}
          className={cn(
            'h-16 rounded-xl border-2 bg-card px-5 text-lg shadow-lg md:text-lg',
            'border-border focus:border-primary focus:ring-2 focus:ring-primary/30',
            'placeholder:text-muted-foreground/70',
          )}
        />

        {error && (
          <p className="mt-3 text-sm font-medium text-card" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="mt-3 h-16 w-full rounded-xl bg-warning text-lg font-semibold text-warning-foreground shadow-xl transition-colors hover:bg-warning/90 disabled:opacity-70"
        >
          {pending ? 'Working…' : isListNow ? 'Start my home sale →' : 'Get my home value →'}
        </Button>
        <SmsConsentDisclosure tone="on-dark" className="mt-3 text-center" />
      </form>
    )
  }

  // ─── Address step — card variant (fallback / non-hero placements) ────────
  if (step === 'address') {
    return (
      <form
        id={formId}
        onSubmit={advanceFromAddress}
        className="scroll-mt-24 rounded-2xl border border-primary/15 bg-card p-6 text-left shadow-sm sm:p-8"
        aria-labelledby={`${formId}-heading`}
        noValidate
      >
        <h2 id={`${formId}-heading`} className="font-display text-xl font-semibold leading-snug text-primary">
          {knownVisitor ? 'Welcome back. See what your home is worth.' : 'See what your home is worth'}
        </h2>
        <div className="mt-5">
          <Label htmlFor={`${formId}-seller-lp-address-card`} className="sr-only">
            Property address
          </Label>
          <AddressAutocomplete
            id={`${formId}-seller-lp-address-card`}
            value={address}
            onChange={setAddress}
            placeholder="Enter your home address"
            autoFocus
            invalid={error !== null}
            className={cn(
              'h-14 rounded-xl border-2 px-4 text-lg md:text-lg',
              'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
              'placeholder:text-muted-foreground/70',
            )}
          />
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="mt-5 h-14 w-full rounded-xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? 'Working…' : isListNow ? 'Start my home sale →' : 'Get my home value →'}
        </Button>
        <SmsConsentDisclosure className="mt-4" />
      </form>
    )
  }

  // ─── Qualify step ──────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleQualifySubmit}
      className="rounded-2xl border border-primary/15 bg-card p-6 text-left shadow-sm sm:p-8"
      aria-labelledby="seller-lp-form-heading-2"
      noValidate
    >
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setError(null)
          setStep('address')
        }}
        className="mb-3 h-auto justify-start p-0 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        ← Edit address
      </Button>

      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Step 2 of 2. Almost done.
      </p>
      <h2 id="seller-lp-form-heading-2" className="mt-1 font-display text-xl font-semibold text-primary">
        {isListNow ? 'How should we reach you?' : 'Where should we send it?'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Two quick fields and it's on its way. Phone is optional, and we promise not to call during dinner.
      </p>

      <div className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="seller-lp-name" className="text-base font-medium text-foreground">
            Your name
          </Label>
          <Input
            id="seller-lp-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last"
            className="mt-2 h-12 rounded-xl border-2 border-border px-4 text-base focus:border-primary focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="seller-lp-email" className="text-base font-medium text-foreground">
            Email
          </Label>
          <Input
            id="seller-lp-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 h-12 rounded-xl border-2 border-border px-4 text-base focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <Label htmlFor="seller-lp-phone" className="text-base font-medium text-foreground">
            Phone <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="seller-lp-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(541) 555-0123"
            className="mt-2 h-12 rounded-xl border-2 border-border px-4 text-base focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <fieldset className="mt-1 border-t border-border/60 pt-5">
          <legend className="text-base font-medium text-foreground">When are you thinking of selling?</legend>
          <RadioGroup
            value={timeline}
            onValueChange={(v) => setTimeline(v as SellerLPTimeline)}
            className="mt-3 gap-2.5"
          >
            {TIMELINE_OPTIONS.map((opt) => (
              <Label
                key={opt.value}
                htmlFor={`seller-lp-timeline-${opt.value}`}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 font-normal transition-colors',
                  timeline === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <RadioGroupItem id={`seller-lp-timeline-${opt.value}`} value={opt.value} className="shrink-0" />
                <span className="min-w-0 leading-tight">
                  <span className="block text-base font-semibold text-foreground">{opt.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{opt.sub}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
      </div>

      {/* Carrier-required SMS consent disclosure — exact text quoted in the A2P campaign */}
      <SmsConsentDisclosure className="mt-4" />

      {error && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-6 h-14 w-full rounded-xl bg-warning text-lg font-semibold text-warning-foreground transition-colors hover:bg-warning/90 disabled:opacity-70"
      >
        {pending ? 'Sending…' : isListNow ? 'Book my consultation →' : 'Send my home value →'}
      </Button>
    </form>
  )
}
