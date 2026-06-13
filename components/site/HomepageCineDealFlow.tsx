/**
 * HomepageCineDealFlow — live market events as first-class UI.
 *
 * The "this site is alive" proof: real new listings, price drops, pendings,
 * and solds from activity_events (joined to listing_tile_mv in the page).
 * Every figure traces to the event row or its payload — a card with an
 * unverifiable number is dropped upstream (§0), so we show fewer cards
 * rather than invent one. No competitor homepage shows live deal flow.
 */

import Link from 'next/link'

export type CineDealCard = {
  key: string
  href: string
  /** Display-cased class: New | Price drop | Pending | Sold */
  tag: 'New' | 'Price drop' | 'Pending' | 'Sold'
  place: string
  /** Pre-formatted segments, e.g. ["$649,000", "−$26,000", "1h ago"]. */
  meta: string[]
  /** Index into meta to render in the positive accent color. */
  posIndex?: number
}

export default function HomepageCineDealFlow({ cards }: { cards: CineDealCard[] }) {
  if (cards.length === 0) return null
  return (
    <section className="cine-deal" aria-label="Live market activity">
      <div className="cine-deal-wrap">
        <div className="cine-deal-head">
          <span className="cine-eyebrow">Live across Central Oregon</span>
          <Link href="/pulse">Open the market pulse →</Link>
        </div>
        <div className="cine-deal-grid v6-tnum">
          {cards.map((c) => (
            <Link key={c.key} href={c.href} className="cine-deal-card">
              <span className="cine-deal-tag">{c.tag}</span>
              <span className="cine-deal-place">{c.place}</span>
              <span className="cine-deal-meta">
                {c.meta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {i === c.posIndex ? <span className="cine-pos">{m}</span> : m}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
