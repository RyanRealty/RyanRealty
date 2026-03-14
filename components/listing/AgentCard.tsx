'use client'

import { useState } from 'react'
import type { ListingDetailAgent } from '@/app/actions/listing-detail'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/tracking'
import { submitListingInquiry } from '@/app/actions/track-contact-agent'
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Props = {
  agent: ListingDetailAgent | null
  address: string
  listingKey: string
  /** When true, show agent email and contact CTA; when false, only show name and office. We never show listing agency or agent phone on the site. */
  showContactInfo?: boolean
}

export default function AgentCard({ agent, address, listingKey, showContactInfo = true }: Props) {
  const [contactOpen, setContactOpen] = useState(false)

  if (!agent) {
    return (
      <Card id="listing-agent-card">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">No listing agent information available.</p>
        </CardContent>
      </Card>
    )
  }

  const name = agent.agent_name ?? 'Listing Agent'
  const email = agent.agent_email ?? ''

  const handleEmail = () => {
    trackEvent('email_agent', { listing_key: listingKey, agent_name: name })
  }

  return (
    <Card id="listing-agent-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-border flex-shrink-0 overflow-hidden">
            {/* Placeholder avatar */}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">Listing Agent</p>
            {agent.office_name && <p className="text-sm text-muted-foreground">{agent.office_name}</p>}
          </div>
        </div>
        {showContactInfo && email && (
          <a href={`mailto:${email}`} onClick={handleEmail} className="block text-accent-foreground font-medium hover:underline break-all">
            {email}
          </a>
        )}
        <Button variant="default" size="default" className="w-full" onClick={() => setContactOpen(true)}>
          Contact {name.split(/\s+/)[0] ?? 'Agent'}
        </Button>
      </CardContent>

      <ContactModal
        open={contactOpen}
        agentName={name}
        address={address}
        listingKey={listingKey}
        onClose={() => setContactOpen(false)}
      />
    </Card>
  )
}

function ContactModal({
  open,
  agentName,
  address,
  listingKey,
  onClose,
}: {
  open: boolean
  agentName: string
  address: string
  listingKey: string
  onClose: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(formData: FormData) {
    setStatus('sending')
    setErrorMsg('')
    const listingUrl = typeof window !== 'undefined' ? window.location.href : ''
    const result = await submitListingInquiry({
      type: 'question',
      listingKey,
      listingUrl,
      listingAddress: address,
      name: (formData.get('name') as string)?.trim() ?? null,
      email: (formData.get('email') as string)?.trim() ?? null,
      phone: (formData.get('phone') as string)?.trim() ?? null,
      message: (formData.get('message') as string)?.trim() ?? null,
    })
    if (result.ok) {
      setStatus('done')
      trackEvent('generate_lead', { source: 'listing_inquiry', type: 'question' })
      setTimeout(onClose, 1500)
    } else {
      setStatus('error')
      setErrorMsg(result.error ?? 'Something went wrong')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact {agentName}</DialogTitle>
        </DialogHeader>
        {status === 'done' ? (
          <p className="text-success">Message sent. We&apos;ll be in touch soon.</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }} className="space-y-3">
            <Label htmlFor="contact-name" className="block">
              <span className="text-sm">Name</span>
              <Input type="text" name="name" id="contact-name" required className="mt-1" />
            </Label>
            <Label htmlFor="contact-email" className="block">
              <span className="text-sm">Email</span>
              <Input type="email" name="email" id="contact-email" required className="mt-1" />
            </Label>
            <Label htmlFor="contact-phone" className="block">
              <span className="text-sm">Phone</span>
              <Input type="tel" name="phone" id="contact-phone" className="mt-1" />
            </Label>
            <Label htmlFor="contact-message" className="block">
              <span className="text-sm">Message</span>
              <Textarea name="message" id="contact-message" rows={3} defaultValue={`I'm interested in ${address}`} className="mt-1" />
            </Label>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <DialogFooter>
              <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send'}</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
