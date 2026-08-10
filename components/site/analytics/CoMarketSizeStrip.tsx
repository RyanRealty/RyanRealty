/**
 * CoMarketSizeStrip — public CO closed-sales size (all property types).
 * Renders inside .kb-root so --navy/--cream tokens apply. §0 methodology footer.
 */
import { ANALYTICS_METHODOLOGY_V1, type CoMarketAnnualRow } from '@/lib/data'

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

  return (
    <section
      className="kb-section"
      data-analytics="co-market-size"
      aria-labelledby="co-market-size-heading"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <p className="text-xs font-medium uppercase tracking-widest opacity-70">
          Closed sales · Central Oregon service area
        </p>
        <h2
          id="co-market-size-heading"
          className="mt-2 font-display text-3xl md:text-4xl"
        >
          Size of the market
        </h2>
        <p className="mt-3 max-w-2xl text-base opacity-90">
          Dollar volume and units of closed sales (all property types), not only
          active list inventory. {highlight.year}:{' '}
          <strong>{money(highlight.totalVolume)}</strong> across{' '}
          <strong>{highlight.soldCount.toLocaleString('en-US')}</strong> closes
          {highlight.medianClose != null ? (
            <>
              ; median close <strong>{moneyPrice(highlight.medianClose)}</strong>
            </>
          ) : null}
          .
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map((row) => {
            const isHi = row.year === highlight.year
            return (
              <div
                key={row.year}
                className={
                  isHi
                    ? 'border-2 border-current bg-background/40 p-5'
                    : 'border border-current/20 bg-background/20 p-5'
                }
              >
                <div className="text-xs uppercase tracking-wide opacity-70">
                  {row.year}
                  {isHi ? ' · latest full year' : ''}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {money(row.totalVolume)}
                </div>
                <div className="mt-1 text-sm tabular-nums opacity-90">
                  {row.soldCount.toLocaleString('en-US')} closes
                </div>
                <div className="mt-0.5 text-xs opacity-70">
                  Median {moneyPrice(row.medianClose)}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-xs leading-relaxed opacity-70">
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
