// @no-parity — dev-only P6 visual prototype. Parity contracts bind production routes to
// their mockups; this page IS the design artifact the visual lock is judged on, and it is
// noindex, unlinked, and never shipped as a public destination.
/**
 * P6 VISUAL PROTOTYPE — the moving prototype the visual lock requires.
 *
 * Demonstrates the SIX locked section patterns from design_system/public/PUBLIC_UI.md
 * against REAL data through the DAL, with the continuity motion the IA lock specified.
 * Static screens are a hard refuse; this is the artifact Matt judges the visual lock on.
 *
 * Patterns shown, in the Market-node rhythm: Instrument -> Field -> Ledger -> Stage ->
 * Sheet -> Quiet. No two adjacent sections share a pattern.
 */
import type { Metadata } from 'next'
import { getMarketPulse, getListingTiles } from '@/lib/data'
import { PublicV3Prototype } from './PublicV3Prototype.client'

export const metadata: Metadata = {
  title: 'Public v3 prototype',
  robots: { index: false, follow: false },
}

export const revalidate = 300

export default async function PublicV3PrototypePage() {
  // No catch-and-swallow here: a failed read must surface as a failure, never as a
  // confident empty state (CLAUDE.md section 0 + the swallowed-errors-lie rule).
  const [pulse, tiles] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    getListingTiles({ city: 'Bend', status: 'active', limit: 6 }),
  ])

  return (
    <PublicV3Prototype
      place="Bend"
      pulse={
        pulse
          ? {
              activeCount: pulse.activeCount,
              medianListPrice: pulse.medianListPrice,
              monthsOfSupply: pulse.monthsOfSupply,
              medianDaysToPending: pulse.medianDaysToPending,
              soldCount30d: pulse.closedLast30Days,
              updatedAt: pulse.refreshedAt,
            }
          : null
      }
      tiles={tiles.map((t) => ({
        listingKey: t.listingKey,
        price: t.listPrice,
        beds: t.beds,
        baths: t.baths,
        sqft: t.sqft,
        street: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
        city: t.city,
        photoUrl: t.photoUrl,
        dom: t.dom,
      }))}
    />
  )
}
