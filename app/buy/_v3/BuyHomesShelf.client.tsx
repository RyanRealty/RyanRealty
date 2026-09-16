'use client'

/**
 * THE /buy FOLD SHELF — catalog job `shadcn-carousel`, owned by this route.
 *
 * This file imports the installed source itself (`@/components/ui/carousel`,
 * `npx shadcn add carousel`) and composes it: the official track and the
 * official prev/next buttons flanking it, 44x44 and centred on the media
 * midline. A house rail wrapper is not the install — `ci:catalog-install`'s
 * requireRouteImport and `taste-receipt --ship` both read THIS directory for
 * the specifier. (The demo's position readout, "Slide 1 of 5", ships on the
 * shelves BELOW the fold, where 25px of chrome above the photograph is free;
 * see `HomeRailPosition`.)
 *
 * WHAT IT ADDS OVER THE SHELVES BELOW IT. `HomeListingRail` is the editorial
 * shelf: one claim ("Price cuts", "New this week"), one track, scroll it. This
 * is the buyer's instrument, and it exists because /buy has one job the
 * homepage does not — a visitor who has not told us anything yet wants to know
 * what their number buys. So the fold shelf is sorted cheapest first and
 * brushed by asking-price band on the house segmented control (V3ChartSwitch),
 * whose hidden panels stay in the DOM: every listing href on this page is
 * crawlable whichever band is open, and the rail ItemList JSON-LD still
 * describes all of them.
 *
 * The card face and the chrome classes are IMPORTED from the rail, not copied:
 * two shelves doing the same job on two pages are the same object here, down to
 * the stylesheet (TASTE.md, "Consistency is a taste rule"). Only the
 * composition around them belongs to this route.
 */
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3ChartSwitch, v3Text } from '@/components/site/v3'
import { HomeRailCardFace } from '@/app/_v3/HomeListingRail.client'
import type { HomeRailCard, HomeRailRow } from '@/app/_v3/home-rail-items'
import { buyShelfBands, sortByAsk } from './buy-shelf-bands'
import '@/components/site/v3/V3ListingRow.css'
import '@/components/site/v3/V3Carousel.css'
import '@/app/_v3/home-homes-rails.css'
import './buy-homes-shelf.css'

/**
 * One band's track: the installed carousel and its flanking chevrons.
 *
 * No position readout here, unlike the shelves below the fold and on the
 * homepage (`HomeRailPosition`). It is 25px of chrome above the photograph,
 * and in this one viewport those 25px are the difference between the first
 * ask's address being on screen and being under the fold. The chips and the
 * two 44x44 chevrons already say the shelf moves.
 */
function BuyShelfTrack({
  cards,
  label,
  priority,
}: {
  cards: readonly HomeRailCard[]
  label: string
  priority: boolean
}) {
  return (
    <div className="buy-shelf__track">
      <Carousel
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className={cn(V3_ROOT_CLASS, 'v3-carousel', 'v3-carousel--rail', 'home-rail__carousel')}
        aria-label={label}
      >
        <CarouselContent className="v3-carousel__track ml-0">
          {cards.map((card, i) => (
            <CarouselItem
              key={card.listingKey}
              className="v3-carousel__slide v3-carousel__slide--rail pl-0"
            >
              <HomeRailCardFace card={card} priority={priority && i < 4} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {cards.length > 1 ? (
          <>
            <CarouselPrevious className="v3-carousel__step v3-carousel__step--prev" />
            <CarouselNext className="v3-carousel__step v3-carousel__step--next" />
          </>
        ) : null}
      </Carousel>
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
          track sits under all three — a second chrome row would have cost the
          1440x900 fold the address and the specs under the first ask. Below
          64rem the same three fall into flow in reading order: what the shelf
          is, how to narrow it, the shelf, then the way out of the page. */}
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
          {bands.map((band, i) => (
            <BuyShelfTrack
              key={band.key}
              cards={band.cards}
              label={`${row.heading} · ${band.label}`}
              priority={i === 0}
            />
          ))}
        </V3ChartSwitch>
      ) : (
        <BuyShelfTrack cards={sortByAsk(row.cards)} label={row.heading} priority />
      )}
      <V3Button href={row.seeAll.href} variant="ghost" className="buy-shelf__see-all">
        {row.seeAll.label}
      </V3Button>
    </section>
  )
}
