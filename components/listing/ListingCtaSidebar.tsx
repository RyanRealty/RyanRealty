'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENT_PHONE_TEL } from '../../lib/listing-cta'
import { trackContactAgentEmail, submitListingInquiry } from '@/app/actions/track-contact-agent'

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
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowModal('showing')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <span aria-hidden>📅</span>
            Schedule a showing
          </button>
          <button
            type="button"
            onClick={() => setShowModal('question')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
          >
            Ask a question
          </button>
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
              aria-expanded={open}
              aria-haspopup="true"
            >
              <span aria-hidden>📞</span>
              Contact agent
              <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
                role="menu"
              >
                <a
                  href={smsUrl}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => setOpen(false)}
                >
                  Send a text
                </a>
                <a
                  href={telUrl}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => setOpen(false)}
                >
                  Call
                </a>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={handleSendEmail}
                >
                  Send an email
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Calls and showings are handled by Ryan Realty. Contact options connect you with our team.
        </p>
      </div>

      {/* Modals: Schedule Showing + Ask a Question — stay on listing page, write to Supabase + FUB */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => { setShowModal(null); setSubmitStatus('idle'); setSubmitError(null) }} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              {showModal === 'showing' ? 'Schedule a showing' : 'Ask a question'}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {address}{cityStateZip ? `, ${cityStateZip}` : ''}
              {listingId && ` · MLS# ${listingId}`}
            </p>
            {submitStatus === 'done' ? (
              <p className="mt-4 text-emerald-700 font-medium">Thanks! We&apos;ll be in touch soon.</p>
            ) : (
              <form onSubmit={(e) => handleInquirySubmit(e, showModal)} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="inquiry-name" className="block text-sm font-medium text-zinc-700">Name</label>
                  <input id="inquiry-name" name="name" type="text" defaultValue={userName ?? ''} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="inquiry-email" className="block text-sm font-medium text-zinc-700">Email</label>
                  <input id="inquiry-email" name="email" type="email" required defaultValue={userEmail ?? ''} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="inquiry-phone" className="block text-sm font-medium text-zinc-700">Phone</label>
                  <input id="inquiry-phone" name="phone" type="tel" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" placeholder="(555) 123-4567" />
                </div>
                {showModal === 'question' && (
                  <div>
                    <label htmlFor="inquiry-message" className="block text-sm font-medium text-zinc-700">Message</label>
                    <textarea id="inquiry-message" name="message" rows={3} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" placeholder="Your question..." />
                  </div>
                )}
                {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={submitStatus === 'sending'} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {submitStatus === 'sending' ? 'Sending…' : 'Submit'}
                  </button>
                  <button type="button" onClick={() => { setShowModal(null); setSubmitStatus('idle'); setSubmitError(null) }} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
