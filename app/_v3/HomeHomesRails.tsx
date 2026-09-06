/**
 * Stacked Zillow-style house carousels for Home `/`.
 * Replaces the lonely Field grid. Each row is an honest shelf from live tiles.
 */
import { HomeListingRail } from './HomeListingRail.client'
import type { HomeRailRow } from './home-rail-items'

export function HomeHomesRails({
  rows,
  emptyMessage,
}: {
  rows: HomeRailRow[]
  emptyMessage: string
}) {
  if (rows.length === 0) {
    return (
      <p className="home-rail home-rail--empty" role="status">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="home-rails">
      {rows.map((row) => (
        <HomeListingRail key={row.id} row={row} />
      ))}
    </div>
  )
}
