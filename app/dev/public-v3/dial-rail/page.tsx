// @no-parity. Dev-only preview (SITE-194): the listing dial with its rail on the left,
// the right and the bottom, on the same live listings, so the three positions can be
// compared in one scroll. noindex, unlinked, never a public destination.
/**
 * Matt 2026-09-24: "compare the dial with its rail on the left (default),
 * right and bottom from an internal preview."
 *
 * Data, all through the DAL, none of it invented: getListingTiles (active
 * Bend homes) and getListingCardVideo (the same reel each card fetches for
 * itself after the dwell). The dial that leads puts the homes with a reel
 * first, so the dwell-then-play can be seen here without hunting for one.
 */
import type { Metadata } from 'next'
import { getListingCardVideo, getListingTiles } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { V3ListingDial } from '@/components/site/v3'
import type { DialRailPosition } from '@/components/site/v3'

export const metadata: Metadata = {
  title: 'Public v3 preview: dial rail positions',
  robots: { index: false, follow: false },
}

export const revalidate = 300

const POSITIONS: Array<{ position: DialRailPosition; heading: string }> = [
  { position: 'left', heading: 'Rail on the left (default)' },
  { position: 'right', heading: 'Rail on the right' },
  { position: 'bottom', heading: 'Rail under the card' },
]

export default async function DialRailPreviewPage() {
  // No catch-and-swallow: a failed read surfaces as a failure, never as a
  // confident empty preview (CLAUDE.md section 0).
  const tiles = await getListingTiles({ city: 'Bend', status: 'active', limit: 24 })
  const sfr = placeStockSectionsFromTiles(tiles).find((section) => section.key === 'sfr')
  const rows = sfr?.rows ?? []
  const reels = await Promise.all(rows.map((row) => getListingCardVideo(row.listingKey)))
  const withReel = new Set(reels.filter((r) => r.reel).map((r) => r.listingKey))
  const ordered = [...rows]
    .sort((a, b) => Number(withReel.has(b.listingKey)) - Number(withReel.has(a.listingKey)))
    .slice(0, 8)
    .map((row) => ({ ...row, hasVideo: withReel.has(row.listingKey) }))
  const reelCount = ordered.filter((row) => row.hasVideo).length

  return (
    <main className="v3" style={{ padding: '2rem 1rem', display: 'grid', gap: '4rem' }}>
      <p style={{ margin: 0 }}>
        {ordered.length} active Bend single-family homes from the regional MLS, {reelCount} with a walkthrough reel
        (the card plays it about a second and a half after the photograph, once the card is on screen).
      </p>
      {POSITIONS.map(({ position, heading }) => (
        <V3ListingDial
          key={position}
          id={`dial-${position}`}
          heading={heading}
          countLabel={`${ordered.length} for sale`}
          label={`${heading}: Bend homes`}
          listings={ordered}
          railPosition={position}
        />
      ))}
    </main>
  )
}
