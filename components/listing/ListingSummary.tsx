'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"

export type ListingSummaryProps = {
  /** Last time listing was synced from Spark (our DB updated_at or ModificationTimestamp). Null when data is live from Spark. */
  lastSyncedAt: string | null
  /** Days on market (from Spark or computed). */
  daysOnMarket: number | null
  viewCount: number
  saveCount: number
  likeCount: number
  /** e.g. "Oregon Datashare" — optional, shown in "Show more". MLS# and listing agent/office are shown elsewhere on the page. */
  sourceName?: string | null
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return iso
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

function formatDaysOnMarket(days: number): string {
  if (days <= 0) return 'Just listed'
  if (days === 1) return '1 day on market'
  return `${days.toLocaleString()} days on market`
}

function safeCount(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export default function ListingSummary({
  lastSyncedAt,
  daysOnMarket,
  viewCount,
  saveCount,
  likeCount,
  sourceName,
}: ListingSummaryProps) {
  const [showMore, setShowMore] = useState(false)
  const hasMore = !!(sourceName?.trim())
  const v = safeCount(viewCount)
  const s = safeCount(saveCount)
  const l = safeCount(likeCount)
  const hasAnyEngagement = v > 0 || s > 0 || l > 0

  return (
    <section
      className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-5 sm:py-5"
      aria-labelledby="listing-summary-heading"
    >
      <h2 id="listing-summary-heading" className="sr-only">
        Listing summary
      </h2>
      <div className="space-y-3 text-sm">
        {lastSyncedAt && (
          <p className="text-muted-foreground">
            Listing information current as of <span className="font-medium text-foreground">{formatTimestamp(lastSyncedAt)}</span>
            <span className="ml-1 text-muted-foreground">({relativeTime(lastSyncedAt)})</span>
          </p>
        )}
        {daysOnMarket != null && Number.isFinite(daysOnMarket) && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatDaysOnMarket(daysOnMarket)}</span>
          </p>
        )}
        {hasAnyEngagement && (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{v.toLocaleString()}</span> view{v !== 1 ? 's' : ''}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{s.toLocaleString()}</span> save{s !== 1 ? 's' : ''}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{l.toLocaleString()}</span> like{l !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        {hasMore && (
          <>
            {showMore ? (
              <div className="space-y-1 border-t border-border pt-3 text-muted-foreground">
                {sourceName?.trim() && (
                  <p>Source: <span className="font-medium text-foreground">{sourceName.trim()}</span></p>
                )}
              </div>
            ) : null}
            <Button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-accent-foreground font-medium hover:underline focus:outline-none rounded"
              aria-expanded={showMore}
            >
              {showMore ? 'Show less' : 'Show more'}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
