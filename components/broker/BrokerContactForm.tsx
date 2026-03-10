'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/tracking'
import { submitBrokerInquiry } from '@/app/actions/agents'

type Props = {
  brokerId: string
  brokerSlug: string
  brokerFirstName: string
  brokerEmail: string | null
}

const HELP_OPTIONS = [
  { value: 'buying', label: 'Buying' },
  { value: 'selling', label: 'Selling' },
  { value: 'both', label: 'Both' },
  { value: 'exploring', label: 'Just Exploring' },
  { value: 'relocation', label: 'Relocation' },
]

const DEFAULT_MESSAGE = "I'd like to learn more about Central Oregon real estate."

export default function BrokerContactForm({
  brokerId,
  brokerSlug,
  brokerFirstName,
  brokerEmail,
}: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [help, setHelp] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    trackEvent('contact_agent', { broker_id: brokerId, broker_slug: brokerSlug })
    const result = await submitBrokerInquiry({
      brokerId,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      message: message.trim() || DEFAULT_MESSAGE,
      helpType: help || undefined,
    })
    if (result.ok) {
      setStatus('success')
      setName('')
      setEmail('')
      setPhone('')
      setMessage(DEFAULT_MESSAGE)
      setHelp('')
    } else {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="bg-[var(--brand-navy)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-contact-heading">
      <div className="mx-auto max-w-2xl">
        <h2 id="broker-contact-heading" className="text-2xl font-bold tracking-tight text-white">
          Get in Touch with {brokerFirstName}
        </h2>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-white/90">Name</label>
            <input
              id="contact-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-white/90">Email</label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="contact-phone" className="block text-sm font-medium text-white/90">Phone (optional)</label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="(541) 555-0123"
            />
          </div>
          <div>
            <label htmlFor="contact-help" className="block text-sm font-medium text-white/90">How can {brokerFirstName} help?</label>
            <select
              id="contact-help"
              value={help}
              onChange={(e) => setHelp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              <option value="">Select…</option>
              {HELP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[var(--brand-navy)] text-white">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="contact-message" className="block text-sm font-medium text-white/90">Message</label>
            <textarea
              id="contact-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder={DEFAULT_MESSAGE}
            />
          </div>
          {status === 'success' && (
            <p className="rounded-lg bg-[var(--success)]/20 px-4 py-3 text-sm text-white">
              Message sent! {brokerFirstName} will be in touch shortly.
            </p>
          )}
          {status === 'error' && (
            <p className="rounded-lg bg-[var(--urgent)]/20 px-4 py-3 text-sm text-white">
              Something went wrong. Please try again or email directly.
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)] disabled:opacity-70"
          >
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </section>
  )
}
