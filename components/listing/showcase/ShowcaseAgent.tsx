'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { trackEvent } from '@/lib/tracking'
import { trackCtaClick } from '@/lib/cta-tracking'

type Agent = {
  agent_name: string | null
  agent_email: string | null
  agent_phone: string | null
  office_name: string | null
  office_phone: string | null
}

type Props = {
  listingKey: string
  address: string
  agent: Agent | null
  /** @deprecated — no longer used. Contact info is never shown for listing agents. */
  showContactInfo?: boolean
  shareUrl: string
}

/**
 * Listing sidebar CTA card.
 * Ryan Realty CTAs are PRIMARY and prominent — the whole point is to capture the lead.
 * Listing agent attribution is a small, secondary line at the bottom for MLS compliance.
 */
export default function ShowcaseAgent({ listingKey, agent, shareUrl }: Props) {
  const contactUrl = `/contact?listing=${encodeURIComponent(listingKey)}&reason=inquiry`
  const tourUrl = `/contact?listing=${encodeURIComponent(listingKey)}&reason=tour`

  const trackSchedule = () => {
    trackEvent('schedule_showing_click', { listing_key: listingKey, listing_url: shareUrl })
    trackCtaClick({
      label: 'Schedule a showing',
      destination: tourUrl,
      context: `listing_showcase_agent:${listingKey}`,
    })
  }

  const trackAsk = () => {
    trackEvent('ask_question_click', { listing_key: listingKey, listing_url: shareUrl })
    trackCtaClick({
      label: 'Ask a question',
      destination: contactUrl,
      context: `listing_showcase_agent:${listingKey}`,
    })
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        {/* Ryan Realty CTAs — primary and prominent */}
        <p className="text-lg font-semibold text-foreground">Interested in this home?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Our team can schedule a showing or answer any questions.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            asChild
            variant="default"
            size="default"
            className="w-full"
            onClick={trackSchedule}
          >
            <Link href={tourUrl}>Schedule a showing</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="default"
            className="w-full"
            onClick={trackAsk}
          >
            <Link href={contactUrl}>Ask a question</Link>
          </Button>
        </div>

        {/* Listing agent attribution — small, secondary, MLS compliance */}
        {agent?.agent_name && (
          <>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Listed by {agent.agent_name}
              {agent.office_name ? ` · ${agent.office_name}` : ''}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
