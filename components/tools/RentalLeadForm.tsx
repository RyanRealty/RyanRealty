'use client'

import { useState, useTransition } from 'react'
import { submitRentalLead } from '@/app/actions/lead-capture'
import { trackEvent } from '@/lib/tracking'
import { V3Button } from '@/components/site/v3'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import './rental-calculator.css'

/**
 * Rental-calculator lead capture. A visitor running the numbers asks a Ryan
 * Realty broker to pull real rent comps + underwrite the deal. Expands from a
 * button so the calculator stays clean. Carries the property + analysis context
 * (when launched from a listing) into the CRM via submitRentalLead.
 *
 * On the v3 register since 2026-09-02, with the calculator it sits inside: it
 * shipped shadcn Button, Card, Input and Label on two public routes. The fields
 * are native and wear the calculator's own stylesheet.
 */
export default function RentalLeadForm({
  propertyLabel,
  listingKey,
  contextNote,
}: {
  propertyLabel?: string
  listingKey?: string
  contextNote?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    if (!email.trim() && !phone.trim()) {
      setError('Add an email or phone so a broker can reach you.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await submitRentalLead({
        name,
        email,
        phone,
        propertyLabel,
        listingKey,
        contextNote,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      })
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
      // Client-side mirror of the server fireLeadGenerated call inside
      // submitRentalLead — keeps GA4 client/session attribution intact.
      trackEvent('generate_lead', {
        source: 'rental_calculator',
        listing_key: listingKey,
        page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
    })
  }

  if (done) {
    return (
      <p className="rc-lead__done" role="status">
        Thanks. A Ryan Realty broker will reach out with real rent comps and help underwriting
        this deal.
      </p>
    )
  }

  if (!open) {
    return (
      <V3Button onClick={() => setOpen(true)}>
        Have a Ryan Realty broker review this deal
      </V3Button>
    )
  }

  return (
    <div className="rc-lead">
      <p className="rc-lead__prose">
        Send your numbers to a Ryan Realty broker for real rent comps and a second look.
      </p>
      <div className="rc__field">
        <label htmlFor="rental-lead-name" className="rc__fieldlabel">
          Name
        </label>
        <input
          id="rental-lead-name"
          className="rc__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="rc__field">
        <label htmlFor="rental-lead-email" className="rc__fieldlabel">
          Email
        </label>
        <input
          id="rental-lead-email"
          className="rc__input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="rc__field">
        <label htmlFor="rental-lead-phone" className="rc__fieldlabel">
          Phone
        </label>
        <input
          id="rental-lead-phone"
          className="rc__input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </div>
      {error ? (
        <p className="rc-lead__error" role="alert">
          {error}
        </p>
      ) : null}
      <SmsConsentDisclosure />
      <div className="rc-lead__row">
        <V3Button onClick={handleSubmit} disabled={pending}>
          {pending ? 'Sending' : 'Send to a broker'}
        </V3Button>
        <V3Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </V3Button>
      </div>
    </div>
  )
}
