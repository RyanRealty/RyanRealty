'use client'

/**
 * Shared pieces for the unified Subscriptions hub tabs
 * (/admin/crm/subscriptions): date formatting, the status + origin badges,
 * the pagination bar, and the loading skeleton. Kept small on purpose so the
 * two tab components stay readable.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format/date'

export const PAGE_SIZE = 50

/** Short date for the last-notified / last-sent columns. Em dash = never. */
export function formatSubscriptionDate(iso: string | null): string {
  return formatDate(iso)
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'soft-neutral'}>
      {active ? 'Active' : 'Paused'}
    </Badge>
  )
}

/** Origin of a listing alert: who created it. */
export function OriginBadge({ origin }: { origin: string | null }) {
  const o = (origin ?? 'user').trim().toLowerCase()
  if (o === 'broker') return <Badge variant="soft-hot">Broker</Badge>
  if (o === 'system') return <Badge variant="outline">System</Badge>
  return <Badge variant="soft-neutral">User</Badge>
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
      <p className="text-xs tabular-nums text-muted-foreground">
        Showing {from.toLocaleString('en-US')} to {to.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={!hasPrev || isPending} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext || isPending} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
