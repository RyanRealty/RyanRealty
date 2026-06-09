'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackHomeValuationCta } from '@/app/actions/lead-capture'
import { getLpContext, readRrSessionId } from '@/lib/tracking'
import { H2 } from '@/components/site/primitives'

type Props = {
  className?: string
}

// Read the captured LP context (URL utm_* merged with persisted rr_lp_context)
// so a visitor who arrived from a Facebook ad still attributes to facebook even
// after navigating away from the tagged landing page.
function getCampaignFromQuery(): {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
} {
  if (typeof window === 'undefined') return {}
  const ctx = getLpContext()
  return {
    source: ctx.lp_source,
    medium: ctx.lp_medium,
    campaign: ctx.lp_campaign,
    term: ctx.lp_term,
    content: ctx.lp_content,
  }
}

export default function HomeValuationCta({ className }: Props) {
  return (
    <div className={className}>
      <div className="rounded-lg border border-border bg-card p-6">
        <H2 className="text-xl">Curious what your home is worth?</H2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get a free valuation with local market context and next-step guidance from our team.
        </p>
        <Button
          asChild
          className="mt-4"
          onClick={() => trackHomeValuationCta(getCampaignFromQuery(), readRrSessionId())}
        >
          <Link href="/sell/valuation">Get your free home valuation</Link>
        </Button>
      </div>
    </div>
  )
}
