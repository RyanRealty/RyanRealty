/**
 * Stacked Zillow-style house carousels for Home `/`.
 * Replaces the lonely Field grid. Each row is an honest shelf from live tiles.
 * SITE-83: V3Carousel rails; optional animated for-sale count on the lead row.
 */
import { formatCount } from '@/lib/format/count'
import { HomeListingRail } from './HomeListingRail.client'
import type { HomeRailRow } from './home-rail-items'

export function HomeHomesRails({
  rows,
  emptyMessage,
  forSaleCount,
}: {
  rows: HomeRailRow[]
  emptyMessage: string
  /** Live regional for-sale count — animated once on the lead rail. */
  forSaleCount?: number | null
}) {
  if (rows.length === 0) {
    return (
      <p className="home-rail home-rail--empty" role="status">
        {emptyMessage}
      </p>
    )
  }

  const live =
    forSaleCount != null && Number.isFinite(forSaleCount) && forSaleCount > 0
      ? { forSale: forSaleCount, forSaleLabel: formatCount(forSaleCount) }
      : undefined

  return (
    <div className="home-rails">
      {rows.map((row, index) => (
        <HomeListingRail key={row.id} row={row} live={index === 0 ? live : undefined} />
      ))}
    </div>
  )
}
