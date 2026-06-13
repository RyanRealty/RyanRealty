/**
 * HomepageCineProof — the trust layer under the cinema. Four live region
 * figures from getRegionPulse (market_pulse_live, 10-15 min refresh) with
 * the source + freshness line. A stat the cache cannot verify is omitted,
 * never estimated (§0).
 */

import { H2 } from '@/components/site/primitives'

type Props = {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
  soldCount30d: number | null
  freshnessLabel: string | null
}

export default function HomepageCineProof({
  activeCount,
  medianListPrice,
  medianDaysToPending,
  soldCount30d,
  freshnessLabel,
}: Props) {
  const stats: Array<{ value: string; label: string }> = []
  if (activeCount != null)
    stats.push({ value: activeCount.toLocaleString('en-US'), label: 'Homes on the market' })
  if (medianListPrice != null)
    stats.push({
      value: `$${(Math.round(medianListPrice / 1000) * 1000).toLocaleString('en-US')}`,
      label: 'Median list price',
    })
  if (medianDaysToPending != null)
    stats.push({ value: `${Math.round(medianDaysToPending)} days`, label: 'Median time to pending' })
  if (soldCount30d != null)
    stats.push({ value: soldCount30d.toLocaleString('en-US'), label: 'Sold in the last 30 days' })

  if (stats.length === 0) return null

  return (
    <section className="cine-proof" aria-label="Central Oregon market numbers">
      <div className="cine-proof-wrap">
        <H2 className="cine-h2">The numbers behind the views</H2>
        <div className="cine-proof-grid">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="cine-stat-value">{s.value}</div>
              <div className="cine-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="cine-proof-foot">
          Single-family, Central Oregon region · live MLS feed
          {freshnessLabel ? ` · updated ${freshnessLabel}` : ''}
        </p>
      </div>
    </section>
  )
}
