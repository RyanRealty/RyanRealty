'use client'

/**
 * Three-step CMA seller form for /lp/tetherow/. Steps: 1) address + sub-neighborhood,
 * 2) timing + beds/baths, 3) name/email/phone. Submits to the shared
 * /api/cma endpoint with FUB tags pre-tagged for resort:tetherow and the
 * v1 campaign source. Ports the multi-step script + form markup from
 * public/lp/tetherow/index.html.
 *
 * Visual register: navy panel (matches the .cma-section static styling). Form
 * controls keep the cream-on-navy palette per CLAUDE.md Design System v2.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const SUB_OPTIONS = [
  'Heath',
  'Crescent / North Forty',
  'Glen / Cascade Vista',
  'Tartan Druim',
  'Highlands Ridge',
  'Outrider Overlook',
  'Trailhead',
  'Triple Knot',
  'The Rim',
  'Not sure / other',
] as const

const TIMING_OPTIONS: { value: string; label: string }[] = [
  { value: '0-3 months', label: 'Within 3 months' },
  { value: '3-6 months', label: 'In 3 to 6 months' },
  { value: '6-12 months', label: 'In 6 to 12 months' },
  { value: '12+ months', label: '12+ months out' },
  { value: 'just curious', label: 'Just curious about value right now' },
]

export function TetherowMultiStepForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Step 1
  const [address, setAddress] = useState('')
  const [subdivision, setSubdivision] = useState('')

  // Step 2
  const [timing, setTiming] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')

  // Step 3
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  function goNext() {
    setErrors([])
    if (step === 1) {
      const errs: string[] = []
      if (!address.trim()) errs.push('Property address is required.')
      if (!subdivision) errs.push('Please pick a sub-neighborhood.')
      if (errs.length) {
        setErrors(errs)
        return
      }
      setStep(2)
    } else if (step === 2) {
      const errs: string[] = []
      if (!timing) errs.push('Pick a timing window.')
      if (!bedrooms) errs.push('Pick a bedroom count.')
      if (!bathrooms) errs.push('Pick a bathroom count.')
      if (errs.length) {
        setErrors(errs)
        return
      }
      setStep(3)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])
    const errs: string[] = []
    if (!name.trim()) errs.push('Name is required.')
    if (!email.trim()) errs.push('Email is required.')
    if (!phone.trim()) errs.push('Phone is required.')
    if (errs.length) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('campaign', 'lp-tetherow-v1')
      fd.set('resort', 'tetherow')
      fd.set('intent', 'seller')
      fd.set('tags', 'seller-intent,resort:tetherow,lp:tetherow-landing-v1,cma-requested')
      fd.set('address', address)
      fd.set('subdivision', subdivision)
      fd.set('timing', timing)
      fd.set('bedrooms', bedrooms)
      fd.set('bathrooms', bathrooms)
      fd.set('name', name)
      fd.set('email', email)
      fd.set('phone', phone)
      await fetch('/api/cma', { method: 'POST', body: fd }).catch(() => undefined)
      setSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[rgba(250,248,244,0.16)] bg-[rgba(250,248,244,0.06)] p-9 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(111,207,122,0.18)] text-2xl text-[#6fcf7a]">
          ✓
        </div>
        <h3
          className="mb-3 font-display text-[28px] font-semibold leading-[1.2] text-[color:var(--rr-cream)]"
          style={{ fontFamily: 'var(--rr-font-display)' }}
        >
          Got it. Your value report is on the way.
        </h3>
        <p className="mb-2 text-[15px] leading-[1.6] text-[rgba(250,248,244,0.85)]">
          We&apos;ll have a 12-page PDF in your inbox within one business day, signed by a Bend
          principal broker.
        </p>
        <p className="text-[15px] leading-[1.6] text-[rgba(250,248,244,0.85)]">
          No phone follow-up unless you ask for one.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[rgba(250,248,244,0.16)] bg-[rgba(250,248,244,0.06)] p-9">
      <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[rgba(250,248,244,0.7)]">
        Your Tetherow home value
      </div>
      <div
        className="mb-5 font-display text-[26px] font-semibold leading-[1.15] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        Three quick steps. 12-page value report in your inbox.
      </div>

      {/* Step progress */}
      <div className="mb-5 flex justify-between gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded transition-colors',
              s === step
                ? 'bg-[color:var(--rr-cream)]'
                : s < step
                  ? 'bg-[rgba(250,248,244,0.55)]'
                  : 'bg-[rgba(250,248,244,0.16)]'
            )}
          />
        ))}
      </div>
      <div className="mb-5 text-[12px] font-semibold tracking-[0.06em] text-[rgba(250,248,244,0.7)]">
        Step {step} of 3 ·{' '}
        {step === 1 ? 'Your home' : step === 2 ? 'Timing + size' : 'Your contact'}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {step === 1 && (
          <>
            <Label htmlFor="tetherow-address" className="sr-only">
              Property address
            </Label>
            <Input
              id="tetherow-address"
              type="text"
              name="address"
              placeholder="Your property address at Tetherow"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.55)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
              required
            />
            <Label htmlFor="tetherow-sub" className="sr-only">
              Sub-neighborhood
            </Label>
            <select
              id="tetherow-sub"
              name="subdivision"
              value={subdivision}
              onChange={(e) => setSubdivision(e.target.value)}
              required
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
            >
              <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                Which sub-neighborhood?
              </option>
              {SUB_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  {s}
                </option>
              ))}
            </select>
            {errors.length > 0 && (
              <ul className="text-[13px] text-[#f5a4a4]">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                onClick={goNext}
                className="flex-1 rounded-[10px] bg-[color:var(--rr-cream)] py-4 text-base font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
              >
                Continue →
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <select
              name="timing"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              required
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
            >
              <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                When are you thinking about selling?
              </option>
              {TIMING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                name="bedrooms"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                required
                className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
              >
                <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  Bedrooms
                </option>
                {['2', '3', '4', '5', '6+'].map((v) => (
                  <option key={v} value={v} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                    {v}
                  </option>
                ))}
              </select>
              <select
                name="bathrooms"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                required
                className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
              >
                <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  Bathrooms
                </option>
                {['2', '3', '4', '5', '6+'].map((v) => (
                  <option key={v} value={v} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {errors.length > 0 && (
              <ul className="text-[13px] text-[#f5a4a4]">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                onClick={() => setStep(1)}
                className="flex-none rounded-[10px] border border-[rgba(250,248,244,0.35)] bg-transparent px-[22px] py-4 text-[15px] font-semibold text-[color:var(--rr-cream)] hover:bg-[rgba(250,248,244,0.08)]"
                variant="outline"
              >
                ← Back
              </Button>
              <Button
                type="button"
                onClick={goNext}
                className="flex-1 rounded-[10px] bg-[color:var(--rr-cream)] py-4 text-base font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
              >
                Continue →
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Input
              type="text"
              name="name"
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.55)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
              required
            />
            <Input
              type="email"
              name="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.55)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
              required
            />
            <Input
              type="tel"
              name="phone"
              placeholder="Mobile number"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-[10px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-[18px] py-4 text-[15px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.55)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
              required
            />
            {errors.length > 0 && (
              <ul className="text-[13px] text-[#f5a4a4]">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-none rounded-[10px] border border-[rgba(250,248,244,0.35)] bg-transparent px-[22px] py-4 text-[15px] font-semibold text-[color:var(--rr-cream)] hover:bg-[rgba(250,248,244,0.08)]"
              >
                ← Back
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-[10px] bg-[color:var(--rr-cream)] py-4 text-base font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
              >
                {submitting ? 'Sending...' : 'Send my value report'}
              </Button>
            </div>
            <div className="text-[11.5px] leading-[1.5] text-[rgba(250,248,244,0.62)]">
              By submitting, you agree to receive a marketing communication via SMS, AI voice call,
              or email from Ryan Realty | Bend, Oregon Real Estate Experts. Consent is not a
              condition of receiving the CMA. Standard message rates apply. Reply STOP to
              unsubscribe.
            </div>
          </>
        )}
      </form>
    </div>
  )
}

export default TetherowMultiStepForm
