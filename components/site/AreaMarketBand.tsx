import type { AreaMarket } from '@/lib/area-market'
import { marketClass, marketClassLabel, money, marketSentence } from '@/lib/area-market'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

/**
 * The live city-market read for a content-engine detail page — the real-estate
 * moat (docs/CONTENT_ENGINE_SPEC.md §3). Renders an honest one-line summary plus
 * the median list price, active inventory, months of supply + seller/balanced/
 * buyer classification, and typical days to pending, with a link to the full
 * city market. All figures come from getMarketPulse (CLAUDE.md §0) — cream band
 * so it reads distinct from the navy hyperlocal "homes nearby" band.
 */
export function AreaMarketBand({ market, citySlug }: { market: AreaMarket; citySlug: string }) {
  const cls = marketClass(market.monthsOfSupply)
  const sentence = marketSentence(market)

  return (
    <section className="section about ev-market" aria-label={`The ${market.city} market`}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">Living in {market.city}</span>
          <h2 className="sec-title display">The market here</h2>
        </div>
        {sentence ? <p className="ev-market-lede">{sentence}</p> : null}
        <div className="ev-market-grid">
          <div className="ev-market-stat">
            <span className="ev-market-lbl mono-lab">Median list price</span>
            <span className="ev-market-val display">{money(market.medianListPrice) ?? '—'}</span>
          </div>
          <div className="ev-market-stat">
            <span className="ev-market-lbl mono-lab">Active homes</span>
            <span className="ev-market-val display">{market.activeCount.toLocaleString()}</span>
          </div>
          {market.monthsOfSupply != null ? (
            <div className="ev-market-stat">
              <span className="ev-market-lbl mono-lab">Months of supply</span>
              <span className="ev-market-val display">{formatMonthsOfSupply(market.monthsOfSupply)}</span>
              {cls ? <span className="ev-market-sub">{marketClassLabel(cls)}</span> : null}
            </div>
          ) : null}
          {market.medianDaysToPending != null ? (
            <div className="ev-market-stat">
              <span className="ev-market-lbl mono-lab">Days to pending</span>
              <span className="ev-market-val display">{market.medianDaysToPending}</span>
              <span className="ev-market-sub">Typical time to a signed contract</span>
            </div>
          ) : null}
        </div>
        <p style={{ marginTop: '20px' }}>
          <a className="ev-link" href={`/cities/${citySlug}`}>
            See the full {market.city} market and neighborhoods <span className="arr">→</span>
          </a>
        </p>
      </div>
    </section>
  )
}
