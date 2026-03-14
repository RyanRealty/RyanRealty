'use client'

import { useState } from 'react'
import type { ListingDetailOpenHouse } from '@/app/actions/listing-detail'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/tracking'

function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h ?? '0', 10)
  const min = m ? parseInt(m.slice(0, 2), 10) : 0
  if (hour === 0 && min === 0) return ''
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(d: string): string {
  const date = new Date(d + 'Z')
  const day = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${day}, ${monthDay}`
}

function toIcsDate(d: string): string {
  return d.replace(/-/g, '')
}

function buildIcsBlob(oh: ListingDetailOpenHouse): string {
  const start = oh.event_date
  const startTime = oh.start_time ?? '09:00:00'
  const endTime = oh.end_time ?? '12:00:00'
  const dtStart = `${toIcsDate(start)}T${startTime.replace(/(\d{2}):(\d{2}).*/, '$1$2')}00`
  const dtEnd = `${toIcsDate(start)}T${endTime.replace(/(\d{2}):(\d{2}).*/, '$1$2')}00`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Open House`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

type Props = {
  openHouses: ListingDetailOpenHouse[]
  listingKey: string
}

export default function OpenHouseBanner({ openHouses, listingKey }: Props) {
  const [rsvpOpen, setRsvpOpen] = useState(false)
  if (openHouses.length === 0) return null

  const oh = openHouses[0]!
  const dateStr = formatDate(oh.event_date)
  const startStr = formatTime(oh.start_time)
  const endStr = formatTime(oh.end_time)
  const timeStr = [startStr, endStr].filter(Boolean).join(' — ')

  const handleAddToCalendar = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/api/calendar?listingKey=${encodeURIComponent(listingKey)}&openHouseId=${encodeURIComponent(oh.id)}`
    window.open(url, '_blank')
  }

  const handleRsvp = async () => {
    trackEvent('open_house_rsvp', { listing_key: listingKey, event_date: oh.event_date })
    const res = await fetch('/api/open-houses/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openHouseId: oh.id, listingId: listingKey }),
    })
    if (res.status === 401) {
      const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : `/listing/${listingKey}`)
      window.location.href = `/account?signin=1&returnUrl=${returnUrl}`
      return
    }
    if (res.ok) setRsvpOpen(true)
  }

  return (
    <div className="bg-accent text-accent-foreground px-4 py-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          Open House: {dateStr}
          {timeStr && ` · ${timeStr}`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleAddToCalendar}>
            Add to Calendar
          </Button>
          <Button variant="default" size="sm" onClick={handleRsvp}>
            RSVP
          </Button>
        </div>
      </div>
    </div>
  )
}
