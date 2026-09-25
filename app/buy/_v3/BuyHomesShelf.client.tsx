'use client'

/**
 * THE /buy FOLD SHELF, on the listing dial.
 *
 * WHAT IT WAS (SITE-91). The installed shadcn carousel with its flanking
 * chevrons, sorted cheapest first and brushed by asking-price band on the
 * house segmented control (V3ChartSwitch), with a ladder over the track: one
 * mark per listing along the shelf's own asking-price range, the on-screen
 * cards filled.
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * Each band is a V3ListingDial: one home large with its photograph and the
 * card's copy, the rest of the band as thumbnails on the dial's rail, "03 /
 * 12" at its head. The shelf is otherwise unchanged: the same lead row, the
 * same cheapest-first order, the same bands, the switch's hidden panels still
 * in the DOM so every listing href on the page is crawlable whichever band is
 * open, the same see-all door. The ladder stays the shelf's one drawing and
 * now fills the mark of the home the dial is showing, so it moves when the
 * dial turns (useListingDialIndex reads which home that is).
 *
 * NOTE: /buy 301s to /homes-for-sale (next.config.ts, since 2026-09-23), so no
 * visitor reaches this shelf; it is converted so the route's code matches the
 * rest of the site if the redirect is ever lifted.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3ChartSwitch, v3Text } from '@/components/site/v3'
import { useListingDialIndex } from '@/components/site/v3/useListingDialIndex'
import { V3ListingDialRail, dialRailPositionAt } from '@/components/site/v3/dial-rail-position.shim'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { listingRowFromRailCard, type HomeRailCard, type HomeRailRow } from '@/app/_v3/home-rail-items'
import { buyShelfBands, buyShelfLadder, sortByAsk } from './buy-shelf-bands'
import '@/app/_v3/home-homes-rails.css'
import './buy-homes-shelf.css'

/**
 * THE LADDER: one mark per listing, placed along the shelf's own asking-price
 * range, the mark of the home the dial shows filled. It names both ends so
 * the marks are readable rather than decorative. The marks are not controls:
 * the dial's thumbnails, its previous and next, and the band chips are; this
 * is the readout they move.
 */
function BuyShelfLadderStrip({
  cards,
  shown,
}: {
  cards: readonly HomeRailCard[]
  shown: number
}) {
  /* A fractional-share ask is the price of a slice, not of the house, so it
     keeps its card (with its share label) and loses its mark; otherwise the
     strip's low end would be a number that buys nobody a home
     (ci:listing-figure-publish, 735 Purcell / Eagle Crest). */
  const ladder = buyShelfLadder(cards, (card) =>
    publishListingShareKind({
      propertySubType: card.propertySubType,
      subdivisionName: card.subdivisionName,
      city: card.city,
      listNumber: card.listNumber,
    }) != null,
  )
  if (!ladder) return null
  const low = formatPublishedSaleAsk({ price: ladder.low, propertyType: 'A' })
  const high = formatPublishedSaleAsk({ price: ladder.high, propertyType: 'A' })
  if (!low || !high) return null

  return (
    <p className="buy-ladder" aria-hidden="true">
      <span className="buy-ladder__end">{low}</span>
      <span className="buy-ladder__rail">
        {ladder.marks.map((mark) => (
          <span
            key={mark.listingKey}
            className={cn('buy-ladder__mark', mark.index === shown && 'is-on')}
            style={{ ['--buy-ladder-x' as string]: `${mark.pct * 100}%` }}
          />
        ))}
      </span>
      <span className="buy-ladder__end">{high}</span>
    </p>
  )
}

/** One band: its ladder over its dial. */
function BuyShelfTrack({
  id,
  cards,
  label,
}: {
  id: string
  cards: readonly HomeRailCard[]
  label: string
}) {
  const shown = useListingDialIndex(id, cards.length)
  return (
    <div className="buy-shelf__track">
      <BuyShelfLadderStrip cards={cards} shown={shown} />
      {/* The page's first dial (the shelves under it carry the order on). */}
      <V3ListingDialRail
        id={id}
        label={label}
        listings={cards.map(listingRowFromRailCard)}
        railPosition={dialRailPositionAt(0)}
        className="buy-shelf__dial"
      />
    </div>
  )
}

export function BuyHomesShelf({ row }: { row: HomeRailRow }) {
  const bands = buyShelfBands(row.cards)
  const headingId = `${row.id}-heading`

  return (
    <section
      id={row.id}
      className={cn(V3_ROOT_CLASS, 'home-rail', 'buy-shelf')}
      aria-labelledby={headingId}
    >
      {/* THREE SIBLINGS, NOT A HEAD ROW WITH EVERYTHING IN IT. From 64rem the
          section is a grid and the switch is `display: contents`, so the
          heading, the band chips and the see-all share ONE line and the open
          band sits under all three. Below 64rem the same three fall into flow
          in reading order: what the shelf is, how to narrow it, the shelf,
          then the way out of the page. */}
      <div className="home-rail__head buy-shelf__head">
        <div className="home-rail__head-copy">
          <h2 id={headingId} className="home-rail__title">
            {row.heading}
          </h2>
        </div>
      </div>
      {bands.length > 0 ? (
        <V3ChartSwitch
          label={v3Text('Asking price')}
          items={bands.map((band) => ({ key: band.key, label: v3Text(band.label) }))}
          className="buy-shelf__switch"
        >
          {bands.map((band) => (
            <BuyShelfTrack
              key={band.key}
              id={`${row.id}-${band.key}`}
              cards={band.cards}
              label={`${row.heading} · ${band.label}`}
            />
          ))}
        </V3ChartSwitch>
      ) : (
        <BuyShelfTrack id={`${row.id}-all`} cards={sortByAsk(row.cards)} label={row.heading} />
      )}
      {row.seeAll ? (
        <V3Button href={row.seeAll.href} variant="ghost" className="buy-shelf__see-all">
          {row.seeAll.label}
        </V3Button>
      ) : null}
    </section>
  )
}
