'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'

type Props = {
  communityName: string
  slug: string
}

export default function CommunityCTA({ communityName, slug }: Props) {
  const [showModal, setShowModal] = useState(false)

  function handleGetNotified() {
    trackEvent('community_cta_click', { cta: 'get_notified', community_name: communityName })
  }

  function handleTalkExpert() {
    trackEvent('community_cta_click', { cta: 'talk_expert', community_name: communityName })
    setShowModal(true)
  }

  return (
    <section className="bg-[var(--brand-navy)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="community-cta-heading" className="text-2xl font-bold tracking-tight text-white">
          Interested in {communityName}?
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/account/saved-communities"
            onClick={handleGetNotified}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
          >
            Get Notified of New Listings
          </Link>
          <button
            type="button"
            onClick={handleTalkExpert}
            className="inline-flex items-center justify-center rounded-lg border-2 border-white/60 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Talk to a Local Expert
          </button>
        </div>
        <p className="mt-4 text-sm text-white/80">
          Sign in to save this community and get alerts when new homes hit the market.
        </p>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--brand-navy)]">Contact an expert</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              We&apos;ll connect you with a local agent who knows {communityName}. Contact form coming soon.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-4 w-full rounded-lg bg-[var(--brand-navy)] px-4 py-2 font-medium text-white hover:bg-[var(--brand-primary-hover)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
