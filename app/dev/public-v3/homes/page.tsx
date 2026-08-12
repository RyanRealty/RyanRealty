// @no-parity. Dev-only P6 visual prototype. Parity contracts bind production routes to
// their mockups. This page IS a design artifact the visual lock is judged on, and it is
// noindex, unlinked, and never shipped as a public destination.
/**
 * P6 VISUAL PROTOTYPE, HOMES NODE.
 *
 * Destination job: "show me the homes, live, filterable, on a map." The locked
 * opening for Homes is the Field pattern, so the first viewport is inventory,
 * never an essay.
 *
 * Patterns, in order: Field -> Ledger -> Sheet -> Quiet. Four of the six, no two
 * adjacent alike (design_system/public/PUBLIC_UI.md section 3).
 *
 * Data, all of it through the DAL, none of it invented:
 *   getListingTiles   active Bend listings, the browse set
 *   getUpcomingOpenHouses  the real open-house calendar, which is what makes the
 *                          "open houses" mode an honest label instead of a proxy
 *                          filter dressed up as one
 * The open-house keys are hydrated back through getListingTiles so the mode has
 * real tiles to render rather than an empty shelf.
 */
import type { Metadata } from 'next'
import { getListingTiles, getUpcomingOpenHouses } from '@/lib/data'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { HomesNode, type HomeTile } from './HomesNode.client'

export const metadata: Metadata = {
  title: 'Public v3 prototype: homes',
  robots: { index: false, follow: false },
}

export const revalidate = 300

const DAY_MS = 24 * 60 * 60 * 1000

/** "14:00:00" to "2 PM". A string parse, not a date format. */
function clockLabel(hms: string | null): string | null {
  if (!hms) return null
  const [h, m] = hms.split(':')
  const hour = Number(h)
  if (!Number.isFinite(hour)) return null
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return m && m !== '00' ? `${h12}:${m} ${suffix}` : `${h12} ${suffix}`
}

export default async function PublicV3HomesPage() {
  const now = new Date()
  const todayIso = zonedDateKey(now)
  const throughIso = zonedDateKey(new Date(now.getTime() + 14 * DAY_MS))

  // No catch-and-swallow. A failed read must surface as a failure, never as a
  // confident empty state (CLAUDE.md section 0).
  const [browseTiles, openHouses] = await Promise.all([
    getListingTiles({ city: 'Bend', status: 'active', limit: 12 }),
    getUpcomingOpenHouses({
      dateFromIso: todayIso,
      dateToIso: throughIso,
      todayIso,
      city: 'Bend',
    }),
  ])

  const openByKey = new Map(openHouses.map((o) => [o.listing_key, o]))
  const browseKeys = new Set(browseTiles.map((t) => t.listingKey))
  const openOnlyKeys = openHouses
    .map((o) => o.listing_key)
    .filter((k) => !browseKeys.has(k))
    .slice(0, 8)

  const openTiles = openOnlyKeys.length
    ? await getListingTiles({
        city: 'Bend',
        status: 'active',
        listingKeys: openOnlyKeys,
        limit: 8,
      })
    : []

  const tiles: HomeTile[] = [...browseTiles, ...openTiles].map((t) => {
    const oh = openByKey.get(t.listingKey)
    // event_date is a bare Pacific calendar day. Anchor it at midday so the
    // pinned-timezone formatter cannot roll it back to the day before.
    const dayLabel = oh
      ? formatDate(`${oh.event_date}T12:00:00`, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: undefined,
        })
      : null
    const timeLabel = oh ? clockLabel(oh.start_time) : null
    return {
      listingKey: t.listingKey,
      price: t.listPrice,
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
      street: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
      city: t.city,
      lat: t.lat,
      lng: t.lng,
      dom: t.dom,
      priceDropCount: t.priceDropCount,
      openHouse: dayLabel ? (timeLabel ? `${dayLabel} at ${timeLabel}` : dayLabel) : null,
    }
  })

  const sourceLine =
    `Source: live MLS through listing_tile_mv and the listings open-house feed, ` +
    `${tiles.length} active Bend homes loaded, open houses through ${formatDate(`${throughIso}T12:00:00`)}.`

  return <HomesNode place="Bend" tiles={tiles} sourceLine={sourceLine} />
}
