'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

function initials(name: string | null): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/**
 * Listing agent attribution card.
 * Shows who listed the property (name + office) for transparency.
 * All CTAs route to the site owner (Ryan Realty) — never to the listing agent.
 */
export default function ShowcaseAgent({ listingKey, address, agent, shareUrl }: Props) {
  if (!agent) return null

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
        {/* Attribution: who listed the property */}
        <p className="text-xs text-muted-foreground mb-3">Listed by</p>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-full border border-border">
            <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
              {initials(agent.agent_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{agent.agent_name ?? 'Listing agent'}</p>
            {agent.office_name && (
              <p className="text-sm text-muted-foreground">{agent.office_name}</p>
            )}
          </div>
        </div>

        {/* CTAs route to site owner (Ryan Realty), never listing agent */}
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
      </CardContent>
    </Card>
  )
}
