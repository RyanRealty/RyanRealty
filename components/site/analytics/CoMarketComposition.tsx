/**
 * CoMarketComposition — closed-sales mix by PropertyType for one year (CO).
 */
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'

type Props = {
  row: CoMarketAnnualRow | null
}

export function CoMarketComposition({ row }: Props) {
  if (!row || row.soldCount <= 0) return null
  const entries = Object.entries(row.propertyTypeBreakdown || {})
    .map(([code, n]) => ({ code, n: Number(n) || 0 }))
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n)
  if (!entries.length) return null
  const total = entries.reduce((a, e) => a + e.n, 0) || row.soldCount

  return (
    <section className="kb-section" data-analytics="co-market-composition" aria-labelledby="co-comp-h">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <p className="text-xs font-medium uppercase tracking-widest opacity-70">
          Closed sales · {row.year} · composition
        </p>
        <h2 id="co-comp-h" className="mt-2 font-display text-3xl md:text-4xl">
          What the market is made of
        </h2>
        <p className="mt-3 max-w-2xl text-base opacity-90">
          Share of closed units by property type in Central Oregon ({row.year}). Not active inventory.
        </p>
        <ul className="mt-8 space-y-3">
          {entries.map((e) => {
            const pct = total ? (100 * e.n) / total : 0
            return (
              <li key={e.code}>
                <div className="flex justify-between text-sm">
                  <span>
                    {labelPropertyType(e.code)}{' '}
                    <span className="opacity-60">({e.code})</span>
                  </span>
                  <span className="tabular-nums">
                    {e.n.toLocaleString('en-US')} · {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full border border-current/15">
                  <div className="h-full bg-current/70" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-6 text-xs opacity-70">
          {ANALYTICS_METHODOLOGY_V1}. Source {row.source}. {row.year} total closes{' '}
          {row.soldCount.toLocaleString('en-US')}.
        </p>
      </div>
    </section>
  )
}
