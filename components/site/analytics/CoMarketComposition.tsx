/**
 * CoMarketComposition — closed-sales mix by PropertyType for one year (CO).
 *
 * Visual thesis (E6): lead property type owns a large callout; the rest
 * support as ranked bars. Not an equal list of gray rows.
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
  const lead = entries[0]
  const leadPct = total ? (100 * lead.n) / total : 0
  const rest = entries.slice(1)

  return (
    <section
      className="kb-section"
      data-analytics="co-market-composition"
      aria-labelledby="co-comp-h"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <p className="text-xs font-medium uppercase tracking-widest opacity-70">
              Closed sales · {row.year} · composition
            </p>
            <h2 id="co-comp-h" className="mt-2 font-display text-3xl md:text-4xl">
              What the market is made of
            </h2>
            <p className="mt-3 max-w-md text-base opacity-90">
              Share of closed units by property type in Central Oregon ({row.year}). Not active
              inventory.
            </p>

            {/* Lead type plate — asymmetric dominance */}
            <div className="mt-8 border-2 border-current p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                Largest share
              </p>
              <p className="mt-2 font-display text-2xl leading-tight md:text-3xl">
                {labelPropertyType(lead.code)}
              </p>
              <p className="mt-1 text-sm opacity-60">MLS type {lead.code}</p>
              <p className="mt-5 font-display text-5xl tabular-nums leading-none md:text-6xl">
                {leadPct.toFixed(1)}%
              </p>
              <p className="mt-3 text-sm tabular-nums opacity-80">
                {lead.n.toLocaleString('en-US')} of {row.soldCount.toLocaleString('en-US')} closes
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 lg:pt-10">
            <p className="mb-5 text-xs font-medium uppercase tracking-widest opacity-70">
              Full mix · {row.year}
            </p>
            <ul className="space-y-5" role="list">
              {entries.map((e) => {
                const pct = total ? (100 * e.n) / total : 0
                const isLead = e.code === lead.code
                return (
                  <li key={e.code}>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                      <span className={isLead ? 'font-semibold' : undefined}>
                        {labelPropertyType(e.code)}{' '}
                        <span className="opacity-50">({e.code})</span>
                      </span>
                      <span className="tabular-nums opacity-90">
                        {e.n.toLocaleString('en-US')} · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full border border-current/20">
                      <div
                        className={isLead ? 'h-full bg-current/85' : 'h-full bg-current/45'}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {rest.length === 0 ? (
              <p className="mt-4 text-sm opacity-70">
                All closed units in this year share a single property type in the cube.
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-8 text-xs opacity-70">
          {ANALYTICS_METHODOLOGY_V1}. Source {row.source}. {row.year} total closes{' '}
          {row.soldCount.toLocaleString('en-US')}.
        </p>
      </div>
    </section>
  )
}
