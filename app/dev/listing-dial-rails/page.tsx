// @no-parity. Dev-only preview of the listing dial's three rail positions. Parity contracts
// bind production routes to their section lists; this page is the artifact Matt chooses
// from. It is noindex, unlinked, refused in production by middleware (lib/routing/dev-only.ts),
// disallowed in robots, and never a public destination.
/**
 * LISTING DIAL RAILS PREVIEW (Matt 2026-09-24).
 *
 * "Compare versions of the dial with the thumbnail rail on the left, the
 * right, and the bottom." Then: the default is the bottom, and a page that
 * stacks dials varies them (dialRailPositionAt), so no two adjacent dials
 * turn the same way.
 *
 * The same real listing set renders once per position, then once more on the
 * right at the neighborhood band's full width (where the dial runs under the
 * Jax button and the right-hand column has to clear it), then a stacked page
 * of one dial per property type using dialRailPositionAt.
 *
 * The set is live active stock through the DAL: Tetherow's townhomes, led by
 * two listings whose reels are a file (View Ridge, a walkerandhomes mp4) and
 * a YouTube reel (Monterra Condominiums), so every reel host the card plays
 * (file, YouTube, Vimeo, Cloudflare Stream) is on the dial. Rest on a card and
 * its reel plays after the dwell.
 */
import type { Metadata } from 'next'
import type { ListingTile } from '@/lib/data'
import { V3_ROOT_CLASS, V3ListingDial, dialRailPositionAt, type DialRailPosition } from '@/components/site/v3'
import {
  loadPlaceStockTiles,
  placeStockRowFromTile,
  placeStockSectionsFromTiles,
} from '@/lib/place/place-inventory-stock'

export const metadata: Metadata = {
  title: 'Listing dial rails preview',
  robots: { index: false, follow: false },
}

// Never prerendered: a dev preview must not read the database at build time.
export const dynamic = 'force-dynamic'

/** View Ridge, Bend: its MLS reel is a direct mp4 (walkerandhomes share.mp4). */
const FILE_REEL_KEY = '20260520185541466686000000'
/** Monterra Condominiums, Bend: its MLS reel is a YouTube Short. */
const YOUTUBE_REEL_KEY = '20260403021109764734000000'

const POSITIONS: ReadonlyArray<{ rail: DialRailPosition; heading: string }> = [
  { rail: 'bottom', heading: 'Bottom (the default): the strip under the card' },
  { rail: 'left', heading: 'Left: a column beside the card' },
  { rail: 'right', heading: 'Right: a column beside the card, clear of the Jax button' },
]

function isTownhome(tile: ListingTile): boolean {
  return /townho/i.test(tile.propertySubType ?? '')
}

export default async function ListingDialRailsPreviewPage() {
  const [leads, tetherow, caldera] = await Promise.all([
    loadPlaceStockTiles({ listingKeys: [FILE_REEL_KEY, YOUTUBE_REEL_KEY] }),
    loadPlaceStockTiles({ subdivisionNames: ['Tetherow'], city: 'Bend' }),
    loadPlaceStockTiles({ subdivisionNames: ['Caldera Springs'] }),
  ])

  const byKey = new Map(leads.map((tile) => [tile.listingKey, tile]))
  const leadTiles = [FILE_REEL_KEY, YOUTUBE_REEL_KEY]
    .map((key) => byKey.get(key))
    .filter((tile): tile is ListingTile => tile != null)
  const setTiles = [...leadTiles, ...tetherow.filter(isTownhome)]
  const rows = setTiles.map(placeStockRowFromTile).filter((row): row is NonNullable<typeof row> => row != null)
  const stacked = placeStockSectionsFromTiles([...tetherow, ...caldera]).filter((s) => s.rows.length > 1)

  return (
    <main className={`${V3_ROOT_CLASS} mx-auto w-full max-w-[90rem] px-5 py-12`}>
      <h1 className="font-display mb-2 text-3xl">Listing dial: where the thumbnails stand</h1>
      <p className="mb-16 max-w-[44rem] text-base">
        The same {rows.length} active listings in each position. Rest on a card for a moment and its
        video plays if the listing has one. Resize to a phone and every position becomes the strip
        under the card.
      </p>

      {POSITIONS.map(({ rail, heading }) => (
        <section key={rail} className="mb-24" data-preview-rail={rail}>
          <h2 className="font-display mb-6 text-xl">{heading}</h2>
          <V3ListingDial
            id={`preview-${rail}`}
            heading="Tetherow townhomes, after a file reel and a YouTube reel"
            headingLevel={3}
            countLabel={`${rows.length} for sale`}
            label={`Preview listings, rail ${rail}`}
            listings={rows}
            railPosition={rail}
            className="mx-auto"
          />
        </section>
      ))}

      <section className="mb-24" data-preview-rail="right-band">
        <h2 className="font-display mb-6 text-xl">Right, at the neighborhood band&apos;s full width</h2>
        <V3ListingDial
          id="preview-right-band"
          heading="Tetherow townhomes, after a file reel and a YouTube reel"
          headingLevel={3}
          countLabel={`${rows.length} for sale`}
          label="Preview listings, rail right, full band"
          listings={rows}
          railPosition="right"
          className="!max-w-none"
        />
      </section>

      <section data-preview-rail="stacked">
        <h2 className="font-display mb-2 text-xl">Stacked: one dial per property type, dialRailPositionAt(i)</h2>
        <p className="mb-10 max-w-[44rem] text-base">Tetherow and Caldera Springs, active listings.</p>
        {stacked.map((section, i) => (
          <div key={section.key} className="mb-16">
            <V3ListingDial
              id={`preview-stacked-${section.key}`}
              heading={section.heading}
              headingLevel={3}
              countLabel={section.countLabel}
              label={`${section.heading} in Tetherow and Caldera Springs`}
              listings={section.rows}
              railPosition={dialRailPositionAt(i)}
              className="mx-auto"
            />
          </div>
        ))}
      </section>
    </main>
  )
}
