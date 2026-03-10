import Link from 'next/link'
import Image from 'next/image'
import type { AgentForIndex } from '@/app/actions/agents'
import Card from '@/components/ui/Card'

type Props = {
  agent: AgentForIndex
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (count === 0) return <span className="text-sm text-[var(--text-muted)]">No reviews yet</span>
  const r = rating ?? 0
  const full = Math.floor(r)
  const half = r - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span className="inline-flex items-center gap-1">
      {[...Array(full)].map((_, i) => (
        <span key={`f-${i}`} className="text-[var(--accent)]" aria-hidden>★</span>
      ))}
      {half ? <span className="text-[var(--accent)]" aria-hidden>★</span> : null}
      {[...Array(empty)].map((_, i) => (
        <span key={`e-${i}`} className="text-[var(--gray-border)]" aria-hidden>★</span>
      ))}
      <span className="ml-1 text-sm text-[var(--text-secondary)]">
        {r.toFixed(1)} ({count})
      </span>
    </span>
  )
}

export default function BrokerCard({ agent }: Props) {
  const firstName = agent.display_name.split(' ')[0] ?? agent.display_name
  const specialties = (agent.specialties ?? []).filter((s): s is string => Boolean(s?.trim()))

  return (
    <Link href={`/agents/${agent.slug}`}>
      <Card className="overflow-hidden transition hover:shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 sm:p-6">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--gray-bg)]">
            {agent.photo_url ? (
              <Image
                src={agent.photo_url}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                {agent.display_name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg text-[var(--brand-navy)]">{agent.display_name}</h2>
            {agent.title && (
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{agent.title}</p>
            )}
            <div className="mt-2">
              <StarRating rating={agent.avgRating} count={agent.reviewCount} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span>{agent.activeCount} Active Listings</span>
              <span>{agent.soldCount24Mo} Sold (24mo)</span>
              <span>{formatVolume(agent.soldVolume24Mo)} Volume</span>
            </div>
            {specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {specialties.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[var(--gray-bg)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]">
                View Profile
              </span>
              {agent.phone && (
                <a
                  href={`tel:${agent.phone.replace(/\D/g, '')}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-[var(--brand-navy)] hover:underline"
                >
                  {agent.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
