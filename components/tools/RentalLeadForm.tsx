'use client'

import { useState, useTransition } from 'react'
import { submitRentalLead } from '@/app/actions/lead-capture'
import { trackEvent } from '@/lib/tracking'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Rental-calculator lead capture. A visitor running the numbers asks a Ryan
 * Realty broker to pull real rent comps + underwrite the deal. Expands from a
 * button so the calculator stays clean. Carries the property + analysis context
 * (when launched from a listing) into FUB via submitRentalLead.
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
      <div className="rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
        Thanks. A Ryan Realty broker will reach out with real rent comps and help underwriting this deal.
      </div>
    )
  }

  if (!open) {
    return (
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        Have a Ryan Realty broker review this deal
      </Button>
    )
  }

  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <p className="mb-3 text-sm text-muted-foreground">
          Send your numbers to a Ryan Realty broker for real rent comps and a second look.
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rental-lead-name">Name</Label>
            <Input id="rental-lead-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="rental-lead-email">Email</Label>
            <Input id="rental-lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="rental-lead-phone">Phone</Label>
            <Input id="rental-lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" autoComplete="tel" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending ? 'Sending…' : 'Send to a broker'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
