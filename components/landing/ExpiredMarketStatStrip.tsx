/**
 * ExpiredMarketStatStrip — compact live market stat row for the expired LP.
 *
 * Framed as "What the market looks like for your re-list" — shows median
 * days to pending + active SFR inventory for Bend using the existing
 * getMarketPulse DAL function (city:bend). Data-accuracy compliant:
 *   - Only renders when values are non-null.
 *   - Tabular numerals.
 *   - Shows "updated" label with ISO date of the last pulse refresh.
 *   - Falls back to null render when the DAL returns nothing.
 *
 * Server component — no interactivity.
 */

import type { MarketPulse } from '@/lib/data/types/market'
import { cn } from '@/lib/utils'

type Props = {
  pulse: MarketPulse | null
  className?: string
}

export function ExpiredMarketStatStrip({ pulse, className }: Props) {
  if (!pulse) return null

  const daysToPending = pulse.medianDaysToPending
  const activeCount = pulse.activeCount

  // Render nothing if both core stats are missing.
  if (daysToPending == null && (!activeCount || activeCount === 0)) return null

  const updatedLabel = pulse.refreshedAt
    ? new Date(pulse.refreshedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })
    : null

  const stats: Array<{ value: string; label: string }> = []

  if (daysToPending != null) {
    stats.push({
      value: `${Math.round(daysToPending)} days`,
      label: 'Median days to pending',
    })
  }

  if (activeCount != null && activeCount > 0) {
    stats.push({
      value: activeCount.toLocaleString('en-US'),
      label: 'Active SFR listings in Bend',
    })
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
          Updated {updatedLabel} · Bend SFR · market_pulse_live
        </p>
      ) : null}
    </aside>
  )
}
