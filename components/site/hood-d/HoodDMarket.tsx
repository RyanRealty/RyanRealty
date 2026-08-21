import type { ReactNode } from 'react'

export function HoodDMarket({
  name,
  children,
}: {
  name: string
  children: ReactNode
}) {
  if (!children) return null

  return (
    <section className="hood-d-section hood-d-market" id="market">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Market</span>
          <h2 className="hood-d-display">{name} on the long view</h2>
          <p className="hood-d-kicker">Chart Room. Time, Relate, and Rank.</p>
        </div>
        {children}
      </div>
    </section>
  )
}
