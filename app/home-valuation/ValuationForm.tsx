'use client'

import { useState } from 'react'
import { submitValuationRequest } from './actions'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { H2 } from '@/components/site/primitives'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'

export default function ValuationForm() {
  const [state, setState] = useState<{ error?: string; success?: boolean; cmaSent?: boolean; eventId?: string }>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setState({})
    const formData = new FormData(e.currentTarget)
    const result = await submitValuationRequest(formData)
    setLoading(false)
    setState(result)
    if (result.success && result.eventId) {
      // Fire fbq with matching eventId for CAPI dedup
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: 'home_valuation',
        }, { eventID: result.eventId })
      }
      trackEvent('generate_lead', { source: 'home_valuation', cma_sent: result.cmaSent ?? false })
    }
  }

  if (state.success) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-8 text-center">
        <H2 className="text-xl text-success">
          {state.cmaSent ? "We've emailed your valuation" : "Request received"}
        </H2>
        <p className="mt-2 text-success">
          {state.cmaSent
            ? "Check your inbox for your Comparative Market Analysis. If you don't see it, check spam or reply to this email and we'll resend."
            : "We'll prepare your home valuation and send it to you shortly. You can also expect a quick call from our team to answer any questions."}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="kb-tool-skin space-y-4" id="home_valuation">
      <div>
        <Label htmlFor="val-address" className="block text-sm font-medium text-foreground">
          Property address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="val-address"
          name="address"
          type="text"
          autoComplete="street-address"
          required
          className="mt-1 block w-full"
          placeholder="123 Main St, Bend, OR 97701"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="val-name" className="block text-sm font-medium text-foreground">
            Name
          </Label>
          <Input
            id="val-name"
            name="name"
            type="text"
            autoComplete="name"
            className="mt-1 block w-full"
            placeholder="Your name"
          />
        </div>
        <div>
          <Label htmlFor="val-email" className="block text-sm font-medium text-foreground">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="val-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="val-phone" className="block text-sm font-medium text-foreground">
          Phone
        </Label>
        <Input
          id="val-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          className="mt-1 block w-full"
          placeholder="(541) 555-0123"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        size="lg"
        className="w-full text-base font-semibold disabled:opacity-70"
      >
        {loading ? 'Sending…' : 'Get my home value'}
      </Button>
      {/* What happens next — the not-knowing (instant number? phone call?) is
          the classic valuation-form abandonment reason (design-audit P2). */}
      <p className="text-center text-sm text-muted-foreground">
        A broker emails your written valuation within 24 hours, with the comps behind the number. No obligation.
      </p>
      <SmsConsentDisclosure />
    </form>
  )
}
