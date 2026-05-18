'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { submitHeathCmaForm, type HeathCmaTimeline } from '../actions'

/**
 * Heath at Tetherow CMA form. Three-step (address + sub-plat context,
 * timing + beds/baths, contact). FUB tags include subdivision precision
 * so Matt can route leads by sub-plat:
 *   seller-intent,resort:tetherow,subdivision:heath,lp:tetherow-heath-landing-v1,cma-requested
 */

const TIMELINE_OPTIONS: { value: HeathCmaTimeline; label: string; sub: string }[] = [
  { value: 'ready-now', label: 'Ready now', sub: 'Thinking about listing in the next 90 days.' },
  { value: 'next-3-6', label: 'Next 3 to 6 months', sub: 'Planning ahead, want to be informed.' },
  { value: 'next-6-12', label: 'Next 6 to 12 months', sub: 'Longer horizon, gathering information.' },
  { value: 'exploring', label: 'Just exploring', sub: 'Curious about value. No timeline yet.' },
]

type Step = 'address' | 'qualify' | 'success'

export default function HeathCmaForm() {
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [timeline, setTimeline] = useState<HeathCmaTimeline | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function advance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const v = address.trim()
    if (v.length < 5) {
      setError('Enter a complete property address at Heath.')
      return
    }
    setStep('qualify')
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !timeline) {
      setError('Email and timeline are required.')
      return
    }
    startTransition(async () => {
      const result = await submitHeathCmaForm({
        address: address.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        bedrooms: bedrooms || undefined,
        bathrooms: bathrooms || undefined,
        timeline: timeline as HeathCmaTimeline,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setStep('success')
    })
  }

  if (step === 'success') {
    return (
      <div className="rounded-xl border border-primary/15 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-primary">Request received.</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Your Heath at Tetherow value report is being built against recent Tetherow closings. Expect a PDF in your inbox within one business day. No phone follow-up unless you reply.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/15 bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary/70">
        Your Heath at Tetherow home value
      </div>
      <h3 className="font-display text-2xl text-primary">
        Three quick steps. PDF in your inbox.
      </h3>

      <div className="mt-5 flex gap-2" aria-hidden="true">
        <div className={cn('h-1 flex-1 rounded-full', step === 'address' ? 'bg-primary' : 'bg-primary')} />
        <div className={cn('h-1 flex-1 rounded-full', step === 'qualify' ? 'bg-primary' : 'bg-primary/20')} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Step {step === 'address' ? '1' : '2'} of 2 · {step === 'address' ? 'Your home' : 'Timing and contact'}
      </div>

      {step === 'address' ? (
        <form className="mt-6 space-y-4" onSubmit={advance}>
          <div className="space-y-2">
            <Label htmlFor="heath-address">Property address at Heath</Label>
            <Input
              id="heath-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="61594 Hosmer Lake Drive"
              autoComplete="street-address"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="heath-beds">Bedrooms</Label>
              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger id="heath-beds">
                  <SelectValue placeholder="Beds" />
                </SelectTrigger>
                <SelectContent>
                  {['2', '3', '4', '5', '6+'].map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="heath-baths">Bathrooms</Label>
              <Select value={bathrooms} onValueChange={setBathrooms}>
                <SelectTrigger id="heath-baths">
                  <SelectValue placeholder="Baths" />
                </SelectTrigger>
                <SelectContent>
                  {['2', '3', '4', '5', '6+'].map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg">Continue</Button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">When are you thinking about selling?</legend>
            <div className="space-y-2">
              {TIMELINE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border p-3 transition',
                    timeline === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40'
                  )}
                >
                  <input
                    type="radio"
                    name="timeline"
                    value={opt.value}
                    checked={timeline === opt.value}
                    onChange={() => setTimeline(opt.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="heath-name">Name</Label>
            <Input
              id="heath-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heath-email">Email</Label>
            <Input
              id="heath-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heath-phone">Phone (optional)</Label>
            <Input
              id="heath-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="541.213.6706"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep('address')} disabled={pending}>
              Back
            </Button>
            <Button type="submit" className="flex-1" size="lg" disabled={pending}>
              {pending ? 'Sending…' : 'Send my Heath value report'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            No phone follow-up unless you reply. Report delivered as a PDF.
          </p>
        </form>
      )}
    </div>
  )
}
