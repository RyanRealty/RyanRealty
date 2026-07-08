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

const TOUR_TIME_OPTIONS = [
  'As soon as possible',
  'This weekend',
  'A weekday evening',
  'A weekday daytime',
  'Flexible, broker suggests times',
]

export default function ContactForm({ defaultInquiryType, listingKey, intent, hideListingNote }: { defaultInquiryType?: string; listingKey?: string; intent?: 'tour' | 'question'; hideListingNote?: boolean }) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({})
  const [loading, setLoading] = useState(false)
  const isTour = intent === 'tour'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setState({})
    const formData = new FormData(e.currentTarget)
    const rrSession = readRrSessionId() // hydration-safe — runs in the submit handler, not render
    if (rrSession) formData.append('sessionId', rrSession)
    // Carry the listing the visitor was asking about (tour/question CTA), so the
    // broker knows which home and the lead is valued as a property inquiry.
    if (listingKey) formData.append('listingKey', listingKey)
    // Tour intent: fold the preferred time into the message so the broker sees
    // it in the lead body without any pipeline change.
    const tourTime = formData.get('tourTime')
    if (isTour && typeof tourTime === 'string' && tourTime) {
      const msg = formData.get('message')
      formData.set('message', `Tour request. Preferred time: ${tourTime}.${msg ? `\n${msg}` : ''}`)
    }
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
      <div
        className="p-6"
        style={{ border: '3px solid var(--navy)', color: 'var(--navy)' }}
      >
        <p className="font-display text-lg">{isTour ? 'Tour request received.' : 'Thanks for reaching out.'}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--navy-70)' }}>
          {isTour ? 'A broker will call or text to confirm a time within one business day.' : "We'll get back to you soon."}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="kb-tool-skin space-y-4">
      {listingKey && !hideListingNote ? (
        <p
          className="px-3 py-2 text-sm"
          style={{ border: '1px solid var(--navy-12)', color: 'var(--navy-70)' }}
        >
          Your message will be linked to the home you were viewing.
        </p>
      ) : null}
      <div>
        <Label htmlFor="contact-name" className="block text-sm font-medium text-primary">
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
        <Label htmlFor="contact-email" className="block text-sm font-medium text-primary">
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
        <Label htmlFor="contact-phone" className="block text-sm font-medium text-primary">
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
        <Label htmlFor="contact-inquiry" className="block text-sm font-medium text-primary">
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
      {isTour ? (
        <div>
          <Label htmlFor="contact-tour-time" className="block text-sm font-medium text-primary">
            When would you like to see it?
          </Label>
          <Select defaultValue={TOUR_TIME_OPTIONS[0]} name="tourTime">
            <SelectTrigger id="contact-tour-time" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOUR_TIME_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="contact-message" className="block text-sm font-medium text-primary">
          {isTour ? 'Anything else? (optional)' : 'Message'}
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={4}
          className="mt-1 block w-full"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {/* Consent sits ABOVE the submit so a top-to-bottom fill sees the opt-in
          before hitting Send (design-audit P2 — SMS is fail-closed). */}
      <SmsConsentDisclosure />
      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Sending…' : isTour ? 'Request a tour' : 'Send message'}
      </Button>
    </form>
  )
}
