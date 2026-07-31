/**
 * ActivityFeed — "see their own activity" on the /account portal (Phase 4.1,
 * docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md).
 *
 * Presentational only. Every row comes from public.user_events for the signed-in
 * visitor (lib/data/activity/getUserEvents.ts); nothing here invents a figure, and
 * an event type this component has no wording for is skipped rather than
 * rendered as raw column text.
 */

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { UserActivityEvent, UserActivitySummary } from '@/lib/data/activity/getUserEvents'

type Props = {
  rows: UserActivityEvent[]
  summary: UserActivitySummary
  /** Human label per listing key, resolved by the page from the listings DAL. */
  listingLabels?: Record<string, string>
  /** Canonical listing URL per listing key, when the listing still resolves. */
  listingHrefs?: Record<string, string>
}

function formatStamp(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function activeFilterCount(payload: Record<string, unknown> | null): number | null {
  const value = payload?.active_count
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function describe(
  row: UserActivityEvent,
  listingLabels: Record<string, string>,
): { text: string; href: string | null } | null {
  switch (row.eventType) {
    case 'listing_view': {
      const key = row.listingKey ?? ''
      const label = listingLabels[key] || (key ? `MLS ${key}` : '')
      return label ? { text: `Viewed ${label}`, href: null } : null
    }
    case 'search_filter_apply': {
      const count = activeFilterCount(row.payload)
      return {
        text: count != null ? `Changed your search filters, ${count} active` : 'Changed your search filters',
        href: row.pagePath,
      }
    }
    case 'search_map_draw':
      return { text: 'Drew an area on the map', href: row.pagePath }
    case 'search_save':
      return { text: 'Saved a search', href: row.pagePath }
    case 'search_zero_results':
      return { text: 'Ran a search that matched no homes', href: row.pagePath }
    case 'alert_create':
      return { text: 'Started a listing alert', href: row.pagePath }
    case 'page_view':
      return row.pagePath ? { text: `Opened ${row.pagePath}`, href: row.pagePath } : null
    default:
      return null
  }
}

export default function ActivityFeed({ rows, summary, listingLabels = {}, listingHrefs = {} }: Props) {
  const stats = [
    { label: 'Home views', value: summary.listingViews },
    { label: 'Searches run', value: summary.searchesApplied },
    { label: 'Pages opened', value: summary.pageViews },
  ]

  const items = rows
    .map((row) => ({ row, described: describe(row, listingLabels) }))
    .filter((entry): entry is { row: UserActivityEvent; described: { text: string; href: string | null } } =>
      Boolean(entry.described),
    )

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          What the site recorded for you in the last {summary.windowDays} days.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="px-3 py-3">
              <span className="block text-2xl font-bold leading-none tabular-nums text-foreground">
                {stat.value}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{stat.label}</span>
            </Card>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Nothing recorded yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Homes you open and searches you run show up here.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {items.map(({ row, described }) => {
            const listingHref = row.listingKey ? listingHrefs[row.listingKey] : undefined
            const href = listingHref ?? described.href
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                {href ? (
                  <Link
                    href={href}
                    className="min-w-0 flex-1 break-words text-sm font-medium text-foreground hover:underline"
                  >
                    {described.text}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                    {described.text}
                  </span>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatStamp(row.eventAt)}
                </span>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
