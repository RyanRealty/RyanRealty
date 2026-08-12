// @no-parity - dev-only P6 visual prototype. Parity contracts bind production routes to
// their mockups. This route is one node of the moving prototype the visual lock is judged
// on, and it is noindex, unlinked, and never shipped as a public destination.
/**
 * P6 VISUAL PROTOTYPE, PLACES NODE (Tumalo).
 *
 * Destination job: tell me about this place before I commit to it.
 *
 * The locked opening for Places is Instrument then Field. Tumalo cannot honor it, and the
 * reason is data, not taste: the MLS carries no Tumalo city value, so the city-keyed pulse
 * row exists but reads zero active with a null median and a null months of supply. A
 * verdict cannot be derived from nulls, so this node opens on Field per the fallback and
 * places the Instrument second, against the Bend row Tumalo's records actually file into,
 * labeled as Bend's own figures. Publishing Bend's numbers under a Tumalo headline would
 * be the misattribution CLAUDE.md section 0 forbids.
 *
 * Pattern order: Field, Instrument, Ledger, Quiet. Four of six, no two adjacent alike.
 *
 * Section 0 discipline: the city-shaped query returned nothing, so a second, differently
 * shaped query runs beside it (a coordinate window, and the three MLS subdivisions carrying
 * the Tumalo name). Both shapes render, and the empty one is shown as empty rather than
 * hidden.
 */
import type { Metadata } from 'next'
import { getMarketPulse, getListingTiles, getListingTilesCount } from '@/lib/data'
import { TumaloPlaceNode } from './TumaloPlaceNode.client'

export const metadata: Metadata = {
  title: 'Public v3 prototype, Places node',
  robots: { index: false, follow: false },
}

export const revalidate = 300

/**
 * The coordinate window drawn around Tumalo. It is a window, not a boundary: the bounds
 * ship to the page and print under the map, so what the count covers is inspectable. Every
 * figure derived from it is described as "inside this window", never as "in Tumalo".
 */
const TUMALO_WINDOW = { west: -121.4, south: 44.12, east: -121.27, north: 44.21 }

/** The three `SubdivisionName` values in the MLS that carry the Tumalo name. */
const TUMALO_SUBDIVISIONS = ['Tumalo Heights', 'Tumalo Rim', 'Tumalo Riverfront Es']

export default async function PublicV3PlacesNodePage() {
  // No catch-and-swallow. A failed read must surface as a failure, never as a confident
  // empty state (CLAUDE.md section 0 plus the swallowed-errors-lie rule). getListingTiles
  // validates synchronously, so a .catch() would not even attach.
  const [tumaloPulse, tumaloCityTiles, windowTiles, windowCount, bendPulse, sales, activeCounts] =
    await Promise.all([
      getMarketPulse({ geoType: 'city', geoSlug: 'tumalo' }),
      getListingTiles({ city: 'Tumalo', status: 'active', limit: 6 }),
      getListingTiles({ bbox: TUMALO_WINDOW, status: 'active', limit: 12, sort: 'newest' }),
      getListingTilesCount({ bbox: TUMALO_WINDOW, status: 'active' }),
      getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
      Promise.all(
        TUMALO_SUBDIVISIONS.map((s) =>
          getListingTiles({ subdivision: s, status: 'closed', sort: 'close-newest', limit: 4 }),
        ),
      ),
      Promise.all(
        TUMALO_SUBDIVISIONS.map((s) => getListingTilesCount({ subdivision: s, status: 'active' })),
      ),
    ])

  // streetSuffix is optional on ListingTile, so the parameter has to allow undefined.
  const street = (t: {
    streetNumber: string | null
    streetName: string | null
    streetSuffix?: string | null
  }) => [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ')

  const recentSales = sales
    .flat()
    .filter((t) => t.closeDate != null)
    .sort((a, b) => String(b.closeDate).localeCompare(String(a.closeDate)))
    .slice(0, 5)
    .map((t) => ({
      listingKey: t.listingKey,
      street: street(t),
      subdivision: t.subdivisionName,
      closePrice: t.closePrice,
      closeDate: t.closeDate,
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
    }))

  return (
    <TumaloPlaceNode
      place="Tumalo"
      parentCity="Bend"
      bounds={TUMALO_WINDOW}
      placePulse={
        tumaloPulse
          ? {
              activeCount: tumaloPulse.activeCount,
              medianListPrice: tumaloPulse.medianListPrice,
              monthsOfSupply: tumaloPulse.monthsOfSupply,
              medianDaysToPending: tumaloPulse.medianDaysToPending,
              closedLast30Days: tumaloPulse.closedLast30Days,
              refreshedAt: tumaloPulse.refreshedAt,
            }
          : null
      }
      cityKeyedTileCount={tumaloCityTiles.length}
      parentPulse={
        bendPulse
          ? {
              activeCount: bendPulse.activeCount,
              medianListPrice: bendPulse.medianListPrice,
              monthsOfSupply: bendPulse.monthsOfSupply,
              medianDaysToPending: bendPulse.medianDaysToPending,
              closedLast30Days: bendPulse.closedLast30Days,
              refreshedAt: bendPulse.refreshedAt,
            }
          : null
      }
      windowCount={windowCount}
      tiles={windowTiles.map((t) => ({
        listingKey: t.listingKey,
        price: t.listPrice,
        beds: t.beds,
        baths: t.baths,
        sqft: t.sqft,
        street: street(t),
        city: t.city,
        subdivision: t.subdivisionName,
        postalCode: t.postalCode,
        lat: t.lat,
        lng: t.lng,
        dom: t.dom,
      }))}
      subdivisions={TUMALO_SUBDIVISIONS}
      subdivisionActiveCount={activeCounts.reduce((sum, n) => sum + n, 0)}
      sales={recentSales}
    />
  )
}
