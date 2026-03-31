'use client'

import Link from 'next/link'
import Image from 'next/image'
import { trackEvent } from '@/lib/tracking'
import ShareButton from '@/components/ShareButton'
import type { SalesReportCardData } from '@/app/actions/market-reports'
import { cityEntityKey } from '@/lib/slug'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(startStr.includes('Z') || /[+-]\d{2}/.test(startStr) ? startStr : startStr + 'Z')
  const end = new Date(endStr.includes('Z') || /[+-]\d{2}/.test(endStr) ? endStr : endStr + 'Z')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

type Props = { card: SalesReportCardData }

/**
 * Market report tile: same visual language as CommunityTile / ListingTile.
 * Background image from a home in the report, share, and aggregated engagement (likes/saves on homes in report).
 */
export default function SalesReportCard({ card }: Props) {
  const href = `/reports/sales/${encodeURIComponent(cityEntityKey(card.city))}/${card.periodSlug}`
  const hasData = card.closedCount > 0 || card.pendingCount > 0
  const summary =
    card.closedCount > 0
      ? `${card.closedCount} home${card.closedCount === 1 ? '' : 's'} sold`
      : card.pendingCount > 0
        ? `${card.pendingCount} went pending`
        : 'No sales this period'
  const dateRange = formatDateRange(card.startStr, card.endStr)
  const likeCount = card.likeCount ?? 0
  const saveCount = card.saveCount ?? 0
  const shareCount = card.shareCount ?? 0
  const hasEngagement = likeCount > 0 || saveCount > 0 || shareCount > 0

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined
  const shareTitle = `${card.city} — ${card.periodLabel} | Ryan Realty`

  return (
    <div
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/20 hover:shadow-md"
      style={{ minHeight: TILE_MIN_HEIGHT_PX }}
    >
      <div className="relative aspect-[4/3] w-full flex-shrink-0 overflow-hidden">
        <Link href={href} className="absolute inset-0 block" onClick={() => trackEvent('view_market_report', { context: 'sales_report_card', city: card.city, period: card.periodSlug })}>
          {card.featuredImageUrl ? (
            <Image
              src={card.featuredImageUrl}
              alt={`${card.city} market report — ${card.periodLabel}`}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary via-primary/90 to-accent/30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-primary-foreground">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/90">{card.city}</p>
            <h3 className="mt-0.5 text-xl font-bold drop-shadow-md">
              {card.periodLabel}
            </h3>
            <p className="mt-1 text-sm text-primary-foreground/95">{summary}</p>
            {card.medianClosedPrice != null && card.closedCount > 0 && (
              <p className="mt-0.5 text-sm font-medium text-accent-foreground">{formatPrice(card.medianClosedPrice)} median</p>
            )}
            {dateRange && <p className="mt-1 text-xs text-primary-foreground/80">{dateRange}</p>}
          </div>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border bg-muted px-2 py-1.5">
        <ShareButton
          url={shareUrl}
          title={shareTitle}
          variant="compact"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
          aria-label={`Share ${card.city} ${card.periodLabel}`}
        />
        {shareCount > 0 && (
          <span className="min-w-[1ch] text-[10px] tabular-nums text-muted-foreground">{shareCount}</span>
        )}
        {hasEngagement && (
          <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
            {likeCount > 0 && <span>{likeCount} like{likeCount !== 1 ? 's' : ''}</span>}
            {saveCount > 0 && <span>{saveCount} saved</span>}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-border bg-card px-4 py-3">
        <Link href={href} className="group block">
          <span className="text-sm font-semibold text-primary group-hover:text-accent-foreground group-hover:underline">
            View full report
          </span>
          <span className="ml-1.5 text-sm text-muted-foreground" aria-hidden>†’</span>
        </Link>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {hasData ? 'Addresses, sold dates, days on market, property types. Charts and PDF download.' : 'New sales data is added as listings close.'}
        </p>
      </div>
    </div>
  )
}
