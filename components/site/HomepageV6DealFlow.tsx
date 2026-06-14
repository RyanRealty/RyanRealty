/**
 * HomepageV6DealFlow — market events as first-class UI (v6 LOCKED bones).
 *
 * Four terminal-grade cards, one per event class when available (New /
 * Price drop / Pending / Sold), drawn live from activity_events joined to
 * listing_tile_mv by app/page.tsx. Every figure on a card traces to the
 * event row or its payload (previous_price/new_price, ClosePrice) — no
 * invented numbers, cards with unverifiable figures are skipped upstream.
 *
 * Linear finish: hairline borders, glass cards, 150ms hover, no marquee.
 */

import Link from 'next/link'

export type DealFlowCard = {
  key: string
  href: string
  /** Card class label, already display-cased: New | Price drop | Pending | Sold */
  type: 'New' | 'Price drop' | 'Pending' | 'Sold'
  /** Neighborhood, subdivision, or city — most specific verified geo. */
  place: string
  /** Pre-formatted meta segments, e.g. ["$649,000", "−$26,000", "1h ago"]. */
  meta: string[]
  /** Index into meta of the segment to render in the positive accent color. */
  posIndex?: number
}

export default function HomepageV6DealFlow({ cards }: { cards: DealFlowCard[] }) {
  if (cards.length === 0) return null
  return (
    <section className="v6-deal-flow" aria-label="Live market activity">
      <div className="v6-deal-head">
        <span className="v6-label">Deal flow</span>
        <Link href="/pulse">Open pulse →</Link>
      </div>
      <div className="v6-deal-grid v6-tnum">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="v6-deal-card v6-panel">
            <span className="v6-type">{c.type}</span>
            <span className="v6-place">{c.place}</span>
            <span className="v6-meta">
              {c.meta.map((m, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {i === c.posIndex ? <span className="v6-pos">{m}</span> : m}
                </span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
