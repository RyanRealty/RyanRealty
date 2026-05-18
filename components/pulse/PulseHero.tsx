import type { PulseRegionSnapshot } from '@/app/actions/pulse-feed'

function formatPriceShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatHealthVerdict(label: string | null | undefined, mos: number | null | undefined): string {
  if (label && label.trim()) return label
  if (mos == null) return 'Tracking'
  if (mos <= 4) return 'Seller market'
  if (mos < 6) return 'Balanced'
  return 'Buyer market'
}

export default function PulseHero({ regionSnapshot }: { regionSnapshot: PulseRegionSnapshot | null }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Bend · Oregon
        </p>
        <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">
          The Central Oregon market pulse
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Every new listing, every sold home, every price drop. Live from the MLS, in order.
          Pick the cities you care about and scroll.
        </p>
        {regionSnapshot && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-10">
            <Stat
              label="Active listings"
              value={regionSnapshot.active_count.toLocaleString('en-US')}
            />
            <Stat label="Median list" value={formatPriceShort(regionSnapshot.median_list_price)} />
            <Stat
              label="Months of supply"
              value={
                regionSnapshot.months_of_supply != null
                  ? `${regionSnapshot.months_of_supply.toFixed(1)} mo`
                  : '—'
              }
            />
            <Stat
              label="Market"
              value={formatHealthVerdict(
                regionSnapshot.market_health_label,
                regionSnapshot.months_of_supply
              )}
            />
          </dl>
        )}
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-xl tabular-nums text-foreground sm:text-2xl">
        {value}
      </dd>
    </div>
  )
}
