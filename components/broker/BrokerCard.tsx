'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { AgentForIndex } from '@/app/actions/agents'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CardActionBar from '@/components/ui/CardActionBar'

type Props = {
  agent: AgentForIndex
  /** Base path for profile link (e.g. 'agents' or 'team'). Default 'agents'. */
  basePath?: 'agents' | 'team'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (count === 0) return <span className="text-sm text-muted-foreground">No reviews yet</span>
  const r = rating ?? 0
  const full = Math.floor(r)
  const half = r - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span className="inline-flex items-center gap-1">
      {[...Array(full)].map((_, i) => (
        <span key={`f-${i}`} className="text-accent-foreground" aria-hidden>★</span>
      ))}
      {half ? <span className="text-accent-foreground" aria-hidden>★</span> : null}
      {[...Array(empty)].map((_, i) => (
        <span key={`e-${i}`} className="text-border" aria-hidden>★</span>
      ))}
      <span className="ml-1 text-sm text-muted-foreground">
        {r.toFixed(1)} ({count})
      </span>
    </span>
  )
}

export default function BrokerCard({ agent, basePath = 'agents' }: Props) {
  const firstName = agent.display_name.split(' ')[0] ?? agent.display_name
  const specialties = (agent.specialties ?? []).filter((s): s is string => Boolean(s?.trim()))
  const profileHref = basePath === 'team' ? `/team/${agent.slug}` : `/agents/${agent.slug}`

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${profileHref}` : profileHref

  return (
    <Card className="relative overflow-hidden transition hover:shadow-md">
      <Link href={profileHref} className="block">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 sm:p-6">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
            {agent.photo_url ? (
              <Image
                src={agent.photo_url}
                alt={`${agent.display_name || 'Agent'} — real estate agent`}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {agent.display_name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg text-primary">{agent.display_name}</h2>
            {agent.title && (
              <p className="mt-0.5 text-sm text-muted-foreground">{agent.title}</p>
            )}
            <div className="mt-2">
              <StarRating rating={agent.avgRating} count={agent.reviewCount} />
            </div>
            {agent.bio && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{agent.bio}</p>
            )}
            {agent.license_number && (
              <p className="mt-1 text-xs text-muted-foreground">License #{agent.license_number}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{agent.activeCount} Active Listings</span>
              <span>{agent.soldCount24Mo} Sold (24mo)</span>
              <span>{formatVolume(agent.soldVolume24Mo)} Volume</span>
            </div>
            {specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {specialties.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="default" className="text-sm">
                View Profile
              </Button>
              {agent.phone && (
                <a
                  href={`tel:${agent.phone.replace(/\D/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {agent.phone}
                </a>
              )}
              {agent.email && (
                <a
                  href={`mailto:${agent.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {agent.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="flex flex-wrap items-center justify-end border-t border-border bg-muted px-2 py-1.5">
        <CardActionBar
          position="below"
          variant="onLight"
          onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
          share={{
            url: shareUrl,
            title: `${agent.display_name} – Ryan Realty`,
            text: agent.bio ? agent.bio.slice(0, 100) : undefined,
            ariaLabel: `Share ${agent.display_name}`,
          }}
          signedIn={true}
        />
      </div>
    </Card>
  )
}
