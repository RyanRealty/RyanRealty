/**
 * CoMarketSizeStrip — public CO closed-sales size (all property types).
 * Renders inside .kb-root so --navy/--cream tokens apply. §0 methodology footer.
 *
 * Visual thesis (E6): one year owns the band; the multi-year series is a compact
 * timeline rail, not an equal card dump.
 */
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function moneyPrice(n: number | null): string {
  if (n == null) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

type Props = {
  series: CoMarketAnnualRow[]
  highlightYear?: number
}

export function CoMarketSizeStrip({ series, highlightYear }: Props) {
  const usable = series.filter((r) => r.soldCount > 0 && r.year > 0)
  if (!usable.length) return null

  const years = usable.map((r) => r.year)
  const hi = highlightYear ?? Math.max(...years)
  const highlight = usable.find((r) => r.year === hi) ?? usable[usable.length - 1]
  const sorted = [...usable].sort((a, b) => a.year - b.year)
  const maxVol = Math.max(...sorted.map((r) => r.totalVolume), 1)

  return (
    <section
      className="kb-section border-y border-current/10"
      data-analytics="co-market-size"
      aria-labelledby="co-market-size-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          {/* Featured year — owns the band */}
          <div className="lg:col-span-5">
            <p className="text-xs font-medium uppercase tracking-widest opacity-70">
              Closed sales · Central Oregon service area
            </p>
            <h2
              id="co-market-size-heading"
              className="mt-2 font-display text-3xl md:text-4xl"
            >
              Size of the market
            </h2>
            <p className="mt-3 max-w-md text-base opacity-90">
              Dollar volume and units of closed sales (all property types), not only
              active list inventory.
            </p>

            <div className="mt-8 border-2 border-current bg-background/30 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                {highlight.year}
                <span className="opacity-50"> · latest full year</span>
              </p>
              <p className="mt-3 font-display text-5xl tabular-nums leading-none tracking-tight md:text-6xl">
                {money(highlight.totalVolume)}
              </p>
              <p className="mt-4 text-base tabular-nums opacity-90">
                <span className="font-semibold">
                  {highlight.soldCount.toLocaleString('en-US')}
                </span>{' '}
                closes
                {highlight.medianClose != null ? (
                  <>
                    <span className="mx-2 opacity-40" aria-hidden>
                      ·
                    </span>
                    Median close{' '}
                    <span className="font-semibold">{moneyPrice(highlight.medianClose)}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* Series rail — compact timeline, relative volume bars */}
          <div className="lg:col-span-7">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest opacity-70">
              Annual closed volume
            </p>
            <ul className="space-y-2" role="list">
              {sorted.map((row) => {
                const isHi = row.year === highlight.year
                const pct = Math.max(4, Math.round((100 * row.totalVolume) / maxVol))
                return (
                  <li
                    key={row.year}
                    className={
                      isHi
                        ? 'border border-current bg-background/40'
                        : 'border border-current/15 bg-background/10'
                    }
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 pt-2.5 pb-1.5 sm:px-4">
                      <span
                        className={
                          isHi
                            ? 'text-sm font-semibold tabular-nums'
                            : 'text-sm tabular-nums opacity-80'
                        }
                      >
                        {row.year}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {money(row.totalVolume)}
                      </span>
                      <span className="w-full text-xs tabular-nums opacity-70 sm:ml-auto sm:w-auto">
                        {row.soldCount.toLocaleString('en-US')} closes
                        <span className="mx-1.5 opacity-40" aria-hidden>
                          ·
                        </span>
                        med {moneyPrice(row.medianClose)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-current/10" aria-hidden>
                      <div
                        className={isHi ? 'h-full bg-current/80' : 'h-full bg-current/45'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-xs leading-relaxed opacity-70">
          Source: Oregon Data Share MLS warehouse via Ryan Realty analytics.
          Filter: {ANALYTICS_METHODOLOGY_V1}. Type scope shown: all property
          types (not SFR-only pulse). Figures{' '}
          {highlight.source === 'mart' ? 'from pre-aggregated mart' : 'aggregated on read (cached)'}
          . As of {new Date(highlight.computedAt).toISOString().slice(0, 10)}.
        </p>
      </div>
    </section>
  )
}
