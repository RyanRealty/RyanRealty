/**
 * ExpiredMarketStatStrip — compact leftover market stat row for the expired LP.
 *
 * Framed as "What the market looks like for your re-list". Bend figures are
 * leftover membership. Miss omits. Pulse does not fill.
 *
 * Server component — no interactivity.
 */

import { cn } from '@/lib/utils'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'

type Props = {
  active: number | null
  daysToPending: number | null
  updatedAt: string | null
  extras?: Array<{ value: string; label: string }>
  className?: string
}

export function ExpiredMarketStatStrip({
  active,
  daysToPending,
  updatedAt,
  extras,
  className,
}: Props) {
  const extraStats = extras ?? []
  if (daysToPending == null && (active == null || active === 0) && extraStats.length === 0) {
    return null
  }

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  const stats: Array<{ value: string; label: string }> = []

  const pendingLabel = publishDaysLabel(daysToPending)
  if (pendingLabel) {
    stats.push({
      value: pendingLabel,
      label: 'Median to pending · 90 days',
    })
  }

  if (active != null && active > 0) {
    stats.push({
      value: active.toLocaleString('en-US'),
      label: 'Active leftover houses in Bend',
    })
  }

  for (const extra of extraStats) {
    stats.push(extra)
  }

  if (stats.length === 0) return null

  return (
    <aside
      className={cn(
        'rounded-2xl border border-primary/10 bg-card px-5 py-4',
        className,
      )}
      aria-label="Current Bend market conditions"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What the market looks like for your re-list
      </p>
      <div className="mt-3 flex flex-wrap gap-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-2xl font-semibold tabular-nums text-primary">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {updatedLabel ? (
        <p className="mt-3 text-xs text-muted-foreground/70">
          Updated {updatedLabel} · leftover membership
        </p>
      ) : null}
    </aside>
  )
}
