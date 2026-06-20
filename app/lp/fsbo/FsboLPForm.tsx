'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { submitFsboLPForm, saveFsboPartialAddress } from './actions'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { CONTACT } from '@/lib/brand/contact'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

type Step = 'address' | 'contact' | 'success'

export type FsboLPFormProps = {
  /**
   * When true AND the form is on the address step, render the address field +
   * button without card chrome, sized as the hero centerpiece on the photo.
   * Later steps render in card-style (modeled on SellerLPForm).
   */
  heroVariant?: boolean
  /** DOM id for the address-step form element (anchor target). */
  formId?: string
}

export default function FsboLPForm({ heroVariant = false, formId = 'fsbo-form' }: FsboLPFormProps) {
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setError('Please enter a complete property address.')
      return
    }
    // Partial-lead capture fires non-blocking before the step change.
    void saveFsboPartialAddress({ address: v, sessionId: readRrSessionId() })
    setStep('contact')
  }

  function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    startTransition(async () => {
      const result = await submitFsboLPForm({
        address: address.trim(),
        name: name.trim(),
        email: trimmedEmail,
        phone: phone.trim(),
        notes: notes.trim(),
        sessionId: readRrSessionId(),
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        try {
          window.fbq('track', 'Lead', {
            content_name: 'fsbo_lp_pricing_report',
            value: 500,
            currency: 'USD',
          }, { eventID: result.eventId })
        } catch {
          // Pixel suppressed (consent gate). Server CAPI still fires.
        }
      }
      try {
        trackEvent('generate_lead', { source: 'fsbo_lp', classification: 'hot' })
      } catch {
        // tracking helper missing in some envs; ignore.
      }
      setStep('success')
    })
  }

  // ─── Success state ─────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Card className="rounded-2xl p-8 text-left shadow-sm ring-primary/15">
        <h2 className="font-display text-2xl font-semibold text-primary">
          Got it. Your pricing report is on its way.
        </h2>
        <p className="mt-3 text-lg text-foreground/85">
          A broker pulls the comps for your home and sends the report to your inbox within one
          business day. The sale stays yours. No listing agreement attached.
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          Want to talk it through sooner? Call Matt directly at{' '}
          <a
            href={`tel:${CONTACT.phoneFubTel}`}
            className="font-semibold text-primary underline underline-offset-2 tabular-nums"
          >
            {CONTACT.phoneFub}
          </a>
          .
        </p>
      </Card>
    )
  }

  // ─── Step 1: address ────────────────────────────────────────────────────
  if (step === 'address' && heroVariant) {
    return (
      <form
        id={formId}
        onSubmit={advanceFromAddress}
        className="mx-auto w-full max-w-xl scroll-mt-24"
        aria-label="Get your free FSBO pricing report"
        noValidate
      >
        <Label htmlFor={`${formId}-address`} className="sr-only">
          Property address
        </Label>
        <AddressAutocomplete
          id={`${formId}-address`}
          value={address}
          onChange={setAddress}
          placeholder="Enter the address you are selling"
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
          className="mt-3 h-16 w-full rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-xl transition-colors hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? 'Working…' : 'Get my pricing report →'}
        </Button>
        {/* Carrier-verifiable consent disclosure MUST be in first-paint HTML
            on BOTH steps. The A2P campaign message_flow cites this URL. */}
        <SmsConsentDisclosure tone="on-dark" className="mt-3 text-center" />
      </form>
    )
  }

  if (step === 'address') {
    return (
      <form
        id={formId}
        onSubmit={advanceFromAddress}
        className="scroll-mt-24 rounded-2xl border border-primary/15 bg-card p-6 text-left text-foreground shadow-sm sm:p-8"
        aria-labelledby={`${formId}-heading`}
        noValidate
      >
        <h2 id={`${formId}-heading`} className="font-display text-xl font-semibold leading-snug text-primary">
          Get your free pricing report
        </h2>
        <div className="mt-5">
          <Label htmlFor={`${formId}-address-card`} className="sr-only">
            Property address
          </Label>
          <AddressAutocomplete
            id={`${formId}-address-card`}
            value={address}
            onChange={setAddress}
            placeholder="Enter the address you are selling"
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
          {pending ? 'Working…' : 'Get my pricing report →'}
        </Button>
        <SmsConsentDisclosure className="mt-4" />
      </form>
    )
  }

  // ─── Step 2: contact ─────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleContactSubmit}
      className="mx-auto w-full max-w-xl rounded-2xl border border-primary/15 bg-card p-6 text-left text-foreground shadow-sm sm:p-8"
      aria-labelledby={`${formId}-heading-2`}
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
      <h2 id={`${formId}-heading-2`} className="mt-1 font-display text-xl font-semibold text-primary">
        Where should we send it?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Name and email are required. Phone is optional.
      </p>

      <div className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="fsbo-name" className="text-base font-medium text-foreground">
            Your name
          </Label>
          <Input
            id="fsbo-name"
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
          <Label htmlFor="fsbo-email" className="text-base font-medium text-foreground">
            Email
          </Label>
          <Input
            id="fsbo-email"
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
          <Label htmlFor="fsbo-phone" className="text-base font-medium text-foreground">
            Phone <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="fsbo-phone"
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
        <div>
          <Label htmlFor="fsbo-notes" className="text-base font-medium text-foreground">
            How is the sale going so far?{' '}
            <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="fsbo-notes"
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How long it has been listed, showings, offers, anything else"
            className="mt-2 rounded-xl border-2 border-border px-4 text-base focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Carrier-required SMS consent disclosure on the submit step too. */}
      <SmsConsentDisclosure className="mt-4" />

      {error && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-6 h-14 w-full rounded-xl bg-primary text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
      >
        {pending ? 'Sending…' : 'Send my pricing report →'}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Free, and you owe us nothing. The sale stays yours.
      </p>
    </form>
  )
}
