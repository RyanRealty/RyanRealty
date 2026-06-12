'use client'

/**
 * "Your broker" card — when a lead arrived through a broker's CRM link or ad
 * (?agent= → rr_agent_attribution cookie, 90 days), site CTAs feature THAT
 * broker instead of generic brokerage contact. Client-side cookie read so
 * static/ISR pages stay static. Renders nothing without an attribution.
 */
import { useEffect, useState } from 'react'
import { BROKERS } from '@/lib/brand/contact'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Slug = 'matt' | 'rebecca' | 'paul'

const HEADSHOT: Record<Slug, string> = {
  matt: '/images/brokers/ryan-matt.png',
  paul: '/images/brokers/stevenson-paul.jpg',
  rebecca: '/images/brokers/peterson-rebecca.jpg',
}

function readAttributedSlug(): Slug | null {
  try {
    const raw = document.cookie.split('; ').find((c) => c.startsWith('rr_agent_attribution='))?.split('=').slice(1).join('=')
    if (!raw) return null
    const parsed = JSON.parse(decodeURIComponent(raw)) as { slug?: string }
    const s = (parsed.slug ?? '').toLowerCase()
    if (s === 'matt' || s === 'rebecca' || s === 'paul') return s
    return null
  } catch {
    return null
  }
}

export default function AttributedBrokerCard({ className, hideForSlug }: { className?: string; hideForSlug?: string | null }) {
  const [slug, setSlug] = useState<Slug | null>(null)
  useEffect(() => {
    setSlug(readAttributedSlug())
  }, [])
  if (!slug) return null
  // The surface already features this broker (e.g. it is their listing) —
  // no duplicate card.
  if (hideForSlug && hideForSlug.toLowerCase().includes(slug)) return null
  const b = BROKERS[slug]
  const tel = `+1${b.phone.replace(/\D/g, '')}`

  return (
    <Card className={className}>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your broker</p>
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HEADSHOT[slug]} alt={b.name} className="h-16 w-12 rounded-lg bg-secondary object-cover object-top" loading="lazy" />
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground">{b.name}</p>
            <p className="text-sm text-muted-foreground">{b.title} · Ryan Realty</p>
            <p className="text-sm tabular-nums text-muted-foreground">{b.phone}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild size="sm"><a href={`tel:${tel}`}>Call {b.nameShort.split(' ')[0]}</a></Button>
          <Button asChild size="sm" variant="outline"><a href={`sms:${tel}`}>Text</a></Button>
        </div>
      </CardContent>
    </Card>
  )
}
