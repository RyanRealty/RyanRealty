'use client'

import { useState } from 'react'
import type { ListingDetailAgent } from '@/app/actions/listing-detail'
import Card, { CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { trackEvent } from '@/lib/tracking'
import { submitListingInquiry } from '@/app/actions/track-contact-agent'

type Props = {
  agent: ListingDetailAgent | null
  address: string
  listingKey: string
}

export default function AgentCard({ agent, address, listingKey }: Props) {
  const [contactOpen, setContactOpen] = useState(false)

  if (!agent) {
    return (
      <Card id="listing-agent-card">
        <CardContent className="p-4">
          <p className="text-sm text-[var(--gray-muted)]">No listing agent information available.</p>
        </CardContent>
      </Card>
    )
  }

  const name = agent.agent_name ?? 'Listing Agent'
  const phone = agent.agent_phone ?? ''
  const email = agent.agent_email ?? ''

  const handleCall = () => {
    trackEvent('call_initiated', { listing_key: listingKey, agent_name: name })
  }

  const handleEmail = () => {
    trackEvent('email_agent', { listing_key: listingKey, agent_name: name })
  }

  return (
    <Card id="listing-agent-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--gray-border)] flex-shrink-0 overflow-hidden">
            {/* Placeholder avatar - no agent photo URL in schema */}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--brand-navy)]">{name}</h3>
            <p className="text-sm text-[var(--gray-secondary)]">Listing Agent</p>
            {agent.office_name && <p className="text-sm text-[var(--gray-muted)]">{agent.office_name}</p>}
          </div>
        </div>
        {phone && (
          <a href={`tel:${phone}`} onClick={handleCall} className="block text-[var(--accent)] font-medium hover:underline">
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} onClick={handleEmail} className="block text-[var(--accent)] font-medium hover:underline break-all">
            {email}
          </a>
        )}
        <Button variant="primary" size="md" className="w-full" onClick={() => setContactOpen(true)}>
          Contact {name.split(/\s+/)[0] ?? 'Agent'}
        </Button>
      </CardContent>

      {contactOpen && (
        <ContactModal
          agentName={name}
          address={address}
          listingKey={listingKey}
          onClose={() => setContactOpen(false)}
        />
      )}
    </Card>
  )
}

function ContactModal({
  agentName,
  address,
  listingKey,
  onClose,
}: {
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
      setTimeout(onClose, 1500)
    } else {
      setStatus('error')
      setErrorMsg(result.error ?? 'Something went wrong')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--brand-navy)] mb-4">Contact {agentName}</h3>
        {status === 'done' ? (
          <p className="text-[var(--success)]">Message sent. We&apos;ll be in touch soon.</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }} className="space-y-3">
            <label className="block">
              <span className="text-sm text-[var(--brand-navy)]">Name</span>
              <input type="text" name="name" required className="mt-1 w-full rounded-lg border border-[var(--gray-border)] px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm text-[var(--brand-navy)]">Email</span>
              <input type="email" name="email" required className="mt-1 w-full rounded-lg border border-[var(--gray-border)] px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm text-[var(--brand-navy)]">Phone</span>
              <input type="tel" name="phone" className="mt-1 w-full rounded-lg border border-[var(--gray-border)] px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm text-[var(--brand-navy)]">Message</span>
              <textarea name="message" rows={3} defaultValue={`I'm interested in ${address}`} className="mt-1 w-full rounded-lg border border-[var(--gray-border)] px-3 py-2" />
            </label>
            {errorMsg && <p className="text-sm text-[var(--urgent)]">{errorMsg}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" variant="primary" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send'}</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
