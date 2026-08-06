'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/tracking'

type OpenHouse = {
  id: string
  event_date: string
  start_time: string | null
  end_time: string | null
  host_agent_name: string | null
  remarks: string | null
}

type Props = {
  listingKey: string
  openHouses: OpenHouse[]
}

function formatDate(d: string): string {
  try {
    return new Date(d + 'Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}

function formatTime(t: string | null): string {
  if (!t?.trim()) return ''
  const [h, m] = t.trim().split(':')
  const hour = parseInt(h ?? '0', 10)
  const am = hour < 12
  const h12 = hour % 12 || 12
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}

export default function ShowcaseOpenHouse({ listingKey, openHouses }: Props) {
  if (openHouses.length === 0) return null

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
      <p className="mb-2 font-semibold text-foreground">Open house</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {openHouses.map((oh) => (
          <li key={oh.id}>
            {formatDate(oh.event_date)}
            {oh.start_time && ` · ${formatTime(oh.start_time)}${oh.end_time ? `-${formatTime(oh.end_time)}` : ''}`}
            {oh.host_agent_name && ` · ${oh.host_agent_name}`}
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant="default"
        size="sm"
        className="mt-3"
        onClick={() => trackEvent('open_house_rsvp', { listing_key: listingKey, event_date: openHouses[0]?.event_date })}
      >
        <Link href={`/contact?listing=${encodeURIComponent(listingKey)}&reason=open_house`}>RSVP or ask a question</Link>
      </Button>
    </div>
  )
}
