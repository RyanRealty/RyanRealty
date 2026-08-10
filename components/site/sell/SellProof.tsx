/**
 * SellProof — the track-record proof section for /sell.
 *
 * Conversion rhythm (E5): sits immediately after the hero form so the seller
 * sees receipts before the long service story. Structure:
 *   1. Hard-edged KB ledger of live aggregate sold stats
 *      (getBrokerageTrackRecord) + Google review aggregate.
 *   2. Real sold homes (Sold Stories pipeline) with broker attribution and
 *      verbatim paired Google pull quotes.
 *   3. Optional re-ask CTA back to the on-page form (#get-value).
 *
 * DATA ACCURACY (CLAUDE.md §0): every number is a live DAL value or the cell
 * does not render. Review quotes are verbatim with attribution.
 *
 * Server component. Props-driven — the page fetches, this renders.
 */

import type { BrokerageTrackRecord } from '@/lib/data/track-record'
import { formatPriceCompact, type SoldStory } from '@/app/lp/seller-home-value/data'
import { CTAButton } from '@/components/site/primitives'

type Props = {
  record: BrokerageTrackRecord | null
  /** Aggregate from lib/testimonials.ts (count of verified Google reviews on file). */
  reviewAggregate: { count: number; rating: string } | null
  /** Pre-filtered sold stories (badge 'Sold'), max 3. */
  stories: SoldStory[]
  /** On-page form anchor (B3). Defaults to hero form. */
  valuationHref?: string
}

export function SellProof({
  record,
  reviewAggregate,
  stories,
  valuationHref = '#get-value',
}: Props) {
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
        {/* Asymmetric head: title left, MLS source right on desktop */}
        <div className="sec-head">
          <div>
            <span className="sec-index">Closed sales</span>
            <h2 className="sec-title display">Homes we have sold.</h2>
          </div>
          <p className="sp-foot">
            Figures from the Central Oregon MLS for homes listed by Ryan Realty.
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

        {/* Re-ask after proof — keep the form one scroll-gesture away */}
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm font-medium text-muted-foreground sm:text-base">
            Want the comps for your address? The written valuation is free and requires no listing agreement.
          </p>
          <CTAButton href={valuationHref} tone="primary" size="md" className="shrink-0">
            Get the written valuation
          </CTAButton>
        </div>
      </div>
    </section>
  )
}
