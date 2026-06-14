'use client'

import { useState } from 'react'
import { submitContactForm } from './actions'
import { trackEvent, readRrSessionId } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const INQUIRY_OPTIONS = [
  { value: 'Buying', label: 'Buying' },
  { value: 'Selling', label: 'Selling' },
  { value: 'Both', label: 'Both' },
  { value: 'General Inquiry', label: 'General Inquiry' },
  { value: 'Relocation', label: 'Relocation' },
]

export default function ContactForm({ defaultInquiryType, listingKey }: { defaultInquiryType?: string; listingKey?: string }) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setState({})
    const formData = new FormData(e.currentTarget)
    const rrSession = readRrSessionId()
    if (rrSession) formData.append('sessionId', rrSession)
    // Carry the listing the visitor was asking about (tour/question CTA), so the
    // broker knows which home and the lead is valued as a property inquiry.
    if (listingKey) formData.append('listingKey', listingKey)
    const result = await submitContactForm(formData)
    setLoading(false)
    setState(result)
    if (result.success && result.eventId) {
      // Fire fbq with matching eventId for CAPI dedup
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: formData.get('inquiryType'),
        }, { eventID: result.eventId })
      }
      trackEvent('generate_lead', { source: 'contact_page', inquiry: formData.get('inquiryType') })
    }
  }

  if (state.success) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-6 text-success">
        <p className="font-medium">Thanks for reaching out.</p>
        <p className="mt-1 text-sm">We&apos;ll get back to you soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {listingKey ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Your message will be linked to the home you were viewing.
        </p>
      ) : null}
      <div>
        <Label htmlFor="contact-name" className="block text-sm font-medium text-muted-foreground">
          Name
        </Label>
        <Input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          className="mt-1 block w-full"
        />
      </div>
      <div>
        <Label htmlFor="contact-email" className="block text-sm font-medium text-muted-foreground">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block w-full"
        />
      </div>
      <div>
        <Label htmlFor="contact-phone" className="block text-sm font-medium text-muted-foreground">
          Phone
        </Label>
        <Input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          className="mt-1 block w-full"
        />
      </div>
      <div>
        <Label htmlFor="contact-inquiry" className="block text-sm font-medium text-muted-foreground">
          How can we help?
        </Label>
        <Select defaultValue={defaultInquiryType ?? 'General Inquiry'} name="inquiryType">
          <SelectTrigger id="contact-inquiry" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INQUIRY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="contact-message" className="block text-sm font-medium text-muted-foreground">
          Message
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={4}
          className="mt-1 block w-full"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Sending…' : 'Send message'}
      </Button>
      <SmsConsentDisclosure />
    </form>
  )
}
