'use client'

/**
 * /sell capture. Address field is the spine. One filled ask: Value my home.
 * Posts through submitSellerLPForm with pagePath="/sell" and formId get-value.
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import {
  submitSellerLPForm,
  type SellerLPTimeline,
} from '@/app/lp/seller-home-value/actions'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { CONTACT } from '@/lib/brand/contact'
import { publishSellValuationConfirm } from '@/lib/sell/publish-sell-valuation'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

type Step = 'address' | 'qualify' | 'success'

const TIMELINE_OPTIONS: { value: SellerLPTimeline; label: string; sub: string }[] = [
  { value: 'ready-now', label: 'Ready to sell', sub: 'Listing in the next 90 days.' },
  { value: 'next-3-6', label: 'Sometime this year', sub: 'Planning ahead.' },
  { value: 'exploring', label: 'Just curious', sub: 'Here for the number only.' },
]

type Props = {
  pagePath?: string
  formId?: string
}

export function SellValueForm({ pagePath = '/sell', formId = 'get-value' }: Props) {
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [timeline, setTimeline] = useState<SellerLPTimeline | ''>('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [isHot, setIsHot] = useState(false)

  const addressFieldId = `${formId}-address`

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setError('Please enter a complete property address.')
      return
    }
    setStep('qualify')
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await submitSellerLPForm({
        smsConsent,
        address: address.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        timeline: (timeline || undefined) as SellerLPTimeline | undefined,
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
        trackEvent('generate_lead', { source: 'seller_lp', classification: result.classification })
      } catch {
        // tracking helper missing in some envs
      }
      setIsHot(result.classification === 'hot')
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
    submit()
  }

  if (step === 'success') {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Got it. Your home value is on its way.
        </h2>
        <p className="mt-3 text-foreground">{publishSellValuationConfirm(isHot)}</p>
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

  if (step === 'qualify') {
    return (
      <form onSubmit={handleQualifySubmit} noValidate>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setError(null)
            setStep('address')
          }}
          className="mb-3 h-auto justify-start p-0"
        >
          Edit address
        </Button>
        <p className="text-sm text-muted-foreground">{address}</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          Where should we send it?
        </h2>

        <div className="mt-5 grid gap-4">
          <div>
            <Label htmlFor="sell-value-name">
              Your name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
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
          </div>
          <div>
            <Label htmlFor="sell-value-email">Email</Label>
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
          </div>
          <div>
            <Label htmlFor="sell-value-phone">
              Phone <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
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
          </div>

          <fieldset>
            <legend className="text-sm font-medium">When are you thinking of selling?</legend>
            <RadioGroup
              value={timeline}
              onValueChange={(v) => setTimeline(v as SellerLPTimeline)}
              className="mt-3 gap-2"
            >
              {TIMELINE_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`sell-timeline-${opt.value}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 border p-4 font-normal',
                    timeline === opt.value ? 'border-primary' : 'border-border',
                  )}
                >
                  <RadioGroupItem id={`sell-timeline-${opt.value}`} value={opt.value} className="shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="block font-semibold text-foreground">{opt.label}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{opt.sub}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        </div>

        <SmsConsentDisclosure className="mt-4" checked={smsConsent} onCheckedChange={setSmsConsent} />

        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="mt-6 min-h-11 w-full text-base">
          {pending ? 'Sending' : 'Send the report'}
        </Button>
      </form>
    )
  }

  return (
    <form id={formId} onSubmit={advanceFromAddress} className="scroll-mt-24" noValidate>
      <Label htmlFor={addressFieldId}>Home address</Label>
      {/* No autoFocus on first render: this form also mounts at the BOTTOM of
          the homepage, and a focused off-screen input scroll-jacked every
          mobile visitor to the footer on load (2026-08-27 mobile audit,
          reproduced 3/3 fresh loads). The name field in the next step keeps
          its autoFocus — that one fires after a user action. */}
      <AddressAutocomplete
        id={addressFieldId}
        value={address}
        onChange={setAddress}
        invalid={error !== null}
        className="mt-2 min-h-11 text-base"
      />

      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-4 min-h-11 w-full text-base">
        {pending ? 'Working' : 'Value my home'}
      </Button>
    </form>
  )
}
