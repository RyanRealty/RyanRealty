'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
        <Button
          asChild
          onClick={() => trackEvent('call_initiated', { broker_slug: slug })}
        >
          <a href={`tel:${phone.replace(/\D/g, '')}`}>
            Call {firstName}
          </a>
        </Button>
      )}
      {email && (
        <Button
          asChild
          variant="outline"
          onClick={() => trackEvent('email_agent', { broker_slug: slug })}
        >
          <a href={`mailto:${email}`}>
            Email {firstName}
          </a>
        </Button>
      )}
      <Button
        asChild
        onClick={() => trackEvent('click_cta', { context: 'broker_schedule_consultation', broker_slug: slug })}
      >
        <Link href="#contact">
          Schedule Consultation
        </Link>
      </Button>
    </div>
  )
}
