'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENT_PHONE_TEL } from '../../lib/listing-cta'
import { trackContactAgentEmail, submitListingInquiry } from '@/app/actions/track-contact-agent'
import { trackEvent } from '@/lib/tracking'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type Props = {
  address: string
  cityStateZip?: string
  listingUrl: string
  listPrice: number | null
  listingId?: string | null
  /** Listing key for inquiry submission (ListNumber or ListingKey) */
  listingKey?: string | null
  /** For mailto body and FUB tracking */
  userEmail?: string | null
  userName?: string | null
  fubPersonId?: number | null
  /** Pre-filled mortgage calculator URL (price + optional saved prefs) */
  calculatorUrl?: string
}

function buildScheduleShowingMailto(listingUrl: string, address: string, cityStateZip?: string): string {
  const subject = encodeURIComponent(`Showing request: ${address}${cityStateZip ? `, ${cityStateZip}` : ''}`)
  const body = encodeURIComponent(
    `I'd like to schedule a showing for this property.\n\nListing: ${listingUrl}\n\nAddress: ${address}${cityStateZip ? `\n${cityStateZip}` : ''}`
  )
  return `mailto:?subject=${subject}&body=${body}`
}

function buildContactEmailMailto(params: {
  listingUrl: string
  address: string
  cityStateZip?: string
  listPrice: number | null
  userEmail?: string | null
  userName?: string | null
}): string {
  const { listingUrl, address, cityStateZip, listPrice, userEmail, userName } = params
  const subject = encodeURIComponent(`Inquiry: ${address}${cityStateZip ? `, ${cityStateZip}` : ''}`)
  const lines: string[] = [
    "I'm interested in this property.",
    '',
    `Listing: ${listingUrl}`,
    `Address: ${address}${cityStateZip ? `, ${cityStateZip}` : ''}`,
  ]
  if (listPrice != null && listPrice > 0) lines.push(`Price: $${listPrice.toLocaleString()}`)
  if (userName || userEmail) {
    lines.push('')
    if (userName) lines.push(`My name: ${userName}`)
    if (userEmail) lines.push(`My email: ${userEmail}`)
  }
  const body = encodeURIComponent(lines.join('\n'))
  return `mailto:?subject=${subject}&body=${body}`
}

export default function ListingCtaSidebar({
  address,
  cityStateZip,
  listingUrl,
  listPrice,
  listingId,
  listingKey,
  userEmail,
  userName,
  fubPersonId,
  calculatorUrl,
}: Props) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState<'showing' | 'question' | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  async function handleSendEmail() {
    setOpen(false)
    await trackContactAgentEmail({
      listingUrl,
      userEmail: userEmail ?? null,
      fubPersonId: fubPersonId ?? null,
      property: {
        street: address || undefined,
        city: cityStateZip?.split(',')[0]?.trim(),
        mlsNumber: listingId ?? undefined,
        price: listPrice ?? undefined,
      },
    })
    const mailto = buildContactEmailMailto({
      listingUrl,
      address,
      cityStateZip,
      listPrice,
      userEmail,
      userName,
    })
    window.location.href = mailto
  }

  async function handleInquirySubmit(e: React.FormEvent<HTMLFormElement>, type: 'showing' | 'question') {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = (fd.get('name') as string)?.trim() || null
    const email = (fd.get('email') as string)?.trim() || null
    const phone = (fd.get('phone') as string)?.trim() || null
    const message = (fd.get('message') as string)?.trim() || null
    setSubmitStatus('sending')
    setSubmitError(null)
    const result = await submitListingInquiry({
      type,
      listingKey: listingKey ?? listingId ?? '',
      listingUrl,
      listingAddress: `${address}${cityStateZip ? `, ${cityStateZip}` : ''}`,
      mlsNumber: listingId ?? null,
      listPrice,
      name,
      email,
      phone,
      message,
      userEmail: userEmail ?? email ?? null,
      fubPersonId: fubPersonId ?? null,
    })
    if (result.ok) {
      setSubmitStatus('done')
      form.reset()
      trackEvent('generate_lead', { source: 'listing_inquiry', type })
      setTimeout(() => { setShowModal(null); setSubmitStatus('idle') }, 2000)
    } else {
      setSubmitStatus('error')
      setSubmitError(result.error ?? 'Something went wrong')
    }
  }

  const smsUrl = `sms:${AGENT_PHONE_TEL}`
  const telUrl = `tel:${AGENT_PHONE_TEL}`

  return (
    <aside
      className="sticky top-[4.25rem] shrink-0 lg:w-80"
      aria-label="Contact and schedule"
    >
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={() => setShowModal('showing')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-base font-semibold text-success-foreground shadow-sm hover:bg-success/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <span aria-hidden>📅</span>
            Schedule a showing
          </Button>
          <Button
            type="button"
            onClick={() => setShowModal('question')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-3 text-base font-semibold text-foreground hover:border-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
          >
            Ask a question
          </Button>
          <div className="relative" ref={ref}>
            <Button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-3 text-base font-semibold text-foreground hover:border-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
              aria-expanded={open}
              aria-haspopup="true"
            >
              <span aria-hidden>📞</span>
              Contact agent
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Button>
            {open && (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card py-1 shadow-md"
                role="menu"
              >
                <a
                  href={smsUrl}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Send a text
                </a>
                <a
                  href={telUrl}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Call
                </a>
                <Button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={handleSendEmail}
                >
                  Send an email
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!showModal} onOpenChange={(isOpen) => { if (!isOpen) { setShowModal(null); setSubmitStatus('idle'); setSubmitError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showModal === 'showing' ? 'Schedule a showing' : 'Ask a question'}
            </DialogTitle>
            <DialogDescription>
              {address}{cityStateZip ? `, ${cityStateZip}` : ''}
            </DialogDescription>
          </DialogHeader>
          {submitStatus === 'done' ? (
            <p className="text-success font-medium">Thanks! We&apos;ll be in touch soon.</p>
          ) : (
            <form onSubmit={(e) => showModal && handleInquirySubmit(e, showModal)} className="space-y-3">
              <div>
                <Label htmlFor="inquiry-name">Name</Label>
                <Input id="inquiry-name" name="name" type="text" defaultValue={userName ?? ''} className="mt-1" placeholder="Your name" />
              </div>
              <div>
                <Label htmlFor="inquiry-email">Email</Label>
                <Input id="inquiry-email" name="email" type="email" required defaultValue={userEmail ?? ''} className="mt-1" placeholder="you@example.com" />
              </div>
              <div>
                <Label htmlFor="inquiry-phone">Phone</Label>
                <Input id="inquiry-phone" name="phone" type="tel" className="mt-1" placeholder="(555) 123-4567" />
              </div>
              {showModal === 'question' && (
                <div>
                  <Label htmlFor="inquiry-message">Message</Label>
                  <Textarea id="inquiry-message" name="message" rows={3} className="mt-1" placeholder="Your question..." />
                </div>
              )}
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={submitStatus === 'sending'}>
                  {submitStatus === 'sending' ? 'Sending…' : 'Submit'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowModal(null); setSubmitStatus('idle'); setSubmitError(null) }}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  )
}
