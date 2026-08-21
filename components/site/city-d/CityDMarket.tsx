import type { ReactNode } from 'react'
import type { CityDMarketKpi } from './types'

export function CityDMarket({
  cityName,
  kpis,
  children,
}: {
  cityName: string
  kpis: CityDMarketKpi[]
  children?: ReactNode
}) {
  return (
    <section className="city-d-section" aria-labelledby="city-d-market">
      <div className="city-d-wrap">
        <span className="city-d-eyebrow">{cityName}</span>
        <h2 id="city-d-market" className="city-d-display">
          Market
        </h2>
        {kpis.length > 0 ? (
          <div className="city-d-kpis">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="city-d-kpi">
                <span className="city-d-kpi-value city-d-display">{kpi.value}</span>
                <span className="city-d-kpi-label">{kpi.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  )
}
