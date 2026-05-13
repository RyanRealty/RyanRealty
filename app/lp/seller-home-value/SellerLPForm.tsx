'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { submitSellerLPForm, type SellerLPTimeline } from './actions'

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
}

type Step = 'address' | 'qualify' | 'success'

const TIMELINE_OPTIONS: { value: SellerLPTimeline; label: string; sub: string }[] = [
  { value: 'ready-now', label: 'Ready now', sub: 'Thinking about listing in the next 90 days.' },
  { value: 'next-3-6', label: 'Next 3 to 6 months', sub: 'Planning ahead, want to be informed.' },
  { value: 'next-6-12', label: 'Next 6 to 12 months', sub: 'Longer horizon, gathering information.' },
  { value: 'exploring', label: 'Just exploring', sub: "Curious about value. No timeline yet." },
]

export default function SellerLPForm({
  knownVisitor,
  prefillName,
  prefillEmail,
  prefillPhone,
}: SellerLPFormProps) {
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
    return (
      <div className="rounded-2xl border border-primary/15 bg-card p-8 shadow-sm">
        <h2 className="font-serif text-2xl font-semibold text-primary">
          Got it. Your home value is on its way.
        </h2>
        <p className="mt-3 text-lg text-foreground/85">
          We&rsquo;ll prepare a real comparative market analysis from local sales and send it to you within one business day.
          {isHot ? ' Because your timeline is short, Matt will personally reach out shortly to walk through your number.' : ' Matt will follow up with your number and answer any questions.'}
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          Prefer to talk right now? Call Matt directly at{' '}
          <a href="tel:+15412136706" className="font-semibold text-primary underline underline-offset-2">
            (541) 213-6706
          </a>.
        </p>
      </div>
    )
  }

  // ─── Address step ──────────────────────────────────────────────────────
  if (step === 'address') {
    return (
      <form
        onSubmit={advanceFromAddress}
        className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm sm:p-8"
        aria-labelledby="seller-lp-form-heading"
        noValidate
      >
        <h2 id="seller-lp-form-heading" className="font-serif text-xl font-semibold text-primary">
          {knownVisitor ? 'Welcome back. What address would you like valued?' : 'Get your real home value'}
        </h2>
        {knownVisitor && (prefillEmail || prefillName) && (
          <p className="mt-2 text-sm text-muted-foreground">
            We have your contact info on file{prefillEmail ? ` (${prefillEmail})` : ''}. Just confirm the address.
          </p>
        )}
        <div className="mt-5">
          <Label htmlFor="seller-lp-address" className="text-base font-medium text-foreground">
            Property address
          </Label>
          <Input
            id="seller-lp-address"
            name="address"
            type="text"
            autoComplete="street-address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 NW Iowa Ave, Bend, OR 97703"
            className={cn(
              'mt-2 h-14 rounded-xl border-2 px-4 text-lg',
              'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
              'placeholder:text-muted-foreground/70',
            )}
            aria-invalid={error ? 'true' : undefined}
            inputMode="text"
            autoFocus
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
          {pending ? 'Working…' : 'Get my home value →'}
        </Button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No spam. No obligation. No hard sell. Or call Matt at{' '}
          <a href="tel:+15412136706" className="font-semibold text-foreground underline underline-offset-2">
            (541) 213-6706
          </a>.
        </p>
      </form>
    )
  }

  // ─── Qualify step ──────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleQualifySubmit}
      className="rounded-2xl border border-primary/15 bg-card p-6 shadow-sm sm:p-8"
      aria-labelledby="seller-lp-form-heading-2"
      noValidate
    >
      <button
        type="button"
        onClick={() => {
          setError(null)
          setStep('address')
        }}
        className="mb-3 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        ← Edit address
      </button>

      <h2 id="seller-lp-form-heading-2" className="font-serif text-xl font-semibold text-primary">
        Where should we send your home value?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Just two more fields. Phone is optional — Matt will reach out at whatever&rsquo;s easiest for you.
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

        <fieldset className="mt-2">
          <legend className="text-base font-medium text-foreground">When are you thinking about selling?</legend>
          <div className="mt-3 grid gap-2">
            {TIMELINE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                  timeline === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="timeline"
                  value={opt.value}
                  checked={timeline === opt.value}
                  onChange={(e) => setTimeline(e.target.value as SellerLPTimeline)}
                  className="mt-1 h-5 w-5 accent-primary"
                />
                <span>
                  <span className="block text-base font-semibold text-foreground">{opt.label}</span>
                  <span className="block text-sm text-muted-foreground">{opt.sub}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
        {pending ? 'Sending…' : 'Send my home value →'}
      </Button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Your info stays private. We never sell or share it.
      </p>
    </form>
  )
}
