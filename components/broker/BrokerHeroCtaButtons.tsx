'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'

type Props = {
  firstName: string
  slug: string
  phone: string | null
  email: string | null
}

export default function BrokerHeroCtaButtons({ firstName, slug, phone, email }: Props) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {phone && (
        <a
          href={`tel:${phone.replace(/\D/g, '')}`}
          onClick={() => trackEvent('call_initiated', { broker_slug: slug })}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
        >
          Call {firstName}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={() => trackEvent('email_agent', { broker_slug: slug })}
          className="inline-flex items-center justify-center rounded-lg border-2 border-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
        >
          Email {firstName}
        </a>
      )}
      <Link
        href="#contact"
        className="inline-flex items-center justify-center rounded-lg bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
      >
        Schedule Consultation
      </Link>
    </div>
  )
}
