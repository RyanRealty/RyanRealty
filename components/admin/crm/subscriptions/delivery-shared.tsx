'use client'

/**
 * Shared pieces for the delivery-observability surfaces (the Delivery tab on
 * /admin/crm/subscriptions and the per-person ContactDeliveryPanel): the
 * hydration-safe relative timestamp with the absolute time on hover, the
 * per-send status word, and the honest percent formatter (em dash when there is
 * no denominator, never a fake 0%).
 *
 * P11F: on the LOCKED admin v2 language. shadcn Badge became StateWord (status
 * is text + colour, never colour alone), and the shadcn Tooltip became the
 * platform's own `title` — the admin v2 barrel has no tooltip, and its
 * IconButton already carries `title` for exactly this. The public design
 * system's "never the title attribute" rule is a PUBLIC-brand rule; the admin
 * is greenfield of it by the §8 amnesia lock.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { StateWord } from '@/components/admin/v2'
import { formatDate, formatDateTime } from '@/lib/format/date'
import { agoLabel, untilLabel } from '@/lib/format/relative-ago'
import type { DeliverySendStatus } from '@/lib/data/crm/emailDelivery'

/** Colour for the un-styled (no className passed) case, matching each default. */
const QUIET: CSSProperties = { color: 'var(--a-text-2)' }
const STRONG: CSSProperties = { color: 'var(--a-text)' }

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
  if (!iso) return <span className={className} style={className ? undefined : QUIET}>—</span>
  const label = nowMs !== null ? agoLabel(iso, nowMs) : formatDate(iso)
  return (
    <span
      className={className ?? 'whitespace-nowrap'}
      style={className ? undefined : QUIET}
      title={formatDateTime(iso)}
    >
      {label}
    </span>
  )
}

/** "in 12 days" / "due now" with the absolute expected date on hover. */
export function ExpectedTime({ iso, dueNow, className }: { iso: string | null; dueNow: boolean; className?: string }) {
  const nowMs = useNowMs()
  if (dueNow) {
    return (
      <span className={className ?? 'whitespace-nowrap'} style={className ? undefined : STRONG}>
        due now
      </span>
    )
  }
  if (!iso) return <span className={className} style={className ? undefined : QUIET}>—</span>
  const label = nowMs !== null ? untilLabel(iso, nowMs) : formatDate(iso)
  return (
    <span
      className={className ?? 'whitespace-nowrap'}
      style={className ? undefined : QUIET}
      title={formatDateTime(iso)}
    >
      {label}
    </span>
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
      return <StateWord state="accent">{label}</StateWord>
    case 'opened':
      return <StateWord state="ok">{label}</StateWord>
    case 'delivered':
      return <StateWord state="waiting">{label}</StateWord>
    case 'sent':
      return <StateWord state="waiting">{label}</StateWord>
    case 'unsubscribed':
      return <StateWord state="slow">{label}</StateWord>
    case 'spam complaint':
    case 'bounced':
      return <StateWord state="down">{label}</StateWord>
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
