'use client'

/**
 * Shared pieces for the unified Subscriptions hub tabs
 * (/admin/crm/subscriptions): date formatting, the status + origin state words,
 * the pagination bar, and the loading skeleton. Kept small on purpose so the
 * two tab components stay readable.
 *
 * P11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * shadcn Badge/Button/Skeleton are gone — StateWord carries status as text +
 * color (never color alone), the pagination controls are quiet v2 Buttons, and
 * the skeleton reuses report-grid.css's av2-rskel rows. Colour comes only from
 * var(--a-*); the layout utilities are untouched.
 */

import { Button, StateWord } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { formatDate } from '@/lib/format/date'
import type { SubscriptionEngagement } from '@/lib/data/crm/subscriptionsAdminEngagement'

export const PAGE_SIZE = 50

/** Short date for the last-notified / last-sent columns. Em dash = never. */
export function formatSubscriptionDate(iso: string | null): string {
  return formatDate(iso)
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <StateWord state={active ? 'ok' : 'waiting'}>
      {active ? 'Active' : 'Paused'}
    </StateWord>
  )
}

/** Origin of a listing alert: who created it. */
export function OriginBadge({ origin }: { origin: string | null }) {
  const o = (origin ?? 'user').trim().toLowerCase()
  if (o === 'broker') return <StateWord state="accent">Broker</StateWord>
  if (o === 'system') return <StateWord state="waiting">System</StateWord>
  return <StateWord state="waiting">User</StateWord>
}

/**
 * Compact sends / opens / clicks rollup + last-open date for one subscription,
 * aggregated from email_events by the DAL. Em dash = never engaged.
 */
export function EngagementCell({ engagement }: { engagement: SubscriptionEngagement }) {
  const { sends, opens, clicks, lastOpenAt } = engagement
  if (sends === 0 && opens === 0 && clicks === 0) {
    return <span className="text-sm" style={{ color: 'var(--a-text-2)' }}>—</span>
  }
  // Spans, not div/p: this renders inside a grid cell that is itself a <span>
  // (av2-rgrid__c), so a block element here would be invalid nesting.
  return (
    <span className="block min-w-0">
      {/* truncate, not bare whitespace-nowrap: a <td> grew to fit its content,
          a grid track does not, so nowrap text would spill into the next cell. */}
      <span className="block truncate text-sm tabular-nums" style={{ color: 'var(--a-text)' }}>
        {sends.toLocaleString('en-US')} sent · {opens.toLocaleString('en-US')} opened · {clicks.toLocaleString('en-US')} clicked
      </span>
      <span className="block truncate text-xs tabular-nums" style={{ color: 'var(--a-text-2)' }}>
        Last open {formatDate(lastOpenAt)}
      </span>
    </span>
  )
}

export function PaginationBar({
  page,
  total,
  isPending,
  onPage,
}: {
  page: number
  total: number
  isPending: boolean
  onPage: (next: number) => void
}) {
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)
  const hasPrev = page > 0
  const hasNext = to < total
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
      <p className="text-xs tabular-nums" style={{ color: 'var(--a-text-2)' }}>
        Showing {from.toLocaleString('en-US')} to {to.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="quiet" disabled={!hasPrev || isPending} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="quiet" disabled={!hasNext || isPending} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        // Height/margin inline: report-grid.css is un-layered, so its own
        // height:14px would win over a Tailwind h-10.
        <div key={i} className="av2-rskel__row" style={{ height: 40, margin: 0 }} />
      ))}
    </div>
  )
}
