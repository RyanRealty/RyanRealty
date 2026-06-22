'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitExpiredLPForm, saveExpiredPartialAddress } from './actions'
import { CONTACT } from '@/lib/brand/contact'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { readRrSessionId } from '@/lib/tracking'

type ContactPath = 'audit' | 'phone' | 'walkthrough'
type Step = 'address' | 'contact'

export default function ExpiredLPForm() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [contactPath, setContactPath] = useState<ContactPath>('audit')
  const [addressError, setAddressError] = useState<string | null>(null)

  function advanceFromAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddressError(null)
    if (address.trim().length < 5) {
      setAddressError('Please enter a complete property address.')
      return
    }
    // Fire partial-lead capture non-blocking before advancing the step.
    void saveExpiredPartialAddress({
      address: address.trim(),
      sessionId: readRrSessionId(),
    })
    setStep('contact')
  }

  async function onSubmit(formData: FormData) {
    const submission = {
      name: formData.get('name')?.toString() ?? '',
      email: formData.get('email')?.toString() ?? '',
      phone: formData.get('phone')?.toString() ?? '',
      address: address.trim(),
      contactPath,
      notes: formData.get('notes')?.toString() ?? '',
      sessionId: readRrSessionId(),
      smsConsent: formData.get('smsConsent') === 'yes',
    }
    startTransition(async () => {
      const r = await submitExpiredLPForm(submission)
      if (r.success) {
        setResult({
          ok: true,
          msg: "Got it. We'll have the written audit in your inbox within the business day, or a quick call back if you picked that. No pitch coming.",
        })
      } else {
        setResult({ ok: false, msg: r.error })
      }
    })
  }

  if (result?.ok) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-semibold">Thanks.</p>
          <p className="mt-2 text-muted-foreground">{result.msg}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Or call us right now:{' '}
            <a href={`tel:${CONTACT.phoneFubTel}`} className="text-primary underline tabular-nums">
              {CONTACT.phoneFub}
            </a>
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Step 1: property address + contact path selection ────────────────────
  if (step === 'address') {
    return (
      <form onSubmit={advanceFromAddress} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="expired-address">Property address that expired</Label>
          <Input
            id="expired-address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1234 NW Bend Ave, Bend, OR 97703"
            className="mt-1"
            autoFocus
          />
          {addressError && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {addressError}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="contactPath">How would you like us to start?</Label>
          <Select
            name="contactPath"
            value={contactPath}
            onValueChange={(v) => setContactPath(v as ContactPath)}
          >
            <SelectTrigger id="contactPath" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="audit">Send me a free written audit of my prior listing</SelectItem>
              <SelectItem value="phone">Call me. 20-minute conversation, no pitch</SelectItem>
              <SelectItem value="walkthrough">Come walk the property with me in person</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          Continue
        </Button>
        {/* Carrier-verifiable consent disclosure MUST be in first-paint HTML —
            the A2P campaign message_flow cites this URL. Never step-2 only. */}
        <SmsConsentDisclosure />
        <p className="text-center text-xs text-muted-foreground">
          No commitment. You get the audit either way.
        </p>
      </form>
    )
  }

  // ── Step 2: contact details + optional notes ─────────────────────────────
  return (
    <form action={onSubmit} className="space-y-4" noValidate>
      {/* Back link to edit address */}
      <Button
        type="button"
        variant="link"
        onClick={() => setStep('address')}
        className="h-auto justify-start p-0 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        ← Edit address
      </Button>

      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Step 2 of 2. Almost done.
      </p>
      <p className="text-sm text-muted-foreground">
        Where should we send your audit? Name and email are required. Phone is optional.
      </p>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Jane Smith" className="mt-1" autoFocus />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="phone">
          Phone{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="phone" name="phone" type="tel" placeholder="541.xxx.xxxx" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="notes">
          Anything specific you want us to know?{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="What went wrong, what's changed, what you're considering"
          className="mt-1"
        />
      </div>

      {result?.ok === false && (
        <p className="text-sm text-destructive">{result.msg}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Get my free audit'}
      </Button>

      {/* Compliance disclosure — required, always visible on submit step */}
      <SmsConsentDisclosure />

      <p className="text-center text-xs text-muted-foreground">
        No commitment. You get the audit either way.
      </p>
    </form>
  )
}
