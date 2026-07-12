/**
 * SellProof — the track-record proof section for /sell.
 *
 * A seller choosing who lists their largest asset needs evidence, not
 * adjectives (VOICE.md Law 1 + 2). This section is the receipt block:
 *   1. A hard-edged KB ledger of live aggregate sold stats
 *      (getBrokerageTrackRecord — listings table, ListOfficeName ilike
 *      '%ryan realty%', StandardStatus='Closed') plus the Google review
 *      aggregate from lib/testimonials.ts (verbatim verified reviews).
 *   2. Real sold homes (the LP Sold Stories pipeline — listing_tile_mv via
 *      getListingTiles, curated keys) with broker attribution and, where a
 *      real paired review exists, the verbatim Google pull quote.
 *
 * DATA ACCURACY (CLAUDE.md §0): every number is a live DAL value or the cell
 * does not render. Review quotes are verbatim with attribution (exempt from
 * the Five Laws, never altered). Nothing here is invented to fill a layout.
 *
 * Server component. Props-driven — the page fetches, this renders.
 */

import type { BrokerageTrackRecord } from '@/lib/data/track-record'
import { formatPriceCompact, type SoldStory } from '@/app/lp/seller-home-value/data'

type Props = {
  record: BrokerageTrackRecord | null
  /** Aggregate from lib/testimonials.ts (count of verified Google reviews on file). */
  reviewAggregate: { count: number; rating: string } | null
  /** Pre-filtered sold stories (badge 'Sold'), max 3. */
  stories: SoldStory[]
}

export function SellProof({ record, reviewAggregate, stories }: Props) {
  const cells: { num: string; label: string }[] = []
  if (record) {
    cells.push({ num: record.homesSold.toLocaleString('en-US'), label: 'Homes sold' })
    cells.push({ num: formatPriceCompact(record.totalVolume), label: 'Closed volume' })
    cells.push({
      num: `$${(Math.round(record.avgSalePrice / 1000) * 1000).toLocaleString('en-US')}`,
      label: 'Average sale price',
    })
  }
  if (reviewAggregate) {
    cells.push({
      num: reviewAggregate.rating,
      label: `Google rating · ${reviewAggregate.count} reviews`,
    })
  }

  if (cells.length === 0 && stories.length === 0) return null

  return (
    <section className="section sell-proof" id="track-record" aria-label="Ryan Realty track record">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="sec-index">The track record</span>
            <h2 className="sec-title display">Sold and closed.</h2>
          </div>
          <p className="sp-foot">
            Sales figures from the Central Oregon MLS record for Ryan Realty listings.
          </p>
        </div>

        {cells.length > 0 ? (
          <div className="sp-ledger">
            {cells.map((c) => (
              <div className="sp-cell" key={c.label}>
                <span className="sp-num">{c.num}</span>
                <span className="sp-label">{c.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {stories.length > 0 ? (
          <div className="sp-grid">
            {stories.map((s) => (
              <article className="sp-card" key={s.key}>
                <div className="sp-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.listing.photoUrl}
                    alt={`${s.listing.addressLine}${s.listing.neighborhood ? `, ${s.listing.neighborhood}` : ''}`}
                    loading="lazy"
                  />
                  <span className="sp-badge">{s.listing.displayPrice}</span>
                </div>
                <div className="sp-meta">
                  <b className="sp-addr">{s.listing.addressLine}</b>
                  <span className="sp-hood">
                    {s.listing.neighborhood ? `${s.listing.neighborhood} · ` : ''}
                    {s.side === 'buy'
                      ? `Buyer represented by ${s.brokerFirstName}`
                      : `Marketed by ${s.brokerFirstName}`}
                  </span>
                  {s.testimonial ? (
                    <blockquote className="sp-quote">
                      “{s.testimonial.pull}”
                      <cite>{s.testimonial.author} · Google review</cite>
                    </blockquote>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
