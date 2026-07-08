'use client'

/**
 * Shared pieces for the delivery-observability surfaces (the Delivery tab on
 * /admin/crm/subscriptions and the per-person ContactDeliveryPanel): the
 * hydration-safe relative timestamp with the absolute time on hover (Tooltip,
 * never the banned title attr), the per-send status badge, and the honest
 * percent formatter (em dash when there is no denominator, never a fake 0%).
 */

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, formatDateTime } from '@/lib/format/date'
import { agoLabel, untilLabel } from '@/lib/format/relative-ago'
import type { DeliverySendStatus } from '@/lib/data/crm/emailDelivery'

/**
 * The clock read lives in useEffect (#418): null on the server pass and the
 * first client render, a real ms timestamp after mount. Components render the
 * absolute date until the clock is known, then swap to the relative label.
 */
function useNowMs(): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => { setNowMs(Date.now()) }, [])
  return nowMs
}

/**
 * "2 days ago" with the absolute timestamp on hover. Hydration-safe: renders
 * the absolute short date on the server pass and swaps to the relative label
 * after mount (relative labels read the clock, which differs between server
 * and client renders — the PulseCard mounted-gate precedent).
 */
export function RelativeTime({ iso, className }: { iso: string | null; className?: string }) {
  const nowMs = useNowMs()
  if (!iso) return <span className={className ?? 'text-muted-foreground'}>—</span>
  const label = nowMs !== null ? agoLabel(iso, nowMs) : formatDate(iso)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className ?? 'whitespace-nowrap text-muted-foreground'}>{label}</span>
        </TooltipTrigger>
        <TooltipContent>{formatDateTime(iso)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** "in 12 days" / "due now" with the absolute expected date on hover. */
export function ExpectedTime({ iso, dueNow, className }: { iso: string | null; dueNow: boolean; className?: string }) {
  const nowMs = useNowMs()
  if (dueNow) return <span className={className ?? 'whitespace-nowrap text-foreground'}>due now</span>
  if (!iso) return <span className={className ?? 'text-muted-foreground'}>—</span>
  const label = nowMs !== null ? untilLabel(iso, nowMs) : formatDate(iso)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className ?? 'whitespace-nowrap text-muted-foreground'}>{label}</span>
        </TooltipTrigger>
        <TooltipContent>{formatDateTime(iso)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Broker-language label per send status. */
const STATUS_LABELS: Record<DeliverySendStatus, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  unsubscribed: 'Unsubscribed',
  'spam complaint': 'Marked spam',
  bounced: 'Bounced',
}

export function SendStatusBadge({ status }: { status: DeliverySendStatus }) {
  const label = STATUS_LABELS[status]
  switch (status) {
    case 'clicked':
      return <Badge variant="soft-hot">{label}</Badge>
    case 'opened':
      return <Badge variant="success">{label}</Badge>
    case 'delivered':
      return <Badge variant="outline">{label}</Badge>
    case 'sent':
      return <Badge variant="soft-neutral">{label}</Badge>
    case 'unsubscribed':
      return <Badge variant="warning">{label}</Badge>
    case 'spam complaint':
    case 'bounced':
      return <Badge variant="destructive">{label}</Badge>
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

/** "42.1%" from a fraction in [0,1]; em dash for null (no sends yet). */
export function percentLabel(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}
